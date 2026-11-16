import type { DisciplineId, Follow } from "@bearing/domain";
import { countdown } from "@bearing/domain";
import { Check, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useAtlas, useFollow, useNow } from "../lib/world";
import { GameLink } from "./links";

export function Section({
  title,
  kicker,
  action,
  children,
  className = "",
}: {
  title: ReactNode;
  kicker?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <header className="mb-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          {kicker && <div className="ui-kicker mb-2">{kicker}</div>}
          <h2 className="ui-h2">{title}</h2>
        </div>
        {action && <div className="shrink-0 text-[13px] text-muted">{action}</div>}
      </header>
      {children}
    </section>
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

export function LiveBadge({ label = "Live" }: { label?: string }) {
  return (
    <span className="ui-live">
      <LiveDot /> {label}
    </span>
  );
}

export function FollowButton({ follow, compact = false }: { follow: Follow; compact?: boolean }) {
  const [on, toggle] = useFollow(follow);
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      className={`ui-btn ${on ? "" : "ui-btn-primary"} ${compact ? "h-8 px-3 text-[12.5px]" : ""}`}
    >
      <span className="flex items-center gap-1.5">
        {on ? <Check className="size-4" /> : <Plus className="size-4" />}
        {on ? "Following" : "Follow"}
      </span>
    </button>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div className="ui-tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === value}
          className="ui-tab"
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 text-faint">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  className = "",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="ui-label">{label}</div>
      <div className="ui-num mt-1.5 truncate text-[28px] leading-none">{value}</div>
      {sub && <div className="mt-1.5 truncate text-[12.5px] text-muted">{sub}</div>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="ui-card ui-card-pad grid min-h-[160px] place-items-center text-center">
      <div>
        <div className="ui-h3">{title}</div>
        {children && (
          <p className="mx-auto mt-2 max-w-[420px] text-[14px] text-muted">{children}</p>
        )}
      </div>
    </div>
  );
}

/** Ticking countdown: "2d 04:12:09" or "04:12:09". */
export function Countdown({ to, className = "" }: { to: string; className?: string }) {
  const now = useNow();
  const c = countdown(to, now);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span
      className={`ui-num tabular-nums ${className}`}
      aria-label={`Starts in ${c.days} days ${c.hours} hours ${c.minutes} minutes`}
    >
      {c.days > 0 && `${c.days}d `}
      {pad(c.hours)}:{pad(c.minutes)}:{pad(c.seconds)}
    </span>
  );
}

export function GameBadge({
  id,
  link = false,
  className = "",
}: {
  id: DisciplineId;
  link?: boolean;
  className?: string;
}) {
  const atlas = useAtlas();
  const d = atlas.discipline(id);
  const inner = (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${className}`}>
      <span className="size-2 rounded-full" style={{ background: d.palette.accent }} />
      {d.short}
    </span>
  );
  return link ? <GameLink id={id}>{inner}</GameLink> : inner;
}

export function Form({ results }: { results: ("W" | "L" | "D")[] }) {
  return (
    <span className="inline-flex gap-1">
      {results.map((r, i) => (
        <span
          key={i}
          title={r === "W" ? "Win" : r === "L" ? "Loss" : "Draw"}
          className={`grid size-[22px] place-items-center rounded-[6px] text-[10.5px] font-bold ${
            r === "W"
              ? "bg-win/15 text-win"
              : r === "L"
                ? "bg-loss/15 text-loss"
                : "bg-raised text-muted"
          }`}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

export function Meter({
  value,
  max = 1,
  color = "var(--accent)",
  className = "",
}: {
  value: number;
  max?: number;
  color?: string;
  className?: string;
}) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-raised ${className}`}>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(1, value / max)) * 100}%`, background: color }}
      />
    </div>
  );
}
