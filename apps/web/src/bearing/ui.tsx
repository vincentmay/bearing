import type { CSSProperties, ReactNode } from "react";
import type { Dot, SideView } from "./model";

/** The mark: a ball seated in its ring. Construction is in docs/BRAND.md. */
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Bearing">
      <path
        fill="currentColor"
        d="M56.305 22.767A26 26 0 1 1 41.233 7.695A11 11 0 0 0 35.871 16.475A16 16 0 1 0 47.525 28.129A11 11 0 0 0 56.305 22.767Z"
      />
      <circle fill="currentColor" cx="46.85" cy="17.15" r="7.5" />
    </svg>
  );
}

/** A team or player: a flat disc in their colour with a short name. No logos. */
export function Disc({ side, size = 44 }: { side: SideView; size?: number }) {
  return (
    <span
      className="bx-disc"
      style={{ "--s": `${size}px`, background: side.color, color: side.ink } as CSSProperties}
      aria-hidden
    >
      {side.short}
    </span>
  );
}

/** A match that has not started: both sides in one disc, inside a ring that fills as the start gets closer. */
export function Duo({ sides, progress }: { sides: SideView[]; progress: number }) {
  const [a, b] = sides;
  const split =
    sides.length === 2 && a && b
      ? `linear-gradient(90deg, ${a.color} 50%, ${b.color} 50%)`
      : (a?.color ?? "var(--rest)");
  return (
    <span
      className="bx-duo"
      style={{ "--q": Math.round(Math.max(0, Math.min(1, progress)) * 100) } as CSSProperties}
      aria-hidden
    >
      <i style={{ background: split }} />
    </span>
  );
}

/** Live, without a colour: a dot that sends out a ring. */
export function Ping({ on = true }: { on?: boolean }) {
  return <i className={on ? "bx-ping" : "bx-ping bx-ping-off"} aria-hidden />;
}

function dotStyle(dot: Dot, sides: SideView[]): CSSProperties | undefined {
  if (dot.k === "won") return { background: sides[dot.side]?.color };
  if (dot.k === "shared") {
    return {
      background: `linear-gradient(90deg, ${sides[0]?.color ?? "var(--ink)"} 50%, ${sides[1]?.color ?? "var(--surface)"} 50%)`,
    };
  }
  return undefined;
}

/** One thing won, in the colour of whoever won it, in the order it happened. Flat, on a line. */
export function Dots({
  rows,
  sides,
  size = 13,
  center = false,
}: {
  rows: Dot[][];
  sides: SideView[];
  size?: number;
  center?: boolean;
}) {
  return (
    <>
      {rows.map((row, r) => (
        <span
          key={r}
          className={center ? "bx-dots bx-center" : "bx-dots"}
          style={{ "--ds": `${size}px` } as CSSProperties}
        >
          {row.map((dot, i) => (
            <i
              key={i}
              className={`bx-dot-${dot.k}`}
              style={dotStyle(dot, sides)}
              title={"label" in dot ? dot.label : undefined}
            />
          ))}
        </span>
      ))}
    </>
  );
}

/** A section on the page: a black rule and a small label. No box. */
export function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="bx-section">
      <h2 className="bx-label">{label}</h2>
      {children}
    </section>
  );
}
