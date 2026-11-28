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

/** A plate: a little room above, a row for each side, and a foot for how the series went. */
const PAD = 6;
const ROW = 30;
const FOOT = 18;
const TILE = PAD + 2 * ROW + FOOT;
const TILE_MIN = 132;
const GAP = 12;
const HEAD = 30;

/**
 * Single elimination, drawn as a tree. Each round is a column; a match sits level with the
 * middle of the two that feed it, and a line runs from each of those into the row its winner
 * takes. Point at a team and its way through the bracket is drawn out, the rest stepping back.
 */
export function Bracket({
  stage,
  board,
  wide,
  columns,
  pointed: given,
  onPoint,
}: {
  stage: Stage;
  board: Board;
  wide: boolean;
  /** Lay the rounds out as if there were this many, so that two brackets share their columns. */
  columns?: number;
  /** The team pointed at, when two brackets trace the same team together. */
  pointed?: string;
  onPoint?: (id: string | undefined) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const width = useWidth(frame);
  const [own, setOwn] = useState<string>();
  const pointed = onPoint ? given : own;
  const setPointed = onPoint ?? setOwn;
  const rounds = stage.rounds
    .map((round) => ({
      round,
      matches: round.matchIds.flatMap((id) => board.atlas.match(id) ?? []),
    }))
    .filter((r) => r.matches.length);
  if (!rounds.length) return <p className="bx-e-empty">The bracket has not been drawn yet.</p>;

  const gutter = wide ? 32 : 16;
  const count = Math.max(rounds.length, columns ?? 0);
  // A plate is never narrower than a short name, a score and a mark need. Where the rounds do
  // not fit side by side at that width, the bracket is wider than its frame and is moved
  // sideways; squeezed plates that say "F..." tell nobody anything.
  const tileW = Math.max(TILE_MIN, (width - gutter * (count - 1)) / count);
  const canvas = count * tileW + gutter * (count - 1);
  // A full name needs room; a narrow column takes the short one.
  const roomy = wide && tileW >= 160;
  const placed = new Map<string, Placed>();
  rounds.forEach((round, column) => {
    const before = rounds[column - 1]?.matches ?? [];
    // A round is read in the order of the matches that feed it, so that no two lines cross.
    const fedBy = (m: Match) => {
      const at = before.findIndex((b) => b.next?.winner === m.id);
      return at < 0 ? undefined : (placed.get(before[at]!.id)?.y ?? at);
    };
    if (round.matches.every((m) => fedBy(m) !== undefined))
      round.matches = [...round.matches].sort((x, y) => fedBy(x)! - fedBy(y)!);
    const { matches } = round;
    matches.forEach((match, i) => {
      const fed = before.flatMap((m) => {
        const p = placed.get(m.id);
        return p && m.next?.winner === match.id ? [p] : [];
      });
      // Without links from the source, a match is fed by the two above it in order; or, in a
      // round as long as the one before (a lower bracket taking in those who dropped), by one.
      const guess =
        before.length === matches.length ? [before[i]] : [before[i * 2], before[i * 2 + 1]];
      const feeders = fed.length ? fed : guess.flatMap((m) => (m ? (placed.get(m.id) ?? []) : []));
      const wanted = feeders.length
        ? feeders.reduce((sum, p) => sum + p.y, 0) / feeders.length
        : HEAD + i * (TILE + GAP);
      // Never on top of the match above it in the same round.
      const above = matches[i - 1] ? placed.get(matches[i - 1]!.id) : undefined;
      const y = above ? Math.max(wanted, above.y + TILE + GAP) : wanted;
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
    const y1 = p.y + PAD + ROW;
    const x2 = next.x;
    const y2 = next.y + PAD + ROW / 2 + row * ROW;
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
    <div ref={frame} className="bx-bk-frame" data-wider={canvas > width + 1 ? "" : undefined}>
      <div
        className="bx-bk"
        style={{ height: width ? height : 240, width: width ? canvas : undefined }}
        data-tracing={pointed ? "" : undefined}
        onPointerLeave={() => setPointed(undefined)}
      >
        {width ? (
          <>
            <svg width={canvas} height={height} aria-hidden>
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
                className="bx-bk-round"
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
                  className="bx-bk-tie"
                  style={{ left: x, top: y, width: tileW }}
                  data-on={pointed && has(match, pointed) ? "" : undefined}
                >
                  {view.sides.map((side, i) => (
                    <span
                      key={i}
                      className="bx-bk-side"
                      data-lost={typeof w === "number" && w !== i ? "" : undefined}
                      data-open={side.id ? undefined : ""}
                      data-me={side.id && side.id === pointed ? "" : undefined}
                      onPointerEnter={(e) => {
                        if (e.pointerType === "mouse" && side.id) setPointed(side.id);
                      }}
                    >
                      <Disc side={side} size={20} />
                      <b>
                        {side.id
                          ? roomy
                            ? side.name
                            : side.short || side.name
                          : roomy
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
                  <span className="bx-bk-foot">
                    {match.status === "scheduled" ? (
                      `${board.times.weekday(match.scheduledAt)} ${board.times.clock(match.scheduledAt)}`
                    ) : (
                      <>
                        {view.live ? <Ping /> : null}
                        <Dots dots={view.series} sides={view.sides} size={7} gap={3} fix />
                      </>
                    )}
                  </span>
                </Link>
              );
            })}
          </>
        ) : null}
      </div>
    </div>
  );
}

const lowerRound = (name: string) => /lower/i.test(name);
const partName = (name: string) => {
  const rest = name
    .replace(/^(upper|lower)\s+bracket\s*/i, "")
    .replace(/\s+match$/i, "")
    .trim();
  return rest ? rest[0]!.toUpperCase() + rest.slice(1) : name;
};

/**
 * Double elimination: the upper bracket with whatever it leads to, and beneath it the lower
 * bracket, where a team that has lost once plays on. Both share their columns, and pointing at
 * a team traces it through both.
 */
export function DoubleBracket({
  stage,
  board,
  wide,
}: {
  stage: Stage;
  board: Board;
  wide: boolean;
}) {
  const [pointed, setPointed] = useState<string>();
  const filled = stage.rounds.filter((r) => r.matchIds.some((id) => board.atlas.match(id)));
  const part = (lower: boolean): Stage => ({
    ...stage,
    rounds: filled
      .filter((r) => lowerRound(r.name) === lower)
      .map((r) => ({ ...r, name: partName(r.name) })),
  });
  const [upper, lower] = [part(false), part(true)];
  if (!lower.rounds.length || !upper.rounds.length)
    return <Bracket stage={stage} board={board} wide={wide} />;
  const columns = Math.max(upper.rounds.length, lower.rounds.length);
  const shared = { board, wide, columns, pointed, onPoint: setPointed };
  return (
    <div className="bx-bk-double">
      <section>
        <h3 className="bx-bk-part">Upper bracket</h3>
        <Bracket stage={upper} {...shared} />
      </section>
      <section>
        <h3 className="bx-bk-part">Lower bracket</h3>
        <Bracket stage={lower} {...shared} />
      </section>
    </div>
  );
}
