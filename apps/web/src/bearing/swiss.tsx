import {
  type Stage,
  type SwissRecord,
  type Tournament,
  swissRecords,
  winnerOf,
} from "@bearing/domain";
import { ChevronRight } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import type { Board } from "./board";
import { Go } from "./links";
import { sideOf } from "./model";
import { Disc } from "./ui";

/** The width an element has been given, kept up to date. Zero until it has been measured. */
export function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const watch = new ResizeObserver(() => setWidth(el.clientWidth));
    watch.observe(el);
    return () => watch.disconnect();
  }, [ref]);
  return width;
}

interface Node {
  key: string;
  wins: number;
  losses: number;
  /** The teams standing at this record now. */
  teams: SwissRecord[];
}

interface Edge {
  from: string;
  to: string;
  win: boolean;
  count: number;
  teams: Set<string>;
}

const NODE = 80;

/**
 * A Swiss stage as the thing it is: every team starts level, a win moves it one way and a loss
 * the other, and the field spreads out round by round until each team has enough of either.
 * A record is a place on the drawing; the teams stand at the record they hold now; the lines
 * are the results that took them there, thicker where more teams went the same way. Point at a
 * team, or pick it, and its own way through is drawn out and told in words.
 */
export function SwissFlow({
  stage,
  tournament,
  board,
}: {
  stage: Stage;
  tournament: Tournament;
  board: Board;
}) {
  const { atlas } = board;
  const need = stage.rules?.winsToAdvance ?? 3;
  const out = stage.rules?.lossesToExit ?? 3;
  const records = swissRecords(atlas, stage, tournament.participantIds);
  const [picked, setPicked] = useState<string>();
  const [pointed, setPointed] = useState<string>();
  const active = pointed ?? picked;
  const frame = useRef<HTMLDivElement>(null);
  const width = useWidth(frame);

  // Every record a team has held is a place; the teams stand where they are now.
  const nodes = new Map<string, Node>();
  const edges = new Map<string, Edge>();
  const place = (wins: number, losses: number) => {
    const key = `${wins}-${losses}`;
    let node = nodes.get(key);
    if (!node) {
      node = { key, wins, losses, teams: [] };
      nodes.set(key, node);
    }
    return node;
  };
  const ways = new Map<string, string[]>();
  for (const r of records) {
    let wins = 0;
    let losses = 0;
    const way = [place(0, 0).key];
    for (const result of r.path) {
      const from = `${wins}-${losses}`;
      if (result === "W") wins++;
      else losses++;
      const to = place(wins, losses).key;
      const id = `${from}>${to}`;
      const edge = edges.get(id) ?? { from, to, win: result === "W", count: 0, teams: new Set() };
      edge.count++;
      edge.teams.add(r.competitorId);
      edges.set(id, edge);
      way.push(to);
    }
    ways.set(r.competitorId, way);
    place(r.wins, r.losses).teams.push(r);
  }

  // With room the rounds run left to right; on a phone they run down the page.
  const across = width >= 500;
  const rounds = need + out - 1;
  const reach = Math.max(need, out);
  // On a phone the record itself says which round it is; there is no room for a margin.
  const lead = 0;
  const nodeW = across ? NODE : 74;
  const colW = across ? (width - nodeW) / rounds : 0;
  const stepY = across ? 41 : 0;
  const rowH = across ? 0 : 98;
  const stepX = across ? 0 : (width - lead - nodeW) / (2 * reach);
  const top = across ? 26 : 8;
  const height = across ? top + 2 * reach * stepY + 76 : top + rounds * rowH + 84;
  const at = (wins: number, losses: number) =>
    across
      ? { x: nodeW / 2 + (wins + losses) * colW, y: top + 38 + (reach + losses - wins) * stepY }
      : {
          x: lead + nodeW / 2 + (reach + losses - wins) * stepX,
          y: top + 36 + (wins + losses) * rowH,
        };

  const way = active ? (ways.get(active) ?? []) : [];
  const onWay = (edge: Edge) => !!active && edge.teams.has(active);
  const shown = active ? records.find((r) => r.competitorId === active) : undefined;

  // The shown team's results, in the order they were played.
  const story = shown
    ? stage.rounds.flatMap((round) =>
        round.matchIds.flatMap((id) => {
          const match = atlas.match(id);
          if (!match || match.status !== "finished") return [];
          const mine = match.sides.findIndex((s) => s.competitorId === shown.competitorId);
          if (mine < 0) return [];
          const other = match.sides[1 - mine]?.competitorId;
          return [{ id, won: winnerOf(match) === mine, other: other ? atlas.name(other) : "" }];
        }),
      )
    : [];

  return (
    <div className="bx-flow-wrap">
      <div
        ref={frame}
        className="bx-flow"
        style={{ height: width ? height : 420 }}
        onPointerLeave={() => setPointed(undefined)}
        data-tracing={active ? "" : undefined}
      >
        {width ? (
          <>
            <svg width={width} height={height} aria-hidden>
              {[...edges.values()].map((edge) => {
                const a = nodes.get(edge.from)!;
                const b = nodes.get(edge.to)!;
                const p = at(a.wins, a.losses);
                const q = at(b.wins, b.losses);
                const d = across
                  ? `M${p.x},${p.y} C${(p.x + q.x) / 2},${p.y} ${(p.x + q.x) / 2},${q.y} ${q.x},${q.y}`
                  : `M${p.x},${p.y} C${p.x},${(p.y + q.y) / 2} ${q.x},${(p.y + q.y) / 2} ${q.x},${q.y}`;
                return (
                  <path
                    key={`${edge.from}>${edge.to}`}
                    d={d}
                    data-win={edge.win ? "" : undefined}
                    data-on={onWay(edge) ? "" : undefined}
                    strokeWidth={onWay(edge) ? 2.6 : 1 + edge.count * 0.55}
                  />
                );
              })}
            </svg>
            {across
              ? Array.from({ length: rounds + 1 }, (_, r) => (
                  <span
                    key={r}
                    className="bx-label bx-flow-round"
                    style={{ left: r * colW, width: nodeW, top: 0, textAlign: "center" }}
                  >
                    {r === 0 ? "Start" : `R${r}`}
                  </span>
                ))
              : null}
            {[...nodes.values()].map((node) => {
              const p = at(node.wins, node.losses);
              const through = node.wins >= need;
              const gone = node.losses >= out;
              return (
                <div
                  key={node.key}
                  className="bx-flow-node"
                  style={{ left: p.x, top: p.y, width: nodeW }}
                  data-end={through ? "through" : gone ? "out" : undefined}
                  data-on={way.includes(node.key) ? "" : undefined}
                  data-empty={node.teams.length ? undefined : ""}
                >
                  <b className="bx-num">
                    {node.wins}
                    <i className="bx-dash" />
                    {node.losses}
                  </b>
                  {node.teams.length ? (
                    <span>
                      {node.teams.map((r) => {
                        const side = sideOf(atlas, r.competitorId);
                        const on = active === r.competitorId;
                        return (
                          <button
                            key={r.competitorId}
                            type="button"
                            aria-pressed={picked === r.competitorId}
                            aria-label={`${side.name}, ${r.wins} won, ${r.losses} lost${
                              r.status === "advanced"
                                ? ", through"
                                : r.status === "eliminated"
                                  ? ", out"
                                  : ""
                            }`}
                            title={side.name}
                            data-dim={active && !on ? "" : undefined}
                            onPointerEnter={(e) => {
                              if (e.pointerType === "mouse") setPointed(r.competitorId);
                            }}
                            onFocus={() => setPointed(r.competitorId)}
                            onBlur={() => setPointed(undefined)}
                            onClick={() =>
                              setPicked(picked === r.competitorId ? undefined : r.competitorId)
                            }
                          >
                            <Disc side={side} size={across ? 22 : 20} />
                          </button>
                        );
                      })}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </>
        ) : null}
      </div>
      <div className="bx-flow-story" aria-live="polite">
        {shown ? (
          <>
            <Go to={{ kind: "team", id: shown.competitorId }} className="bx-flow-team">
              <Disc side={sideOf(atlas, shown.competitorId)} size={28} />
              <b>{atlas.name(shown.competitorId).replace(/^Team /, "")}</b>
              <span className="bx-num">
                {shown.wins}
                <i className="bx-dash" />
                {shown.losses}
                {shown.status === "advanced"
                  ? " · through"
                  : shown.status === "eliminated"
                    ? " · out"
                    : ""}
              </span>
              <ChevronRight size={15} />
            </Go>
            <span className="bx-flow-results">
              {story.map((s, i) => (
                <span key={s.id} data-won={s.won ? "" : undefined}>
                  <i className="bx-label">R{i + 1}</i>
                  {s.won ? "beat" : "lost to"} {s.other.replace(/^Team /, "")}
                </span>
              ))}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
