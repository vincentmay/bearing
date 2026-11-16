import { type Match, type Stage, winnerOf } from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import type { Board } from "./board";
import { useWidth } from "./swiss";
import { Disc, Dots, Ping, Tick } from "./ui";

interface Placed {
  match: Match;
  column: number;
  x: number;
  y: number;
}

const TILE = 66;
const GAP = 12;
const HEAD = 24;

/**
 * Single elimination, drawn as a tree. Each round is a column; a match sits level with the
 * middle of the two that feed it, and a line runs from each of those into the row its winner
 * takes. Point at a team and its way through the bracket is drawn out, the rest stepping back.
 */
export function Bracket({ stage, board, wide }: { stage: Stage; board: Board; wide: boolean }) {
  const frame = useRef<HTMLDivElement>(null);
  const width = useWidth(frame);
  const [pointed, setPointed] = useState<string>();
  const rounds = stage.rounds
    .map((round) => ({
      round,
      matches: round.matchIds.flatMap((id) => board.atlas.match(id) ?? []),
    }))
    .filter((r) => r.matches.length);
  if (!rounds.length) return <p className="bx-empty">The bracket has not been drawn yet.</p>;

  const gutter = wide ? 30 : 14;
  const tileW = Math.max(0, (width - gutter * (rounds.length - 1)) / rounds.length);
  const placed = new Map<string, Placed>();
  rounds.forEach(({ matches }, column) => {
    matches.forEach((match, i) => {
      const before = rounds[column - 1]?.matches ?? [];
      const fed = before.flatMap((m) => {
        const p = placed.get(m.id);
        return p && m.next?.winner === match.id ? [p] : [];
      });
      // Without links from the source, a match is fed by the two above it in order.
      const feeders = fed.length
        ? fed
        : [before[i * 2], before[i * 2 + 1]].flatMap((m) => (m ? (placed.get(m.id) ?? []) : []));
      const y = feeders.length
        ? feeders.reduce((sum, p) => sum + p.y, 0) / feeders.length
        : HEAD + i * (TILE + GAP);
      placed.set(match.id, { match, column, x: column * (tileW + gutter), y });
    });
  });
  const all = [...placed.values()];
  const height = Math.max(...all.map((p) => p.y + TILE), HEAD + TILE);

  const has = (m: Match, id: string) => m.sides.some((s) => s.competitorId === id);
  const lines = all.flatMap((p) => {
    const next = p.match.next?.winner ? placed.get(p.match.next.winner) : undefined;
    if (!next) return [];
    const w = winnerOf(p.match);
    const through = typeof w === "number" ? p.match.sides[w]?.competitorId : undefined;
    // The line ends at the row its winner takes: the upper feeder above, the lower one below.
    const row = p.y + TILE / 2 <= next.y + TILE / 2 ? 0 : 1;
    const x1 = p.x + tileW;
    const y1 = p.y + 26;
    const x2 = next.x;
    const y2 = next.y + 13 + row * 26;
    const mid = x1 + gutter / 2;
    const r = Math.min(8, Math.abs(y2 - y1) / 2, gutter / 2);
    const dir = y2 > y1 ? 1 : -1;
    const d =
      Math.abs(y2 - y1) < 1
        ? `M${x1},${y1}H${x2}`
        : `M${x1},${y1}H${mid - r}Q${mid},${y1} ${mid},${y1 + dir * r}V${y2 - dir * r}Q${mid},${y2} ${mid + r},${y2}H${x2}`;
    return [
      {
        key: p.match.id,
        d,
        done: p.match.status === "finished",
        on: !!pointed && through === pointed && has(next.match, pointed),
      },
    ];
  });

  return (
    <div
      ref={frame}
      className="bx-bracket"
      style={{ height: width ? height : 240 }}
      data-tracing={pointed ? "" : undefined}
      onPointerLeave={() => setPointed(undefined)}
    >
      {width ? (
        <>
          <svg width={width} height={height} aria-hidden>
            {lines.map((line) => (
              <path
                key={line.key}
                d={line.d}
                data-done={line.done ? "" : undefined}
                data-on={line.on ? "" : undefined}
              />
            ))}
          </svg>
          {rounds.map(({ round }, column) => (
            <h3
              key={round.id}
              className="bx-label"
              style={{ left: column * (tileW + gutter), width: tileW }}
            >
              {wide ? round.name : round.short}
            </h3>
          ))}
          {all.map(({ match, x, y }) => {
            const view = board.view(match);
            const w = winnerOf(match);
            const score = view.headline.length === 2 ? view.headline : [];
            return (
              <Link
                key={match.id}
                to="/match/$matchId"
                params={{ matchId: match.id }}
                className="bx-tie"
                style={{ left: x, top: y, width: tileW }}
                data-on={pointed && has(match, pointed) ? "" : undefined}
              >
                {view.sides.map((side, i) => (
                  <span
                    key={i}
                    className="bx-tie-side"
                    data-lost={typeof w === "number" && w !== i ? "" : undefined}
                    data-open={side.id ? undefined : ""}
                    data-me={side.id && side.id === pointed ? "" : undefined}
                    onPointerEnter={(e) => {
                      if (e.pointerType === "mouse" && side.id) setPointed(side.id);
                    }}
                  >
                    <Disc side={side} size={18} />
                    <b>
                      {side.id
                        ? wide
                          ? side.name
                          : side.short || side.name
                        : wide
                          ? side.name
                          : "To come"}
                    </b>
                    {match.status === "scheduled" ? null : (
                      <span className="bx-num">
                        <Tick>{score[i] ?? ""}</Tick>
                      </span>
                    )}
                  </span>
                ))}
                <span className="bx-tie-foot">
                  {match.status === "scheduled" ? (
                    `${board.times.weekday(match.scheduledAt)} ${board.times.clock(match.scheduledAt)}`
                  ) : (
                    <>
                      {view.live ? <Ping /> : null}
                      <Dots dots={view.series} sides={view.sides} size={6} gap={3} fix />
                    </>
                  )}
                </span>
              </Link>
            );
          })}
        </>
      ) : null}
    </div>
  );
}
