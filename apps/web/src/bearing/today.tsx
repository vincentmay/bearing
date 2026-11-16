import type { Atlas, Match } from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { type Upcoming, featuredLive, recentForYou, upcomingForYou } from "../lib/view";
import { type Board, useBoard, useWide } from "./board";
import { Stops } from "./forms";
import { type MatchView, lineOf, plainName, stopsOf, titleOf } from "./model";
import { until } from "./time";
import { Disc, DotRows, Dots, Duo, Mark, Ping, Score, Section, Tick, useReady } from "./ui";

const SIX_HOURS = 6 * 60 * 60 * 1000;
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
        <span>
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
  const view = board.view(item.match);
  const { now, times } = board;
  const at = view.match.scheduledAt;
  const wait = Date.parse(at) - now;
  const today = times.dayKey(at) === times.dayKey(now);
  const cond = condition(board.atlas, item);
  const known = view.sides.filter((s) => s.id);
  // With a side still open, lead with the round and whoever is already waiting there.
  const title =
    !view.solo && known.length === 1 ? `${view.where} v ${known[0]!.name}` : titleOf(view);
  return (
    <Link to="/match/$matchId" params={{ matchId: view.match.id }} className="bx-next">
      <Duo sides={view.sides} progress={1 - wait / SIX_HOURS} />
      <span className="bx-time">
        {times.clock(at)}
        {today ? null : (
          <span className="bx-sub" style={{ display: "block", fontFamily: "var(--face)" }}>
            {times.weekday(at)} {times.dayOfMonth(at)}
          </span>
        )}
      </span>
      <span style={{ minWidth: 0 }}>
        <b>{title}</b>
        <span className="bx-sub">
          {cond ? `${cond} · ` : ""}
          {lineOf(view)}
        </span>
      </span>
      <span className="bx-right">{until(at, now).replace("in ", "")}</span>
    </Link>
  );
}

/** A live or finished match in one row: who, the score, and its dots. */
export function ResultRow({ view }: { view: MatchView }) {
  const [a, b] = view.sides;
  const live = view.live;
  const score = view.headline.length === 2 ? view.headline.join("–") : undefined;
  const state = view.status.replace(/^Live · /, "");
  // A long line of rounds is cut to the latest few so the row keeps its shape.
  const dots = view.series.slice(-10);
  return (
    <Link to="/match/$matchId" params={{ matchId: view.match.id }} className="bx-result">
      <span>
        <b>
          {view.solo ? (
            `${view.event} · ${view.standings[0]?.side.name ?? ""} ${live ? "leads" : "won"}`
          ) : (
            <>
              {a?.name} {score ? <Tick>{score}</Tick> : "v"} {b?.name}
            </>
          )}
        </b>
        <span className="bx-sub">
          {view.discipline.short} ·{" "}
          {live
            ? `${view.game && view.discipline.id === "cs2" ? `${view.game.label} · ` : ""}${view.solo ? `${view.where} · round ${view.game?.cup?.round ?? ""}` : state}`
            : `${view.event} · ${view.where}`}
        </span>
      </span>
      <Dots dots={dots} sides={view.sides} size={11} fix />
    </Link>
  );
}

/** Followed results first, topped up with the latest others. */
function earlier(atlas: Atlas, limit: number, skip?: string): Match[] {
  const mine = recentForYou(atlas, limit);
  const rest = atlas.recent().filter((m) => !mine.includes(m));
  return [...mine, ...rest].filter((m) => m.id !== skip).slice(0, limit);
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
  const lead = useLead(
    atlas,
    featuredLive(atlas) ?? mine.find((u) => !u.conditional)?.match ?? open[0],
  );
  const alsoLive = atlas
    .live()
    .filter((m) => m.id !== lead?.id)
    .sort((x, y) => Number(atlas.isFollowed(y)) - Number(atlas.isFollowed(x)));
  const next: Upcoming[] = (mine.length ? mine : open.map((match) => ({ match })))
    .filter((u) => u.match.id !== lead?.id)
    .slice(0, 6);
  const results = earlier(atlas, wide ? 6 : 5, lead?.id);

  const nextList = (
    <Section label="Next">
      <div className="bx-list">
        {next.map((u) => (
          <NextRow
            key={`${u.match.id}${u.conditional?.competitorId ?? ""}`}
            item={u}
            board={board}
          />
        ))}
        {next.length ? null : (
          <p className="bx-empty">
            {following ? "Nothing is scheduled for anything you follow." : "Nothing is scheduled."}
          </p>
        )}
      </div>
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
          <Link
            to="/settings"
            className="bx-iconbtn bx-phone"
            aria-label="Settings"
            title="Settings"
          >
            <Settings size={18} />
          </Link>
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
                {alsoLive.slice(0, LIVE_ROWS).map((m) => (
                  <ResultRow key={m.id} view={board.view(m)} />
                ))}
              </div>
              {alsoLive.length > LIVE_ROWS ? (
                <p className="bx-note">
                  And {alsoLive.length - LIVE_ROWS} more being played.{" "}
                  <Link to="/schedule">All of today</Link>
                </p>
              ) : null}
            </Section>
          ) : null}
          {wide ? null : nextList}
          <Section label="Earlier">
            <div className="bx-list">
              {results.map((m) => (
                <ResultRow key={m.id} view={board.view(m)} />
              ))}
              {results.length ? null : <p className="bx-empty">No results yet.</p>}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
