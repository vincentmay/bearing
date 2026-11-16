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

/** A line of stops, in the same drawing as the series on a match page. */
export function StopLine({ stops }: { stops: LineStop[] }) {
  if (!stops.length) return null;
  return (
    <div
      className="bx-stops bx-stops-wrap"
      style={{
        gridTemplateColumns: stops
          .map((s) => `minmax(0, ${s.weight ?? (s.kind === "now" ? 2.2 : 1)}fr)`)
          .join(" "),
      }}
    >
      {stops.map((s, i) => (
        <div
          key={i}
          className={`bx-stop bx-stop-${s.kind}${i === stops.length - 1 ? " bx-stop-last" : ""}${s.kind === "now" && !s.inner ? " bx-stop-tight" : ""}`}
          style={
            { "--sf": s.fill ?? (s.kind === "done" ? "var(--ground)" : undefined) } as CSSProperties
          }
        >
          {s.inner}
          {s.to ? (
            <Go to={s.to}>
              <b>{s.label}</b>
            </Go>
          ) : (
            <b>{s.label}</b>
          )}
          <span className="bx-stop-sub">{s.sub}</span>
        </div>
      ))}
    </div>
  );
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
  const columns = `minmax(0, 1fr) repeat(${rows.length}, minmax(14px, 30px)) 34px`;
  return (
    <div className="bx-cross" style={{ gridTemplateColumns: columns }}>
      <span />
      {rows.map((r) => (
        <span key={r.competitorId} className="bx-cross-head" title={atlas.name(r.competitorId)}>
          {r.rank === rows.indexOf(r) + 1 ? r.rank : rows.indexOf(r) + 1}
        </span>
      ))}
      <span className="bx-cross-head">Pts</span>
      {rows.map((r) => [
        <Go
          key={r.competitorId}
          to={{ kind: "player", id: r.competitorId }}
          className="bx-cross-name"
        >
          <span className="bx-mono bx-sub">{rows.indexOf(r) + 1}</span>
          <Flag country={atlas.player(r.competitorId)?.country} />
          <b>{atlas.name(r.competitorId)}</b>
        </Go>,
        ...rows.map((o) => {
          const res = o.competitorId === r.competitorId ? undefined : r.versus.get(o.competitorId);
          const cls =
            res === undefined
              ? "bx-cell-self"
              : res === null
                ? "bx-cell-none"
                : res === 1
                  ? "bx-cell-win"
                  : res === 0.5
                    ? "bx-cell-draw"
                    : "bx-cell-loss";
          const words =
            res === undefined || res === null
              ? undefined
              : `${atlas.name(r.competitorId)} ${res === 1 ? "beat" : res === 0.5 ? "drew with" : "lost to"} ${atlas.name(o.competitorId)}`;
          return (
            <span key={`${r.competitorId}${o.competitorId}`} className="bx-cell" title={words}>
              <i className={cls} />
            </span>
          );
        }),
        <span key={`p${r.competitorId}`} className="bx-mono bx-num bx-cross-pts">
          {formatPoints(r.points)}
        </span>,
      ])}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Cup: heats of four, the top two go through

export function Heat({ match, board, through }: { match: Match; board: Board; through: number }) {
  const view = board.view(match);
  const decided = match.status === "finished";
  return (
    <Link to="/match/$matchId" params={{ matchId: match.id }} className="bx-heat bx-press">
      <span className="bx-gamehead">
        <b>{heat(board.atlas, match)}</b>
        <span className="bx-sub bx-mono" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {view.live ? <Ping /> : null}
          {view.live
            ? `round ${view.game?.cup?.round ?? ""}`
            : decided
              ? "final"
              : `${board.times.clock(match.scheduledAt)} · ${until(match.scheduledAt, board.now)}`}
        </span>
      </span>
      {view.standings.map(({ side, index, points }, place) => (
        <span key={index} className="bx-lane" data-open={side.id ? undefined : ""}>
          <span>
            <Disc side={side} size={16} />
            {side.name}
          </span>
          <span className="bx-sub">{decided && place < through ? "through" : ""}</span>
          <span>{match.status === "scheduled" ? "" : formatPoints(points)}</span>
        </span>
      ))}
    </Link>
  );
}
