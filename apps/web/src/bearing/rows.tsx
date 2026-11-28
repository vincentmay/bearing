import { type Match, winnerOf } from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import { Rows3, Star, Users } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { type Listed, scoreLine } from "../lib/view";
import type { Board } from "./board";
import { Go } from "./links";
import { bestOf } from "./model";
import { until } from "./time";
import { Disc, Ping, Tick } from "./ui";

/** A plain disc with a sign in it, where there is no team to show: a field, a whole round. */
function Sign({ children }: { children: ReactNode }) {
  return (
    <span className="bx-disc bx-disc-plain" style={{ "--s": "24px" } as CSSProperties} aria-hidden>
      {children}
    </span>
  );
}

/**
 * One match as a large row: when, who against whom (with the score once there is one), and in
 * small where it belongs. The whole row leads to the match. A star marks what the viewer follows.
 */
export function MatchRow({
  match,
  board,
  day = false,
  inEvent = false,
  note,
}: {
  match: Match;
  board: Board;
  /** Say which day it is on, for lists that span several. */
  day?: boolean;
  /** Shown on the page of its own event: the event's name is left out. */
  inEvent?: boolean;
  /** Something to say first in the small line: "If Vitality beat Aurora". */
  note?: string;
}) {
  const view = board.view(match);
  const { now, times, atlas } = board;
  const live = match.status === "live";
  const done = match.status === "finished";
  const elsewhen = day && times.dayKey(match.scheduledAt) !== times.dayKey(now);
  const won = done ? winnerOf(match) : undefined;
  // A series is told by its games won; a single game by its own score while it is played.
  const marks =
    view.solo || (match.status === "scheduled" && !view.resumes)
      ? undefined
      : match.bestOf > 1 || done
        ? scoreLine(match).split("–")
        : view.headline.length === 2
          ? view.headline
          : undefined;
  const detail = live ? view.status.replace(/^Live(?: · )?/, "") : "";
  const sub = (
    inEvent
      ? [note, match.bestOf > 1 ? bestOf(match.bestOf) : "", view.solo ? "" : view.where, detail]
      : [view.discipline.short, note, view.event, view.solo ? "" : view.where, detail]
  )
    .filter(Boolean)
    .join(" · ")
    .replaceAll(" | ", " · ");
  const left = Date.parse(match.scheduledAt) - now;
  // Starting within the hour is one of Sunrise's jobs.
  const soon = !live && !done && left <= 3_600_000 && left > -900_000;
  const state = live ? "live" : done ? "done" : soon ? "soon" : "next";
  const [a, b] = view.sides;
  const known = view.sides.filter((s) => s.id).map((s) => s.name);
  const lost = (i: number) => (typeof won === "number" && won !== i ? "" : undefined);
  return (
    <div className="bx-rw" data-s={state}>
      <Link
        to="/match/$matchId"
        params={{ matchId: match.id }}
        className="bx-rw-go"
        aria-label={
          view.solo
            ? `${view.where}, ${view.tournament.name}`
            : `${a?.name ?? ""} against ${b?.name ?? ""}, ${view.tournament.name}`
        }
      />
      <div className="bx-rw-t">
        <b>
          {live ? <Ping /> : null}
          {live
            ? "Live"
            : elsewhen
              ? `${times.weekday(match.scheduledAt)} ${times.dayOfMonth(match.scheduledAt)}`
              : times.clock(match.scheduledAt)}
        </b>
        <span>
          {live
            ? `since ${times.clock(match.scheduledAt)}`
            : done
              ? "Final"
              : elsewhen
                ? times.clock(match.scheduledAt)
                : until(match.scheduledAt, now)}
        </span>
      </div>
      <div>
        {view.solo || !a || !b ? (
          <div className="bx-rw-vs">
            <Sign>
              <Users size={13} strokeWidth={2.4} />
            </Sign>
            <span>{view.where}</span>
            {done ? <small>{view.standings[0]?.side.name ?? ""} won</small> : null}
          </div>
        ) : (
          <div className="bx-rw-vs">
            <Disc side={a} size={24} />
            <span data-lost={lost(0)}>{a.name}</span>
            {marks ? (
              <b>
                {live ? <Tick>{marks[0] ?? ""}</Tick> : marks[0]}–
                {live ? <Tick>{marks[1] ?? ""}</Tick> : marks[1]}
              </b>
            ) : (
              <small>vs</small>
            )}
            <span data-lost={lost(1)}>{b.name}</span>
            <Disc side={b} size={24} />
          </div>
        )}
        <div className="bx-rw-ev">
          {view.solo && known.length ? `${known.slice(0, 4).join(", ")} · ` : ""}
          {sub}
        </div>
      </div>
      {atlas.isFollowed(match) ? (
        <span className="bx-rw-star" aria-pressed="true" role="img" aria-label="You follow this">
          <Star size={19} aria-hidden />
        </span>
      ) : (
        <span />
      )}
    </div>
  );
}

/** A whole round of an event on one row: how many games, and how many are being played. */
export function RoundLine({
  matches,
  board,
  inEvent,
}: {
  matches: Match[];
  board: Board;
  /** Shown under its event's name, which then is not said again. */
  inEvent?: boolean;
}) {
  const first = matches[0]!;
  const { atlas, times } = board;
  const tournament = atlas.tournamentOf(first);
  const round = atlas.roundOf(first)?.name ?? atlas.stageOf(first).name;
  const live = matches.filter((m) => m.status === "live").length;
  const done = matches.filter((m) => m.status === "finished").length;
  const games = `${matches.length} games`;
  const state =
    live === matches.length
      ? `${games} being played`
      : live
        ? `${games}, ${live} being played`
        : done === matches.length
          ? `${games}, all played`
          : done
            ? `${games}, ${done} played`
            : games;
  return (
    <div className="bx-rw" data-s={live ? "live" : done === matches.length ? "done" : "next"}>
      <Go
        to={{ kind: "tournament", id: tournament.id }}
        className="bx-rw-go"
        aria-label={`${tournament.name}, ${round}`}
      >
        {""}
      </Go>
      <div className="bx-rw-t">
        <b>
          {live ? <Ping /> : null}
          {live ? "Live" : times.clock(first.scheduledAt)}
        </b>
        <span>
          {live
            ? `since ${times.clock(first.scheduledAt)}`
            : done === matches.length
              ? "Final"
              : until(first.scheduledAt, board.now)}
        </span>
      </div>
      <div>
        <div className="bx-rw-vs">
          <Sign>
            <Rows3 size={13} strokeWidth={2.4} />
          </Sign>
          <span>{inEvent ? round : tournament.name}</span>
        </div>
        <div className="bx-rw-ev">
          {inEvent
            ? state
            : `${atlas.discipline(tournament.discipline).short} · ${round} · ${state}`}
        </div>
      </div>
      {matches.some((m) => atlas.isFollowed(m)) ? (
        <span className="bx-rw-star" aria-pressed="true" role="img" aria-label="You follow this">
          <Star size={19} aria-hidden />
        </span>
      ) : (
        <span />
      )}
    </div>
  );
}

/** A match or a folded round, whichever the list holds at this place. */
export function ListedRow({ item, board }: { item: Listed; board: Board }) {
  return item.kind === "match" ? (
    <MatchRow match={item.match} board={board} day />
  ) : (
    <RoundLine matches={item.matches} board={board} />
  );
}
