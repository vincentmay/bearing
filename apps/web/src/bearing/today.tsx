import type { Atlas, Match } from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  type Listed,
  type Upcoming,
  bundle,
  elsewhere,
  leadMatch,
  recentForYou,
  upcomingForYou,
} from "../lib/view";
import { type Board, useBoard, useWide } from "./board";
import { Stops } from "./forms";
import { RoundRow, ScheduleRow } from "./lists";
import { type MatchView, plainName, stopsOf } from "./model";
import { until } from "./time";
import { AccountLink, Disc, DotRows, Dots, Mark, Ping, Score, Section, useReady } from "./ui";

/** How many other live matches Today lists before it points to the schedule. */
const LIVE_ROWS = 6;

function Name({ text, long }: { text: string; long: boolean }) {
  return (
    <b className="bx-name" data-long={long ? "" : undefined}>
      {text}
    </b>
  );
}

/**
 * The one larger card on the screen: the match to look at first. On a phone it carries the small
 * form for its game; with room, the names grow and the series becomes a line of stops.
 */
export function LeadCard({
  view,
  board,
  wide,
  step,
}: {
  view: MatchView;
  board: Board;
  wide: boolean;
  /** This card has just taken another one's place. */
  step: boolean;
}) {
  const [stepped] = useState(step);
  const [a, b] = view.sides;
  const scheduled = view.match.status === "scheduled";
  const meta = wide
    ? `${view.discipline.name} · ${view.tournament.name} · ${view.where}`
    : `${view.discipline.short} · ${view.event}`;
  const names = view.solo
    ? [wide ? view.tournament.name : view.where]
    : view.sides.map((s) => (wide ? s.name : s.label));
  // Both names are set at the same size, the smaller one if either is long.
  const long = names.some((n) => n.length > (wide ? 14 : 10));
  const cls = ["bx-card", "bx-press", wide && "bx-wide", stepped && "bx-step"]
    .filter(Boolean)
    .join(" ");
  return (
    <Link to="/match/$matchId" params={{ matchId: view.match.id }} className={cls}>
      <div className="bx-row bx-btw bx-meta">
        <span data-live={view.live ? "" : undefined}>
          {view.live ? <Ping /> : null}
          {view.status}
        </span>
        <span>{meta}</span>
      </div>
      {view.solo || !a || !b ? (
        <div className="bx-versus">
          <span>
            <Name text={names[0] ?? ""} long={long} />
          </span>
          <span className="bx-score bx-num">
            <Score view={view} times={board.times} />
          </span>
          <span />
        </div>
      ) : (
        <div className="bx-versus">
          <span>
            <Disc side={a} size={24} />
            <Name text={names[0] ?? ""} long={long} />
          </span>
          <span className="bx-score bx-num">
            <Score view={view} times={board.times} />
          </span>
          <span>
            <Name text={names[1] ?? ""} long={long} />
            <Disc side={b} size={24} />
          </span>
        </div>
      )}
      {/* With room the stops say what this line says; a single game has no stops. */}
      {wide && !scheduled && !view.solo && view.match.bestOf > 1 ? null : (
        <div className="bx-subs">
          {scheduled ? (
            <>
              <span />
              <span>{until(view.match.scheduledAt, board.now)}</span>
              <span />
            </>
          ) : (
            view.subs.map((s, i) => <span key={i}>{s}</span>)
          )}
        </div>
      )}
      {wide ? (
        <Stops view={view} stops={stopsOf(board.atlas, view, board.times)} />
      ) : scheduled ? null : view.solo ? (
        <Dots dots={view.rows[0] ?? []} sides={view.sides} size={14} gap={4} center fix wrap />
      ) : (
        <DotRows rows={view.rows} sides={view.sides} center />
      )}
    </Link>
  );
}

/** "If Vitality beat Aurora": a match that only happens for the viewer if something else goes their way. */
function condition(atlas: Atlas, item: Upcoming): string | undefined {
  const c = item.conditional;
  if (!c) return undefined;
  const who = plainName(atlas, c.competitorId);
  const team = atlas.competitor(c.competitorId)?.kind === "team";
  if (c.via.sides.length > 2) return `If ${who} ${team ? "go" : "goes"} through`;
  const other = c.via.sides.find((s) => s.competitorId !== c.competitorId);
  return `If ${who} ${team ? "beat" : "beats"} ${plainName(atlas, other?.competitorId)}`;
}

function NextRow({ item, board }: { item: Upcoming; board: Board }) {
  return <ScheduleRow match={item.match} board={board} day note={condition(board.atlas, item)} />;
}

/** A live or finished match, in the same row as everywhere else. */
export function ResultRow({ match, board }: { match: Match; board: Board }) {
  return <ScheduleRow match={match} board={board} day />;
}

/**
 * Followed results first, topped up with the latest others. The others are spread over events:
 * one round of a chess open ends forty games at once, and they would otherwise be the whole list.
 */
function earlier(atlas: Atlas, limit: number, skip?: string): Match[] {
  const mine = recentForYou(atlas, limit).filter((m) => m.id !== skip);
  const rest = atlas.recent().filter((m) => !mine.includes(m) && m.id !== skip);
  const taken = new Map<string, number>();
  const spread: Match[] = [];
  const left: Match[] = [];
  for (const m of rest) {
    const t = atlas.tournamentOf(m);
    const most = atlas.discipline(t.discipline).competitor === "team" ? 2 : 1;
    const n = taken.get(t.id) ?? 0;
    if (n < most) {
      taken.set(t.id, n + 1);
      spread.push(m);
    } else left.push(m);
  }
  return [...mine, ...spread, ...left].slice(0, limit);
}

/**
 * The match that leads the page. When it ends it stays a moment, saying so, before the next one
 * takes its place.
 */
function useLead(atlas: Atlas, pick: Match | undefined): Match | undefined {
  const [shown, setShown] = useState(pick?.id);
  const held = shown ? atlas.match(shown) : undefined;
  const ended = held?.status === "finished";
  useEffect(() => {
    if (pick?.id === shown) return;
    const timer = setTimeout(() => setShown(pick?.id), ended ? 3600 : 0);
    return () => clearTimeout(timer);
  }, [pick?.id, shown, ended]);
  return held ?? pick;
}

export function Today() {
  const board = useBoard();
  const { atlas, now, times } = board;
  const wide = useWide();
  const ready = useReady();
  const following = atlas.world.follows.length > 0;

  const mine = upcomingForYou(atlas);
  const open = atlas.upcoming().filter((m) => m.sides.every((s) => s.competitorId));
  const lead = useLead(atlas, leadMatch(atlas, mine));
  const alsoLive = atlas
    .live()
    .filter((m) => m.id !== lead?.id)
    .sort((x, y) => Number(atlas.isFollowed(y)) - Number(atlas.isFollowed(x)));
  const next: Upcoming[] = (mine.length ? mine : open.map((match) => ({ match })))
    .filter((u) => u.match.id !== lead?.id)
    .slice(0, 6);
  // With little of the viewer's own coming up, the page also says what else is on its way.
  const others =
    mine.length && next.length < 4
      ? bundle(
          atlas,
          elsewhere(atlas, new Set([lead?.id ?? "", ...next.map((u) => u.match.id)]), 5),
        ).slice(0, 5)
      : [];
  // The viewer's only upcoming match may already be the one in the lead.
  const leadIsMine = !!lead && mine.some((u) => u.match.id === lead.id);
  const live = bundle(atlas, alsoLive);
  const results = earlier(atlas, wide ? 6 : 5, lead?.id);

  const otherRow = (item: Listed) =>
    item.kind === "match" ? (
      <NextRow key={item.match.id} item={{ match: item.match }} board={board} />
    ) : (
      <RoundRow key={item.key} matches={item.matches} board={board} />
    );

  const nextList = (
    <Section label={next.length || !others.length || !leadIsMine ? "Coming up" : "Also coming up"}>
      <div className="bx-list">
        {next.map((u) => (
          <NextRow
            key={`${u.match.id}${u.conditional?.competitorId ?? ""}`}
            item={u}
            board={board}
          />
        ))}
        {next.length || leadIsMine ? null : (
          <p className="bx-empty">
            {following ? "Nothing is scheduled for anything you follow." : "Nothing is scheduled."}
          </p>
        )}
        {next.length || !leadIsMine ? null : others.map(otherRow)}
      </div>
      {others.length && (next.length || !leadIsMine) ? (
        <>
          <h2 className="bx-label" style={{ margin: "20px 8px 8px" }}>
            Also coming up
          </h2>
          <div className="bx-list">{others.map(otherRow)}</div>
        </>
      ) : null}
    </Section>
  );

  return (
    <>
      <header className="bx-head">
        <span>
          <span className="bx-phone" style={{ display: "flex" }}>
            <Mark />
          </span>
          <h1 className="bx-title">Today</h1>
        </span>
        <span>
          <span className="bx-date">{times.date(now)}</span>
          <AccountLink className="bx-phone" />
        </span>
      </header>

      {following ? null : (
        <p className="bx-note" style={{ margin: "12px 0 0" }}>
          You are not following anything yet, so this is the biggest of what is on.{" "}
          <Link to="/search">Find a team, player or event</Link> to make this page yours.
        </p>
      )}

      {lead ? (
        <LeadCard key={lead.id} view={board.view(lead)} board={board} wide={wide} step={ready} />
      ) : (
        <div className="bx-list" style={{ marginTop: 16 }}>
          <p className="bx-empty">Nothing is live and nothing is scheduled.</p>
        </div>
      )}

      {/* On a phone: also live, next, earlier. With room, next sits beside the other two. */}
      <div className="bx-cols">
        {wide ? nextList : null}
        <div>
          {alsoLive.length ? (
            <Section label="Also live">
              <div className="bx-list">
                {live
                  .slice(0, LIVE_ROWS)
                  .map((item) =>
                    item.kind === "match" ? (
                      <ResultRow key={item.match.id} match={item.match} board={board} />
                    ) : (
                      <RoundRow key={item.key} matches={item.matches} board={board} />
                    ),
                  )}
              </div>
              {live.length > LIVE_ROWS ? (
                <p className="bx-note">
                  And {live.length - LIVE_ROWS} more. <Link to="/schedule">All of today</Link>
                </p>
              ) : null}
            </Section>
          ) : null}
          {wide ? null : nextList}
          {/* The horizon: above it what is live or still to come, below it what is done. */}
          <p className="bx-now">
            <span>Now · {times.clock(now)}</span>
          </p>
          <Section label="Earlier">
            <div className="bx-list">
              {results.map((m) => (
                <ResultRow key={m.id} match={m} board={board} />
              ))}
              {results.length ? null : <p className="bx-empty">No results yet.</p>}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
