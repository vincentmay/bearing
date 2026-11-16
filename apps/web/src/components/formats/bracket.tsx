import type { Match, Stage } from "@bearing/domain";
import { winnerOf } from "@bearing/domain";
import { useMemo, type ReactNode } from "react";
import { useAtlas } from "../../lib/world";

export interface BracketGeometry {
  matchWidth: number;
  matchHeight: number;
  columnGap: number;
  rowGap: number;
  headerHeight: number;
}

interface Placed {
  match: Match;
  x: number;
  y: number;
  column: number;
}

/**
 * Single-elimination bracket. Geometry is shared by every direction; each passes its own
 * match renderer and line styling. Hovering a competitor traces their path.
 */
export function Bracket({
  stage,
  geometry,
  renderMatch,
  renderHeader,
  highlight,
  lineColor = "var(--line)",
  activeLineColor = "var(--accent)",
  lineWidth = 1.25,
  radius = 10,
}: {
  stage: Stage;
  geometry: BracketGeometry;
  renderMatch: (match: Match, placed: { column: number; isFinal: boolean }) => ReactNode;
  renderHeader?: (round: Stage["rounds"][number], column: number) => ReactNode;
  highlight?: string | null;
  lineColor?: string;
  activeLineColor?: string;
  lineWidth?: number;
  radius?: number;
}) {
  const atlas = useAtlas();
  const { matchWidth: w, matchHeight: h, columnGap, rowGap, headerHeight } = geometry;

  const layout = useMemo(() => {
    const placed = new Map<string, Placed>();
    stage.rounds.forEach((round, col) => {
      round.matchIds.forEach((id, i) => {
        const match = atlas.match(id);
        if (!match) return;
        let y: number;
        if (col === 0) {
          y = headerHeight + i * (h + rowGap);
        } else {
          const prev = stage.rounds[col - 1]!;
          const feeders = prev.matchIds
            .map((pid) => placed.get(pid))
            .filter((p): p is Placed => !!p && p.match.next?.winner === id);
          const fallback = [prev.matchIds[i * 2], prev.matchIds[i * 2 + 1]]
            .map((pid) => (pid ? placed.get(pid) : undefined))
            .filter((p): p is Placed => !!p);
          const src = feeders.length ? feeders : fallback;
          y = src.length
            ? src.reduce((s, p) => s + p.y, 0) / src.length
            : headerHeight + i * (h + rowGap);
        }
        placed.set(id, { match, x: col * (w + columnGap), y, column: col });
      });
    });
    const all = [...placed.values()];
    const width = stage.rounds.length * w + (stage.rounds.length - 1) * columnGap;
    const height = Math.max(...all.map((p) => p.y + h), headerHeight + h);
    return { placed, all, width, height };
  }, [atlas, stage, w, h, columnGap, rowGap, headerHeight]);

  const pathOf = useMemo(() => {
    if (!highlight) return new Set<string>();
    return new Set(
      layout.all
        .filter((p) => p.match.sides.some((s) => s.competitorId === highlight))
        .map((p) => p.match.id),
    );
  }, [highlight, layout]);

  const connectors = layout.all.flatMap((p) => {
    const nextId = p.match.next?.winner;
    const target = nextId ? layout.placed.get(nextId) : undefined;
    if (!target) return [];
    const x1 = p.x + w;
    const y1 = p.y + h / 2;
    const x2 = target.x;
    const slotOffset =
      target.match.sides.length === 2 ? (y1 < target.y + h / 2 ? -h / 4 : h / 4) : 0;
    const y2 = target.y + h / 2 + slotOffset;
    const mx = x1 + columnGap / 2;
    const r = Math.min(radius, Math.abs(y2 - y1) / 2, columnGap / 2);
    const dir = y2 > y1 ? 1 : -1;
    const d =
      Math.abs(y2 - y1) < 0.5
        ? `M${x1},${y1} H${x2}`
        : `M${x1},${y1} H${mx - r} Q${mx},${y1} ${mx},${y1 + dir * r} V${y2 - dir * r} Q${mx},${y2} ${mx + r},${y2} H${x2}`;
    const w0 = winnerOf(p.match);
    const advancing = typeof w0 === "number" ? p.match.sides[w0]?.competitorId : undefined;
    const active =
      !!highlight &&
      pathOf.has(p.match.id) &&
      pathOf.has(target.match.id) &&
      advancing === highlight;
    return [{ key: `${p.match.id}-${target.match.id}`, d, active }];
  });

  const finalId = stage.rounds.at(-1)?.matchIds.at(-1);

  return (
    <div className="relative" style={{ width: layout.width, height: layout.height }}>
      <svg
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={layout.width}
        height={layout.height}
        aria-hidden
      >
        {connectors.map((c) => (
          <path
            key={c.key}
            d={c.d}
            fill="none"
            stroke={c.active ? activeLineColor : lineColor}
            strokeWidth={c.active ? lineWidth + 0.75 : lineWidth}
            style={{ transition: "stroke 200ms" }}
          />
        ))}
      </svg>
      {renderHeader &&
        stage.rounds.map((round, col) => (
          <div
            key={round.id}
            className="absolute top-0"
            style={{ left: col * (w + columnGap), width: w }}
          >
            {renderHeader(round, col)}
          </div>
        ))}
      {layout.all.map((p) => (
        <div
          key={p.match.id}
          className="absolute"
          style={{ left: p.x, top: p.y, width: w, height: h }}
        >
          {renderMatch(p.match, { column: p.column, isFinal: p.match.id === finalId })}
        </div>
      ))}
    </div>
  );
}
