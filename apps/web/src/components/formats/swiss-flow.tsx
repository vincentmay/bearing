import type { Stage, SwissRecord } from "@bearing/domain";
import { swissRecords, winnerOf } from "@bearing/domain";
import { useMemo } from "react";
import { useAtlas } from "../../lib/world";
import { Mark } from "../mark";

interface Node {
  key: string;
  round: number;
  wins: number;
  losses: number;
  teams: string[];
  terminal: "advanced" | "eliminated" | null;
}

/**
 * Swiss stage as a Galton board: each column is a round, each node a win–loss record.
 * Teams flow up-right on a win and down-right on a loss; hovering one traces its run.
 */
export function SwissFlow({
  stage,
  seeds,
  highlight,
  onHighlight,
  variant,
}: {
  stage: Stage;
  seeds: string[];
  highlight: string | null;
  onHighlight: (id: string | null) => void;
  variant?: "roomy" | "compact";
}) {
  const atlas = useAtlas();
  const winsNeeded = stage.rules?.winsToAdvance ?? 3;
  const lossesOut = stage.rules?.lossesToExit ?? 3;

  const { nodes, records, paths } = useMemo(() => {
    const records = swissRecords(atlas, stage, seeds);
    const state = new Map(seeds.map((id) => [id, { w: 0, l: 0 }]));
    const nodes = new Map<string, Node>();
    const paths = new Map<string, string[]>();
    const keyOf = (w: number, l: number) => `${w}-${l}`;
    const add = (w: number, l: number, team: string) => {
      const k = keyOf(w, l);
      const node =
        nodes.get(k) ??
        ({
          key: k,
          round: w + l,
          wins: w,
          losses: l,
          teams: [],
          terminal: w >= winsNeeded ? "advanced" : l >= lossesOut ? "eliminated" : null,
        } satisfies Node);
      node.teams.push(team);
      nodes.set(k, node);
      paths.set(team, [...(paths.get(team) ?? []), k]);
    };
    for (const id of seeds) add(0, 0, id);
    for (const round of stage.rounds) {
      for (const mid of round.matchIds) {
        const m = atlas.match(mid);
        if (!m || m.status !== "finished") continue;
        const w = winnerOf(m);
        m.sides.forEach((s, i) => {
          const id = s.competitorId;
          if (!id) return;
          const st = state.get(id)!;
          if (i === w) st.w++;
          else st.l++;
          add(st.w, st.l, id);
        });
      }
    }
    return { nodes: [...nodes.values()], records, paths };
  }, [atlas, stage, seeds, winsNeeded, lossesOut]);

  const rounds = winsNeeded + lossesOut - 1;
  const colW = variant === "compact" ? 140 : 150;
  const rowH = variant === "compact" ? 66 : 74;
  const pad = 4;
  const nodeW = variant === "compact" ? 112 : 118;
  const step = rowH / 1.15;
  const maxDiff = Math.max(winsNeeded, lossesOut);
  const width = pad * 2 + rounds * colW + nodeW;
  const midY = maxDiff * step + 56;
  const height = midY + maxDiff * step + 84;
  const pos = (w: number, l: number) => ({ x: pad + (w + l) * colW, y: midY + (l - w) * step });

  const highlightPath = highlight ? (paths.get(highlight) ?? []) : [];
  const recordOf = new Map<string, SwissRecord>(records.map((r) => [r.competitorId, r]));

  const edges = useMemo(() => {
    const map = new Map<string, { from: Node; to: Node; count: number }>();
    for (const path of paths.values()) {
      for (let i = 1; i < path.length; i++) {
        const k = `${path[i - 1]}>${path[i]}`;
        const from = nodes.find((n) => n.key === path[i - 1])!;
        const to = nodes.find((n) => n.key === path[i])!;
        const e = map.get(k) ?? { from, to, count: 0 };
        e.count++;
        map.set(k, e);
      }
    }
    return [...map.values()];
  }, [paths, nodes]);

  return (
    <div className="relative" style={{ width, height }} onPointerLeave={() => onHighlight(null)}>
      <svg
        className="pointer-events-none absolute inset-0"
        width={width}
        height={height}
        aria-hidden
      >
        {edges.map((e) => {
          const a = pos(e.from.wins, e.from.losses);
          const b = pos(e.to.wins, e.to.losses);
          const x1 = a.x + nodeW;
          const x2 = b.x;
          const mx = (x1 + x2) / 2;
          const onPath =
            highlightPath.length > 0 &&
            highlightPath.includes(e.from.key) &&
            highlightPath[highlightPath.indexOf(e.from.key) + 1] === e.to.key;
          const isWin = e.to.wins > e.from.wins;
          return (
            <path
              key={`${e.from.key}-${e.to.key}`}
              d={`M${x1},${a.y} C${mx},${a.y} ${mx},${b.y} ${x2},${b.y}`}
              fill="none"
              stroke={onPath ? "var(--accent)" : isWin ? "var(--win)" : "var(--loss)"}
              strokeOpacity={onPath ? 1 : highlight ? 0.08 : 0.28}
              strokeWidth={onPath ? 2.5 : 0.8 + e.count * 0.9}
              strokeLinecap="round"
              style={{ transition: "stroke-opacity 200ms" }}
            />
          );
        })}
      </svg>
      {nodes.map((n) => {
        const p = pos(n.wins, n.losses);
        const onPath = highlightPath.includes(n.key);
        const tone =
          n.terminal === "advanced"
            ? "var(--win)"
            : n.terminal === "eliminated"
              ? "var(--loss)"
              : "var(--muted)";
        return (
          <div
            key={n.key}
            className="ui-card absolute flex flex-col gap-1.5 !rounded-[var(--radius-sm)] p-2"
            style={{
              left: p.x,
              top: p.y - 22,
              width: nodeW,
              borderColor: onPath
                ? "var(--accent)"
                : n.terminal
                  ? `color-mix(in oklab, ${tone} 45%, transparent)`
                  : undefined,
              transition: "border-color 200ms",
            }}
          >
            <div className="flex items-baseline justify-between font-mono text-[10.5px] leading-none">
              <span style={{ color: tone }}>
                {n.wins}–{n.losses}
              </span>
              <span className="text-faint">
                {n.terminal === "advanced"
                  ? "through"
                  : n.terminal === "eliminated"
                    ? "out"
                    : `${n.teams.length}`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {n.teams.map((t) => {
                const dim = highlight && highlight !== t;
                return (
                  <button
                    key={t}
                    type="button"
                    className="cursor-pointer rounded-[5px] transition-opacity duration-200"
                    style={{ opacity: dim ? 0.22 : 1 }}
                    onPointerEnter={() => onHighlight(t)}
                    onFocus={() => onHighlight(t)}
                    onBlur={() => onHighlight(null)}
                    aria-label={`${atlas.name(t)}, finished ${recordOf.get(t)?.wins}–${recordOf.get(t)?.losses}`}
                  >
                    <Mark id={t} size={22} />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {Array.from({ length: rounds + 1 }, (_, r) => (
        <div
          key={r}
          className="absolute top-0 font-mono text-[10px] tracking-[0.14em] text-faint uppercase"
          style={{ left: pad + r * colW }}
        >
          {r === 0 ? "Start" : `After R${r}`}
        </div>
      ))}
    </div>
  );
}
