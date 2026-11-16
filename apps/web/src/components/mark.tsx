import type { Competitor } from "@bearing/domain";
import { useAtlas } from "../lib/world";

/**
 * A competitor's mark. Teams get a monogram plate in their own colours; players get initials.
 * Official logos come later through a licensed source; until then nothing is faked.
 */
export function Mark({
  id,
  size = 32,
  className = "",
  tone = "solid",
}: {
  id: string | null | undefined;
  size?: number;
  className?: string;
  tone?: "solid" | "ink" | "ghost";
}) {
  const atlas = useAtlas();
  const c = atlas.competitor(id);
  if (!c) return <EmptyMark size={size} className={className} />;
  return c.kind === "team" ? (
    <TeamPlate competitor={c} size={size} className={className} tone={tone} />
  ) : (
    <PlayerDisc competitor={c} size={size} className={className} tone={tone} />
  );
}

function EmptyMark({ size, className }: { size: number; className: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden>
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="10"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeDasharray="3 3"
      />
      <text
        x="20"
        y="24.5"
        textAnchor="middle"
        fontSize="11"
        fill="currentColor"
        fillOpacity="0.45"
        fontFamily="var(--mono)"
      >
        ?
      </text>
    </svg>
  );
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function readableOn(hex: string): string {
  return luminance(hex) > 0.45 ? "#0b0b0c" : "#ffffff";
}

function TeamPlate({
  competitor,
  size,
  className,
  tone,
}: {
  competitor: Extract<Competitor, { kind: "team" }>;
  size: number;
  className: string;
  tone: "solid" | "ink" | "ghost";
}) {
  const { primary, secondary } = competitor.colors;
  const label = competitor.short.length > 3 ? competitor.short.slice(0, 4) : competitor.short;
  const fontSize = label.length >= 4 ? 11.5 : label.length === 3 ? 14 : 17;
  const gid = `g-${competitor.id}-${tone}`;
  if (tone === "ink") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        className={className}
        role="img"
        aria-label={competitor.name}
      >
        <rect
          x="1"
          y="1"
          width="38"
          height="38"
          rx="9"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.85"
          strokeWidth="1.4"
        />
        <path d="M1 31 L31 1" stroke={primary} strokeWidth="2.5" opacity="0.9" />
        <text
          x="20"
          y="24.6"
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight="800"
          fill="currentColor"
          style={{ fontFamily: MARK_FONT, fontStretch: "70%" }}
        >
          {label}
        </text>
      </svg>
    );
  }
  const ink = readableOn(primary);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label={competitor.name}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={primary} />
          <stop offset="1" stopColor={mix(primary, secondary, 0.35)} />
        </linearGradient>
      </defs>
      <rect
        x="0.5"
        y="0.5"
        width="39"
        height="39"
        rx="10"
        fill={tone === "ghost" ? "transparent" : `url(#${gid})`}
        stroke={tone === "ghost" ? primary : "rgb(255 255 255 / 0.18)"}
      />
      <path
        d="M26 40 L40 26 L40 30 Q40 40 30 40 Z"
        fill={secondary}
        opacity={tone === "ghost" ? 0.6 : 0.9}
      />
      <text
        x="20"
        y="24.8"
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight="820"
        fill={tone === "ghost" ? primary : ink}
        style={{ fontFamily: MARK_FONT, fontStretch: "70%", letterSpacing: "-0.01em" }}
      >
        {label}
      </text>
    </svg>
  );
}

function PlayerDisc({
  competitor,
  size,
  className,
  tone,
}: {
  competitor: Extract<Competitor, { kind: "player" }>;
  size: number;
  className: string;
  tone: "solid" | "ink" | "ghost";
}) {
  const atlas = useAtlas();
  const accent =
    competitor.colors?.primary ?? atlas.discipline(competitor.discipline).palette.accent;
  const initials = initialsOf(competitor.name ?? competitor.handle);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label={competitor.name ?? competitor.handle}
    >
      <circle
        cx="20"
        cy="20"
        r="19.2"
        fill={tone === "solid" ? "rgb(255 255 255 / 0.06)" : "none"}
        stroke={tone === "ink" ? "currentColor" : accent}
        strokeOpacity={tone === "ink" ? 0.8 : 0.85}
        strokeWidth="1.3"
      />
      <text
        x="20"
        y="24.6"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill={tone === "ink" ? "currentColor" : accent}
        style={{ fontFamily: MARK_FONT, fontStretch: "75%" }}
      >
        {initials}
      </text>
    </svg>
  );
}

/** Marks are identity glyphs: the same face in every direction, never the page's display font. */
const MARK_FONT = '"Archivo Variable", system-ui, sans-serif';

export function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function mix(a: string, b: string, t: number): string {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const ch = (shift: number) =>
    Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

export function Country({ code, className = "" }: { code?: string; className?: string }) {
  if (!code) return null;
  return (
    <span
      className={`inline-flex h-[15px] items-center rounded-[3px] border border-current/25 px-1 font-mono text-[9.5px] leading-none font-medium tracking-wide opacity-80 ${className}`}
      title={new Intl.DisplayNames(undefined, { type: "region" }).of(code) ?? code}
    >
      {code}
    </span>
  );
}

export function LiveDot({ className = "" }: { className?: string }) {
  return (
    <span
      className={`live-dot inline-block size-1.5 shrink-0 rounded-full bg-live ${className}`}
      aria-hidden
    />
  );
}
