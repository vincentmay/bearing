import "./chess.css";

import { type Match, formatPoints, seriesScore } from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef } from "react";
import type { Board } from "../board";
import type { SideView } from "../model";
import { Disc, Flag, Ping } from "../ui";

/** "Game 6 | Rapid" is game 6, a rapid game. */
export function gameName(label: string, index: number): { number: string; kind?: string } {
  const [first, kind] = label.split("|").map((part) => part.trim());
  const number = /^(?:Game|Round|Partie)\s+(\d+)$/i.exec(first ?? "")?.[1];
  return { number: number ?? String(index + 1), kind: kind || (number ? undefined : first) };
}

/** What one game gave one side of the match. */
function gave(match: Match, index: number, side: number): number | undefined {
  const game = match.games[index];
  if (!game || game.status !== "finished" || game.winner === undefined) return undefined;
  if (game.points) return game.points[side] ?? 0;
  return game.winner === "draw" ? 0.5 : game.winner === side ? 1 : 0;
}

/** A kind of game written over the columns it covers: whole where it fits, initials where not. */
function short(kind: string, columns: number): string {
  if (kind.length <= columns * 4) return kind;
  const initials = kind
    .split(/\s+/)
    .map((word) => word[0])
    .join("");
  return initials.length > 1 ? initials : kind.slice(0, 3);
}

/**
 * A match of several games as chess has always written one down: a line for each player, a
 * column for each game with what it gave them, and the sum at the end. Above the columns,
 * the kind of game where the event names one (blitz, rapid, classical), once for each run
 * of the same kind. The game being played has a dot; the ones to come are left open.
 *
 * On an event's page it is a way to the match. On the match's own page its columns are
 * pressed to choose the game the board shows.
 */
export function SeriesTable({
  match,
  sides,
  board,
  picked,
  onPick,
}: {
  match: Match;
  sides: SideView[];
  board: Board;
  /** The game the board shows, on the match's own page. */
  picked?: number;
  onPick?: (index: number) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const total = seriesScore(match);
  const columns = Math.max(match.bestOf, match.games.length);
  const live = match.games.findIndex((g) => g.status === "live");
  const begun = match.games.findLastIndex((g) => g.status !== "scheduled");
  const current = picked ?? (live >= 0 ? live : begun);
  const over = match.status === "finished";
  const lead = total[0] === total[1] ? undefined : total[0]! > total[1]! ? 0 : 1;

  // On a narrow screen the columns are pushed along; they start where the match stands.
  useEffect(() => {
    const box = strip.current;
    const cell = box?.querySelector<HTMLElement>("[data-now]");
    if (!box || !cell || box.scrollWidth <= box.clientWidth) return;
    const [inner, outer] = [cell.getBoundingClientRect(), box.getBoundingClientRect()];
    box.scrollLeft += inner.left - outer.left - outer.width / 2 + inner.width / 2;
  }, [current]);

  const cells = Array.from({ length: columns }, (_, i) => i);
  const names = cells.map((i) => (match.games[i] ? gameName(match.games[i].label, i) : undefined));
  /** How many columns in a row, from this one, are games of the same kind. */
  const run = (from: number) => {
    let n = 1;
    while (names[from + n]?.kind === names[from]?.kind) n++;
    return n;
  };
  const head = (i: number): ReactNode => {
    const name = names[i];
    const fresh = name?.kind && name.kind !== names[i - 1]?.kind;
    return (
      <>
        <i title={name?.kind}>{fresh ? short(name.kind!, run(i)) : ""}</i>
        {name?.number ?? i + 1}
      </>
    );
  };

  return (
    <>
      <div className="bx-series-who">
        <span />
        {[0, 1].map((s) => {
          const side = sides[s];
          const player = side?.id ? board.atlas.player(side.id) : undefined;
          return (
            <span
              key={s}
              className="bx-series-name"
              data-lost={over && lead !== undefined && lead !== s ? "" : undefined}
            >
              {side ? <Disc side={side} size={22} /> : null}
              <b>{side?.name ?? "TBD"}</b>
              <Flag country={player?.country} />
            </span>
          );
        })}
      </div>
      <div className="bx-series-games" ref={strip}>
        <div className="bx-series-head">
          {cells.map((i) =>
            onPick ? (
              <button
                key={i}
                type="button"
                data-now={i === current ? "" : undefined}
                disabled={!match.games[i] || match.games[i].status === "scheduled"}
                aria-label={match.games[i]?.label ?? `Game ${i + 1}`}
                aria-current={i === current ? "true" : undefined}
                onClick={() => onPick(i)}
              >
                {head(i)}
              </button>
            ) : (
              <span key={i} data-now={i === current ? "" : undefined}>
                {head(i)}
              </span>
            ),
          )}
        </div>
        {[0, 1].map((s) => (
          <div key={s} className="bx-series-lane">
            {cells.map((i) => {
              const game = match.games[i];
              const points = gave(match, i, s);
              const other = gave(match, i, 1 - s);
              const both = points !== undefined && other !== undefined;
              return (
                <span
                  key={i}
                  className="bx-num"
                  data-now={i === current ? "" : undefined}
                  data-won={both && points > other ? "" : undefined}
                  data-lost={both && points < other ? "" : undefined}
                  data-pick={onPick && game && game.status !== "scheduled" ? "" : undefined}
                  onClick={
                    onPick && game && game.status !== "scheduled" ? () => onPick(i) : undefined
                  }
                >
                  {game?.status === "live" ? (
                    s === 0 ? (
                      <Ping />
                    ) : null
                  ) : points === undefined ? (
                    "·"
                  ) : (
                    formatPoints(points)
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="bx-series-total">
        <span>{over ? "Final" : match.status === "live" ? "Live" : ""}</span>
        {[0, 1].map((s) => (
          <b key={s} className="bx-num" data-lead={lead === s ? "" : undefined}>
            {formatPoints(total[s] ?? 0)}
          </b>
        ))}
      </div>
    </>
  );
}

/**
 * The matches of an event played as matches: the ones being played first, then the ones to
 * come, then the ones that are over, each in the order the event lists them.
 */
export function SeriesList({ matches, board }: { matches: Match[]; board: Board }) {
  const rank = (m: Match) => (m.status === "live" ? 0 : m.status === "scheduled" ? 1 : 2);
  const inOrder = matches
    .map((match, index) => ({ match, index }))
    .sort((x, y) => rank(x.match) - rank(y.match) || x.index - y.index);
  return (
    <div className="bx-serieslist">
      {inOrder.map(({ match }) => (
        <Link
          key={match.id}
          to="/match/$matchId"
          params={{ matchId: match.id }}
          className="bx-series"
          data-live={match.status === "live" ? "" : undefined}
        >
          <SeriesTable match={match} sides={board.view(match).sides} board={board} />
        </Link>
      ))}
    </div>
  );
}
