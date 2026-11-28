import {
  type Follow,
  type Match,
  type Stage,
  type Tournament,
  formatPoints,
  roundRobinStandings,
} from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import type { Board } from "./board";
import { Go } from "./links";
import { heat } from "./model";
import { until } from "./time";
import { Disc, Flag, Ping } from "./ui";

/** One stop on a line: an event in a team's year, a team in a player's career. */
export interface LineStop {
  kind: "done" | "now" | "later";
  label: string;
  sub: string;
  /** What the stop is filled with; empty for an outline. */
  fill?: string;
  /** How much room the stop takes, relative to the others. */
  weight?: number;
  /** What the stop opens into, drawn on the line after it. */
  inner?: ReactNode;
  /** The page the stop leads to. */
  to?: Pick<Follow, "kind" | "id">;
}

// ---------------------------------------------------------------------------------------------
// Round robin: everyone against everyone, as a table

export function CrossTable({
  stage,
  tournament,
  board,
}: {
  stage: Stage;
  tournament: Tournament;
  board: Board;
}) {
  const { atlas } = board;
  const rows = roundRobinStandings(atlas, stage, tournament.participantIds);
  return (
    <div className="bx-xt" style={{ "--n": rows.length } as CSSProperties}>
      <span className="bx-xt-head" />
      <span className="bx-xt-head" />
      {rows.map((r, i) => (
        <span key={r.competitorId} className="bx-xt-head" title={atlas.name(r.competitorId)}>
          {i + 1}
        </span>
      ))}
      <span className="bx-xt-head" data-end="">
        Pts
      </span>
      {rows.map((r, i) => (
        <Go
          key={r.competitorId}
          to={{ kind: "player", id: r.competitorId }}
          className="bx-xt-row"
          style={{ gridColumn: "1 / -1" } as CSSProperties}
        >
          <span className="bx-xt-n">{i + 1}</span>
          <span className="bx-xt-name">
            <Flag country={atlas.player(r.competitorId)?.country} keep />
            <b>{atlas.name(r.competitorId)}</b>
          </span>
          {rows.map((o) => {
            const res =
              o.competitorId === r.competitorId ? undefined : r.versus.get(o.competitorId);
            const k =
              res === undefined
                ? "self"
                : res === null
                  ? "none"
                  : res === 1
                    ? "win"
                    : res === 0.5
                      ? "draw"
                      : "loss";
            const words =
              res === undefined || res === null
                ? undefined
                : `${atlas.name(r.competitorId)} ${res === 1 ? "beat" : res === 0.5 ? "drew with" : "lost to"} ${atlas.name(o.competitorId)}`;
            return (
              <span key={o.competitorId} className="bx-xt-cell" title={words}>
                <i data-k={k} />
              </span>
            );
          })}
          <span className="bx-xt-pts">{formatPoints(r.points)}</span>
        </Go>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Cup: heats of four, the top two go through

export function Heat({ match, board, through }: { match: Match; board: Board; through: number }) {
  const view = board.view(match);
  const decided = match.status === "finished";
  return (
    <Link
      to="/match/$matchId"
      params={{ matchId: match.id }}
      className="bx-ht"
      data-live={view.live ? "" : undefined}
    >
      <span className="bx-ht-head">
        <b>{heat(board.atlas, match)}</b>
        <span>
          {view.live ? <Ping /> : null}
          {view.live
            ? `Round ${view.game?.cup?.round ?? ""}`
            : decided
              ? "Final"
              : `${board.times.clock(match.scheduledAt)} · ${until(match.scheduledAt, board.now)}`}
        </span>
      </span>
      {view.standings.map(({ side, index, points }, place) => (
        <span
          key={index}
          className="bx-ht-lane"
          data-open={side.id ? undefined : ""}
          data-through={decided && place < through ? "" : undefined}
        >
          <Disc side={side} size={22} />
          <b>{side.name}</b>
          <small>{decided && place < through ? "through" : ""}</small>
          <span>{match.status === "scheduled" ? "" : formatPoints(points)}</span>
        </span>
      ))}
    </Link>
  );
}
