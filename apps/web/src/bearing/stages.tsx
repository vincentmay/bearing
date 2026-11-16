import {
  type Follow,
  type Match,
  type Stage,
  type Tournament,
  formatPoints,
  roundRobinStandings,
  swissRecords,
  winnerOf,
} from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import type { Board } from "./board";
import { Go } from "./links";
import { type Dot, type MatchView, heat, sideOf } from "./model";
import { until } from "./time";
import { Disc, Dots, Ping, Tick } from "./ui";

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
// Elimination: a bracket

/** One match in a bracket: both sides with their score, and the dots of the series under them. */
function Tie({ view, board, wide }: { view: MatchView; board: Board; wide: boolean }) {
  const { match } = view;
  const w = winnerOf(match);
  const score = view.headline.length === 2 ? view.headline : [];
  return (
    <Link to="/match/$matchId" params={{ matchId: match.id }} className="bx-tie bx-press">
      {view.sides.map((side, i) => (
        <span
          key={i}
          className="bx-tie-side"
          data-lost={typeof w === "number" && w !== i ? "" : undefined}
          data-open={side.id ? undefined : ""}
        >
          <Disc side={side} size={16} />
          <b>
            {side.id ? (wide ? side.name : side.short || side.name) : wide ? side.name : "To come"}
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
            <Dots dots={view.series} sides={view.sides} size={7} gap={3} fix />
          </>
        )}
      </span>
    </Link>
  );
}

/**
 * Single elimination, drawn as a tree. Each round is a column and the matches of a round are
 * spread evenly, so a match sits between the two that feed it and the joining lines can be
 * drawn from their positions alone.
 */
export function Bracket({ stage, board, wide }: { stage: Stage; board: Board; wide: boolean }) {
  const rounds = stage.rounds
    .map((round) => ({
      round,
      matches: round.matchIds.flatMap((id) => board.atlas.match(id) ?? []),
    }))
    .filter((r) => r.matches.length);
  if (!rounds.length) return <p className="bx-empty">The bracket has not been drawn yet.</p>;
  const columns = rounds.map(() => "minmax(0, 1fr)").join(wide ? " 28px " : " 12px ");
  return (
    <div className="bx-bracket" style={{ gridTemplateColumns: columns }}>
      {rounds.map(({ round, matches }, c) => {
        const next = rounds[c + 1];
        return [
          <h3 key={`h${round.id}`} className="bx-label" style={{ gridColumn: c * 2 + 1 }}>
            {wide ? round.name : round.short}
          </h3>,
          <div key={round.id} className="bx-round" style={{ gridColumn: c * 2 + 1 }}>
            {matches.map((m) => (
              <Tie key={m.id} view={board.view(m)} board={board} wide={wide} />
            ))}
          </div>,
          next ? (
            <svg
              key={`l${round.id}`}
              className="bx-joins"
              style={{ gridColumn: c * 2 + 2 }}
              viewBox="0 0 10 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              {matches.map((m, i) => {
                const target = next.matches.findIndex((n) => n.id === m.next?.winner);
                const j = target >= 0 ? target : Math.floor(i / 2);
                const from = ((i + 0.5) / matches.length) * 100;
                const to = ((j + 0.5) / next.matches.length) * 100;
                return (
                  <path
                    key={m.id}
                    d={`M0 ${from}H5V${to}H10`}
                    data-done={m.status === "finished" ? "" : undefined}
                  />
                );
              })}
            </svg>
          ) : null,
        ];
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Swiss: every team's path through the rounds

export function SwissTable({
  stage,
  tournament,
  board,
}: {
  stage: Stage;
  tournament: Tournament;
  board: Board;
}) {
  const { atlas } = board;
  const records = swissRecords(atlas, stage, tournament.participantIds);
  const rounds = stage.rounds.length;
  const need = stage.rules?.winsToAdvance ?? 3;
  return (
    <>
      {records.map((r) => {
        const side = sideOf(atlas, r.competitorId);
        const dots: Dot[] = Array.from({ length: rounds }, (_, i): Dot => {
          const result = r.path[i];
          if (result === "W") return { k: "won", side: 0, label: `Round ${i + 1} · won` };
          if (result === "L") return { k: "shared", label: `Round ${i + 1} · lost` };
          return { k: "open" };
        });
        return (
          <Go key={r.competitorId} to={{ kind: "team", id: r.competitorId }} className="bx-swiss">
            <span className="bx-row" style={{ gap: 9, minWidth: 0 }}>
              <Disc side={side} size={20} />
              <b>{side.name}</b>
            </span>
            <span
              className="bx-dots bx-fix"
              style={{ "--ds": "11px", "--dg": "4px" } as CSSProperties}
            >
              {dots.map((d, i) => (
                <i
                  key={i}
                  className={
                    d.k === "won" ? undefined : d.k === "shared" ? "bx-dot-lost" : "bx-dot-none"
                  }
                  style={d.k === "won" ? { background: side.color } : undefined}
                  title={"label" in d ? d.label : undefined}
                />
              ))}
            </span>
            <span className="bx-mono bx-num">
              {r.wins}–{r.losses}
            </span>
            <span className="bx-sub">
              {r.status === "advanced"
                ? "through"
                : r.status === "eliminated"
                  ? "out"
                  : r.wins + r.losses
                    ? `needs ${need - r.wins}`
                    : ""}
            </span>
          </Go>
        );
      })}
    </>
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
