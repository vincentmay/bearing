/**
 * Slate's mark: three slabs, split at the right edge the way slate cleaves, set like lines of
 * writing. The last line is short: the slate is still being written. The flare dot is where the
 * writing is now. Drawn on a 32-unit grid.
 *
 *   ▬▬▬▬▬▬▬▬▬▬▬▬▬
 *   ▬▬▬▬▬▬▬▬▬▬▬
 *   ▬▬▬▬▬▬  •      ← the line being written; the dot is now
 */
export const BRAND = {
  graphite: "#161A20",
  slate900: "#1E242C",
  slate700: "#2F3843",
  slate500: "#4A5664",
  slate300: "#8C97A3",
  slate100: "#DCE1E6",
  chalk: "#F3F1EC",
  chalkWhite: "#FBFAF7",
  flare: "#FF5A36",
} as const;

/** Slab with a cleaved right edge: (x, y) top-left, w × h, cut is how far the bottom edge falls short. */
function slab(x: number, y: number, w: number, h: number, cut = 1.6) {
  return `M${x} ${y} H${x + w} L${x + w - cut} ${y + h} H${x} Z`;
}

export const MARK_PATHS = [slab(6, 8, 20, 4.4), slab(6, 13.8, 16.5, 4.4), slab(6, 19.6, 9.5, 4.4)];
export const MARK_DOT = { cx: 19.8, cy: 21.8, r: 2.2 };

export function SlateMark({
  size = 32,
  ink = "currentColor",
  dot = BRAND.flare,
  className = "",
  title = "Slate",
}: {
  size?: number;
  ink?: string;
  dot?: string;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label={title}
    >
      {MARK_PATHS.map((d) => (
        <path key={d} d={d} fill={ink} />
      ))}
      <circle {...MARK_DOT} fill={dot} />
    </svg>
  );
}

/** The app icon: chalk slabs on a slate tile. */
export function SlateIcon({
  size = 40,
  className = "",
  rounded = 0.24,
}: {
  size?: number;
  className?: string;
  rounded?: number;
}) {
  const id = `slate-tile-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Slate"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A4552" />
          <stop offset="1" stopColor="#222932" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx={32 * rounded} fill={`url(#${id})`} />
      {/* Fine strata, barely there: the stone's grain. */}
      {[5, 9.5, 27.5].map((y) => (
        <rect key={y} x="0" y={y} width="32" height="0.35" fill="#ffffff" opacity="0.05" />
      ))}
      {MARK_PATHS.map((d) => (
        <path key={d} d={d} fill={BRAND.chalk} />
      ))}
      <circle {...MARK_DOT} fill={BRAND.flare} />
    </svg>
  );
}

/** Wordmark: lowercase, tight, solid. Always set, never drawn, so it stays crisp at every size. */
export function Wordmark({
  size = 22,
  className = "",
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={className}
      style={{
        fontFamily: '"Inter Tight Variable", system-ui, sans-serif',
        fontWeight: 740,
        fontSize: size,
        letterSpacing: "-0.045em",
        lineHeight: 1,
        ...style,
      }}
    >
      slate
    </span>
  );
}

/** Mark + wordmark. The gap is a third of the mark; the wordmark's x-height sits on the middle slab. */
export function Lockup({
  size = 28,
  ink = "currentColor",
  dot,
  className = "",
  wordStyle,
}: {
  size?: number;
  ink?: string;
  dot?: string;
  className?: string;
  wordStyle?: React.CSSProperties;
}) {
  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{ gap: size * 0.18, color: ink }}
    >
      <SlateMark size={size} ink={ink} dot={dot} />
      <Wordmark size={size * 0.78} style={{ marginBottom: size * 0.04, ...wordStyle }} />
    </span>
  );
}
