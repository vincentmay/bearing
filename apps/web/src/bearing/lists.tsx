import {
  type Atlas,
  type Follow,
  type Match,
  type Tournament,
  champion,
  dateRange,
  form,
  winnerOf,
} from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Gamepad2, Plus, Trophy, Users } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { usePrefs } from "../lib/prefs";
import { bundle, didWin, scoreLine, upcomingForYou } from "../lib/view";
import { type Board, useBoard, useWide } from "./board";
import { Go } from "./links";
import { type Dot, type SideView, heat, inkOn, plainName, sideOf } from "./model";
import { MatchRow, RoundLine } from "./rows";
import { CardSky } from "./sky";
import { type Times, until } from "./time";
import { Disc, Dots, EventMark, Flag, FollowStar, Ping, Tick } from "./ui";
import { useFidePlayer } from "../lib/fide";
import "./pages-lists.css";

const DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------------------------
// Schedule

const SCOPES = [
  { value: "all", label: "Everything" },
  { value: "mine", label: "What I follow" },
] as const;

const dayNumber = (date: string) => Math.round(Date.parse(`${date}T12:00:00Z`) / DAY);

/** How many small dots stand under a day for its number of matches: a busy day has three. */
const busy = (count: number) => (count === 0 ? 0 : count <= 2 ? 1 : count <= 6 ? 2 : 3);

/**
 * The chosen day on the sky, large, with a strip of days under it that can be moved a week at a
 * time, as far as anyone likes. Under the card each event that plays that day with its matches
 * in time order, and beside them the events that are running or about to begin, since an event
 * is longer than its matches.
 */
export function Schedule() {
  const board = useBoard();
  const { atlas, now, times } = board;
  const { zone } = usePrefs();
  const wide = useWide();
  const [scope, setScope] = useState<(typeof SCOPES)[number]["value"]>("all");
  const [offset, setOffset] = useState(0);
  const span = wide ? 10 : 7;
  // The first day shown; today sits a few days in, so that yesterday is at hand.
  const lead = wide ? 3 : 2;
  const [first, setFirst] = useState<number>();
  const start = first ?? -lead;
  const offsets = Array.from({ length: span }, (_, i) => start + i);
  const day = now + offset * DAY;
  const key = times.dayKey(day);
  const move = (by: number) => {
    setFirst(start + by);
    setOffset(offset + by);
  };
  const show = (to: number) => {
    setOffset(to);
    if (to < start || to >= start + span) setFirst(to - lead);
  };
  const today = () => {
    setFirst(undefined);
    setOffset(0);
  };
  const longDay = useMemo(
    () => new Intl.DateTimeFormat(undefined, { weekday: "long", timeZone: zone ?? undefined }),
    [zone],
  );

  // The chosen day stays in sight in the strip, which scrolls on a phone.
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = strip.current;
    const on = box?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!box || !on || box.scrollWidth <= box.clientWidth) return;
    box.scrollTo({
      left: on.offsetLeft - (box.clientWidth - on.offsetWidth) / 2,
      behavior: "smooth",
    });
  }, [offset, start]);

  // What the viewer follows includes matches a followed team only reaches by winning first.
  const maybe = new Set(upcomingForYou(atlas).map((u) => u.match.id));
  const mine = (m: Match) => atlas.isFollowed(m) || maybe.has(m.id);
  const wanted = atlas.world.matches.filter((m) => scope === "all" || mine(m));
  const perDay = new Map<string, number>();
  const ownPerDay = new Map<string, number>();
  for (const m of wanted) {
    const k = times.dayKey(m.scheduledAt);
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
    if (mine(m)) ownPerDay.set(k, (ownPerDay.get(k) ?? 0) + 1);
  }
  const matches = wanted
    .filter((m) => times.dayKey(m.scheduledAt) === key)
    .sort((x, y) => x.scheduledAt.localeCompare(y.scheduledAt));
  const own = ownPerDay.get(key) ?? 0;
  // On a day with nothing, the way to the next day that has something.
  const later = [...perDay.keys()].filter((k) => k > key).sort()[0];

  // The day's matches, event by event, in the order the events begin their day.
  const groups = new Map<string, Match[]>();
  for (const m of matches) groups.set(m.tournamentId, [...(groups.get(m.tournamentId) ?? []), m]);

  const followed = new Set(
    atlas.world.follows.filter((f) => f.kind === "tournament").map((f) => f.id),
  );
  const shown = atlas.world.tournaments.filter(
    (t) => scope === "all" || followed.has(t.id) || wanted.some((m) => m.tournamentId === t.id),
  );
  const tier = (t: Tournament) => "SAB".indexOf(t.tier);
  const running = shown
    .filter((t) => t.start <= key && key <= t.end)
    .sort((x, y) => tier(x) - tier(y) || x.start.localeCompare(y.start));
  const soon = shown
    .filter((t) => t.start > key && dayNumber(t.start) - dayNumber(key) <= 14)
    .sort((x, y) => x.start.localeCompare(y.start) || tier(x) - tier(y));

  /** Where an event stands on the chosen day: its stage, and which of its days this is. */
  const standingOn = (t: Tournament) => {
    const stage = t.stages.find((s) => s.start <= key && key <= s.end);
    const days = dayNumber(t.end) - dayNumber(t.start) + 1;
    return [
      stage && t.stages.length > 1 ? stage.name : undefined,
      days > 1 ? `Day ${dayNumber(key) - dayNumber(t.start) + 1} of ${days}` : undefined,
    ].filter((x): x is string => !!x);
  };
  const eventRow = (t: Tournament, note: string[]) => (
    <Go key={t.id} to={{ kind: "tournament", id: t.id }} className="bx-evl">
      <EventFace image={t.image} size={30} />
      <span>
        <b>{t.name}</b>
        <small>{[atlas.discipline(t.discipline).short, ...note].join(" · ")}</small>
      </span>
      <em>{dateRange(t.start, t.end)}</em>
    </Go>
  );

  const said = times.day(day, now);
  const name = /^(Today|Tomorrow|Yesterday)$/.test(said) ? said : longDay.format(day);
  const count = `${matches.length || "No"} ${matches.length === 1 ? "match" : "matches"}`;
  const line = [
    `${times.dayOfMonth(day)} ${times.month(day)}`,
    count,
    scope === "all" && own ? `${own} of yours` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const moved = offset !== 0 || first !== undefined;

  return (
    <>
      <section className="bx-stage bx-dayc">
        <CardSky />
        <div className="bx-ent-in">
          <div className="bx-eh">
            <div>
              <h1>{name}</h1>
              <p>{line}</p>
            </div>
            <div className="bx-eh-acts">
              {moved ? (
                <button type="button" className="bx-btn" data-k="quiet" onClick={today}>
                  Today
                </button>
              ) : null}
              <div className="bx-scope" role="group" aria-label="Which matches">
                {SCOPES.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={o.value === scope}
                    onClick={() => setScope(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="bx-strip">
            <button
              type="button"
              className="bx-wk"
              aria-label="A week earlier"
              onClick={() => move(-7)}
            >
              <ChevronLeft size={18} strokeWidth={2.4} aria-hidden />
            </button>
            <div className="bx-picks" role="group" aria-label="Day" ref={strip}>
              {offsets.map((i) => {
                const d = now + i * DAY;
                const k = times.dayKey(d);
                const n = perDay.get(k) ?? 0;
                const dots = busy(n);
                const amber = ownPerDay.get(k) ? 1 : 0;
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={i === offset}
                    aria-label={`${times.date(d)}, ${n} ${n === 1 ? "match" : "matches"}`}
                    onClick={() => setOffset(i)}
                  >
                    <small>{i === 0 ? "Today" : times.weekday(d)}</small>
                    {times.dayOfMonth(d)}
                    <span className="bx-pdots" aria-hidden>
                      {Array.from({ length: dots }, (_, j) => (
                        <i key={j} data-k={j >= dots - amber ? "mine" : undefined} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="bx-wk"
              aria-label="A week later"
              onClick={() => move(7)}
            >
              <ChevronRight size={18} strokeWidth={2.4} aria-hidden />
            </button>
          </div>
        </div>
      </section>
      <div className="bx-one">
        <div>
          {[...groups].map(([id, list]) => {
            const t = atlas.tournament(id);
            if (!t) return null;
            return (
              <section key={id} className="bx-sev">
                <Go to={{ kind: "tournament", id }} className="bx-sev-h">
                  <EventFace image={t.image} size={30} />
                  <span>
                    <b>{t.name}</b>
                    <small>
                      {[atlas.discipline(t.discipline).name, ...standingOn(t)].join(" · ")}
                    </small>
                  </span>
                  <ChevronRight size={18} strokeWidth={2.4} aria-hidden />
                </Go>
                <div className="bx-rows">
                  {bundle(atlas, list).map((item) =>
                    item.kind === "match" ? (
                      <MatchRow key={item.match.id} match={item.match} board={board} inEvent />
                    ) : (
                      <RoundLine key={item.key} matches={item.matches} board={board} inEvent />
                    ),
                  )}
                </div>
              </section>
            );
          })}
          {matches.length ? null : (
            <div className="bx-none">
              <p>
                {scope === "mine"
                  ? "Nothing you follow is on this day."
                  : "Nothing is on this day."}
              </p>
              {later ? (
                <button
                  type="button"
                  className="bx-btn"
                  data-k="quiet"
                  onClick={() => show(dayNumber(later) - dayNumber(times.dayKey(now)))}
                >
                  {times.day(`${later}T12:00:00Z`, now)}
                  <ChevronRight size={16} strokeWidth={2.4} aria-hidden />
                </button>
              ) : null}
            </div>
          )}
        </div>
        <div>
          {running.length ? (
            <>
              <div className="bx-cap">
                <span>Events · {said}</span>
                <span>{running.length}</span>
              </div>
              <div className="bx-panel">{running.map((t) => eventRow(t, standingOn(t)))}</div>
            </>
          ) : null}
          {soon.length ? (
            <>
              <div className="bx-cap">
                <span>Beginning soon</span>
              </div>
              <div className="bx-panel">
                {soon.map((t) => eventRow(t, [`Starts ${times.day(`${t.start}T12:00:00Z`, now)}`]))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Things that can be followed: a team, a player, an event, a whole game, an organisation

export interface Target {
  follow: Follow;
  name: string;
  /** What kind of thing it is, in words. */
  kind: string;
  /** The game's short name, for a team or player: two teams of one organisation share a name. */
  game?: string;
  /** Its disc: a colour for teams, players and organisations; an icon for the rest. */
  disc: ReactNode;
  side?: SideView;
}

export function target(atlas: Atlas, follow: Follow): Target | undefined {
  const plain = (icon: ReactNode) => (
    <span className="bx-disc bx-disc-plain" style={{ "--s": "26px" } as never} aria-hidden>
      {icon}
    </span>
  );
  switch (follow.kind) {
    case "team":
    case "player": {
      const c = atlas.competitor(follow.id);
      if (!c) return undefined;
      const side = { ...sideOf(atlas, follow.id), short: "" };
      const game = atlas.discipline(c.discipline).name;
      return {
        follow,
        name: side.name,
        kind: `${c.kind === "team" ? "Team" : "Player"} · ${game}`,
        game: atlas.discipline(c.discipline).short,
        disc: <Disc side={side} size={26} />,
        side,
      };
    }
    case "organization": {
      const o = atlas.world.organizations.find((x) => x.id === follow.id);
      if (!o) return undefined;
      const games = atlas.world.competitors
        .filter((c) => c.kind === "team" && c.orgId === o.id)
        .map((c) => atlas.discipline(c.discipline).short);
      const side: SideView = {
        id: null,
        name: o.name,
        label: o.name,
        short: "",
        color: o.colors.primary,
        ink: inkOn(o.colors.primary),
        plural: true,
      };
      return {
        follow,
        name: o.name,
        kind: `Organisation · ${games.join(", ")}`,
        disc: <Disc side={side} size={26} />,
      };
    }
    case "tournament": {
      const t = atlas.tournament(follow.id);
      if (!t) return undefined;
      return {
        follow,
        name: t.name,
        kind: `Event · ${atlas.discipline(t.discipline).name}`,
        game: atlas.discipline(t.discipline).short,
        disc: plain(<Trophy size={13} />),
      };
    }
    case "discipline": {
      const d = atlas.world.disciplines.find((x) => x.id === follow.id);
      if (!d) return undefined;
      return { follow, name: d.name, kind: "Game", disc: plain(<Gamepad2 size={14} />) };
    }
  }
}

function when(times: Times, at: string, now: number): string {
  const day = times.day(at, now);
  return `${/^(Today|Tomorrow)/.test(day) ? day.toLowerCase() : day} at ${times.clock(at)}`;
}

/**
 * What a match is called depends on what is being followed: the opponent for a team, the round
 * for an event, the game and the opponent for an organisation.
 */
function against(atlas: Atlas, follow: Follow, m: Match): string {
  const t = atlas.tournamentOf(m);
  const names = m.sides.flatMap((s) => (s.competitorId ? [s.competitorId] : []));
  if (follow.kind === "tournament") return heat(atlas, m).toLowerCase();
  if (m.sides.length !== 2) return `${t.short}, ${heat(atlas, m).toLowerCase()}`;
  if (follow.kind === "discipline")
    return names.map((id) => plainName(atlas, id)).join(" v ") || t.short;
  const own = (id: string) =>
    id === follow.id ||
    (follow.kind === "organization" && atlas.team(id)?.orgId === follow.id) ||
    atlas.roster(id).some((r) => r.player.id === follow.id);
  const other = names.filter((id) => !own(id));
  const versus = other.length === 1 ? `v ${plainName(atlas, other[0])}` : t.short;
  return follow.kind === "organization"
    ? `${atlas.discipline(t.discipline).short} ${versus}`
    : versus;
}

/** One plain sentence on what is next for a followed thing, or that nothing is. */
export function standing(board: Board, follow: Follow): string {
  const { atlas, now, times } = board;
  const relevant = atlas.world.matches.filter((m) => atlas.touches(m, follow));
  const live = relevant.filter((m) => m.status === "live");
  const next = relevant
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
  const single = follow.kind === "team" || follow.kind === "player";
  if (live.length) {
    return single || live.length === 1
      ? `Live now: ${against(atlas, follow, live[0]!)}`
      : `${live.length} ${atlas.tournamentOf(live[0]!).discipline === "chess" ? "games" : "matches"} live now`;
  }
  if (next) return `Next: ${against(atlas, follow, next)}, ${when(times, next.scheduledAt, now)}`;
  if (follow.kind === "tournament") {
    const t = atlas.tournament(follow.id);
    if (t && relevant.length && relevant.every((m) => m.status === "finished")) {
      const winner = champion(t);
      return winner ? `Finished. Won by ${plainName(atlas, winner)}.` : "Finished.";
    }
    return t ? `Starts ${times.date(`${t.start}T12:00:00Z`)}. No matches are scheduled yet.` : "";
  }
  const last = relevant
    .filter((m) => m.status === "finished")
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))[0];
  if (single && last) {
    const stage = atlas.stageOf(last);
    const w = winnerOf(last);
    const lost = typeof w === "number" && last.sides[w]?.competitorId !== follow.id;
    if (lost && (stage.format === "single-elim" || stage.format === "cup")) {
      const team = atlas.competitor(follow.id)?.kind === "team";
      return `${plainName(atlas, follow.id)} ${team ? "are" : "is"} out of the ${atlas.tournamentOf(last).short}. Nothing else is scheduled.`;
    }
  }
  return "Nothing is scheduled.";
}

/** Last five, newest first: a filled dot is a win, an open one a loss, a shared one a draw. */
function LastFive({ atlas, side }: { atlas: Atlas; side: SideView & { id: string } }) {
  const dots: Dot[] = form(atlas, side.id).map((r) =>
    r === "W"
      ? { k: "won", side: 0, label: "Won" }
      : r === "D"
        ? { k: "shared", label: "Draw" }
        : { k: "open" },
  );
  return <Dots dots={dots} sides={[side, { ...side, color: "var(--surface)" }]} size={9} fix />;
}

export function defined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

// ---------------------------------------------------------------------------------------------
// Following

/** The side of a match that is the followed thing: the team, the player, or the player's team. */
function ownSide(atlas: Atlas, follow: Follow, m: Match): number {
  return m.sides.findIndex(
    (s) =>
      !!s.competitorId &&
      (s.competitorId === follow.id ||
        (follow.kind === "organization" && atlas.team(s.competitorId)?.orgId === follow.id) ||
        (follow.kind === "player" &&
          atlas.roster(s.competitorId).some((r) => r.player.id === follow.id))),
  );
}

/** How a followed thing stands right now: what it plays, what it played, what comes after. */
interface Watch {
  item: Target;
  state: "live" | "soon" | "next" | "done" | "none";
  live: Match[];
  /** The match the card is about: the one being played, or else the next. */
  focus?: Match;
  /** What comes after the focus. */
  after?: Match;
  last?: Match;
}

function watch(board: Board, item: Target): Watch {
  const { atlas, now } = board;
  const relevant = atlas.world.matches.filter((m) => atlas.touches(m, item.follow));
  const byTime = (a: Match, b: Match) => a.scheduledAt.localeCompare(b.scheduledAt);
  const live = relevant.filter((m) => m.status === "live").sort(byTime);
  const next = relevant.filter((m) => m.status === "scheduled").sort(byTime);
  const last = relevant
    .filter((m) => m.status === "finished")
    .sort(byTime)
    .at(-1);
  const focus = live[0] ?? next[0];
  const after = live.length ? next[0] : next[1];
  const left = next[0] ? Date.parse(next[0].scheduledAt) - now : Infinity;
  const state = live.length
    ? "live"
    : next[0]
      ? left <= 3_600_000
        ? "soon"
        : "next"
      : item.follow.kind === "tournament" && last
        ? "done"
        : "none";
  return { item, state, live, focus, after, last };
}

const ORDER = { live: 0, soon: 1, next: 2, done: 3, none: 4 } as const;

function byState(x: Watch, y: Watch): number {
  return (
    ORDER[x.state] - ORDER[y.state] ||
    (x.focus?.scheduledAt ?? "").localeCompare(y.focus?.scheduledAt ?? "")
  );
}

/** The score of a match that has begun, the followed side's first. */
function scoreOf(board: Board, m: Match, own: number): string | undefined {
  const view = board.view(m);
  if (view.solo || (m.status === "scheduled" && !view.resumes)) return undefined;
  const marks =
    m.bestOf > 1 || m.status === "finished"
      ? scoreLine(m).split("–")
      : view.headline.length === 2
        ? view.headline
        : undefined;
  if (!marks) return undefined;
  return (own === 1 ? [...marks].reverse() : marks).join("–");
}

/** "Won 2–1 v Aurora": the last result, from the followed side, or the match as it ended. */
function lastSaid(board: Board, follow: Follow, m: Match): string {
  const { atlas } = board;
  const view = board.view(m);
  if (view.solo || m.sides.length !== 2) {
    const own = ownSide(atlas, follow, m);
    const id = own >= 0 ? m.sides[own]?.competitorId : undefined;
    const place = id ? view.standings.findIndex((s) => s.side.id === id) : -1;
    return place >= 0 ? `${ordinal(place + 1)} in ${view.where}` : view.where;
  }
  const own = ownSide(atlas, follow, m);
  const score = scoreLine(m);
  if (own < 0 || follow.kind === "organization")
    return `${plainName(atlas, m.sides[0]?.competitorId)} ${score} ${plainName(atlas, m.sides[1]?.competitorId)}`;
  const other = plainName(atlas, m.sides[1 - own]?.competitorId);
  const ownScore = scoreOf(board, m, own) ?? score;
  const won = didWin(m, m.sides[own]?.competitorId ?? "");
  return won === "draw"
    ? `Drew ${ownScore} v ${other}`
    : won
      ? `Won ${ownScore} v ${other}`
      : `Lost ${ownScore} v ${other}`;
}

function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
}

/** A small sign in a disc, where there is no team to show. */
function Sign({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <span className="bx-disc bx-disc-plain" style={{ "--s": `${size}px` } as never} aria-hidden>
      {children}
    </span>
  );
}

/** An event's mark, or where it has none a plain disc with a cup, so that rows still line up. */
function EventFace({ image, size }: { image: string | undefined; size: number }) {
  return image ? (
    <EventMark image={image} size={size} />
  ) : (
    <Sign size={size}>
      <Trophy size={Math.round(size * 0.45)} />
    </Sign>
  );
}

/** A team's or player's disc with its short name in it, for discs large enough to hold one. */
function face(atlas: Atlas, side: SideView): SideView {
  return side.id ? sideOf(atlas, side.id) : side;
}

/** The match a followed thing plays now or next, on one line that leads to it. */
function FocusLine({ board, w }: { board: Board; w: Watch & { focus: Match } }) {
  const { atlas } = board;
  const { focus, item } = w;
  const view = board.view(focus);
  const own = ownSide(atlas, item.follow, focus);
  const single = item.follow.kind === "team" || item.follow.kind === "player";
  const live = focus.status === "live";
  const where = item.follow.kind === "tournament" ? view.where : `${view.event} · ${view.where}`;
  const more = w.live.length > 1 ? `${w.live.length - 1} more live` : "";
  const detail = [live ? view.status.replace(/^Live(?: · )?/, "") || view.where : where, more]
    .filter(Boolean)
    .join(" · ")
    .replaceAll(" | ", " · ");
  const score = scoreOf(board, focus, single ? own : 0);
  const [a, b] = view.sides;
  return (
    <Link
      to="/match/$matchId"
      params={{ matchId: focus.id }}
      className="bx-fc-now"
      data-live={live ? "" : undefined}
    >
      {view.solo || !a || !b ? (
        <>
          <Sign>
            <Users size={13} strokeWidth={2.4} />
          </Sign>
          <b>{view.where}</b>
          <em>
            {view.standings[0] && live
              ? `${view.standings[0].side.name} leads`
              : item.follow.kind === "tournament"
                ? ""
                : view.event}
          </em>
        </>
      ) : single && own >= 0 ? (
        <>
          <small>vs</small>
          <Disc side={view.sides[1 - own]!} size={24} />
          <b>{view.sides[1 - own]!.name}</b>
          <em>{detail}</em>
        </>
      ) : (
        <>
          <Disc side={a} size={24} />
          <b>{a.name}</b>
          <small>vs</small>
          <b>{b.name}</b>
          <em>{detail}</em>
        </>
      )}
      {score ? <span className="bx-fc-sc">{live ? <Tick>{score}</Tick> : score}</span> : null}
    </Link>
  );
}

/** The state of a followed thing in a few words: live, starting soon, or when it plays next. */
function Badge({ board, w }: { board: Board; w: Watch }) {
  const { now, times } = board;
  const at = w.focus?.scheduledAt;
  if (w.state === "live")
    return (
      <span className="bx-badge" data-s="live">
        <Ping />
        {w.live.length > 1 ? `${w.live.length} live` : "Live"}
      </span>
    );
  if (w.state === "soon" && at)
    return (
      <span className="bx-badge" data-s="soon">
        Starts {until(at, now)}
      </span>
    );
  if (w.state === "next" && at)
    return (
      <span className="bx-badge" data-s="next">
        {times.day(at, now)}, {times.clock(at)}
      </span>
    );
  if (w.state === "done")
    return (
      <span className="bx-badge" data-s="next">
        Finished
      </span>
    );
  return null;
}

/** One followed team, player or event as a card: who, how it stands, what it plays now or next. */
function FollowCard({ board, w }: { board: Board; w: Watch }) {
  const { atlas, now, times } = board;
  const { item } = w;
  const t = item.follow.kind === "tournament" ? atlas.tournament(item.follow.id) : undefined;
  const side = item.side;
  const foot: [string, string][] = [];
  if (t) {
    foot.push(["Dates", dateRange(t.start, t.end)]);
  } else if (w.last) {
    foot.push(["Last", lastSaid(board, item.follow, w.last)]);
  }
  if (w.focus && w.after) {
    foot.push([
      "Then",
      `${against(atlas, item.follow, w.after)}, ${when(times, w.after.scheduledAt, now)}`,
    ]);
  }
  return (
    <div className="bx-fc" data-s={w.state}>
      <Go to={item.follow} className="bx-fc-go">
        <span className="bx-only">{item.name}</span>
      </Go>
      <div className="bx-fc-who">
        {t ? (
          <EventFace image={t.image} size={44} />
        ) : side ? (
          <Disc side={face(atlas, side)} size={44} />
        ) : (
          item.disc
        )}
        <div>
          <b>{item.name}</b>
          <span>{item.kind}</span>
        </div>
        <Badge board={board} w={w} />
      </div>
      {w.focus ? (
        <FocusLine board={board} w={{ ...w, focus: w.focus }} />
      ) : (
        <p className="bx-fc-quiet">{standing(board, item.follow)}</p>
      )}
      <div className="bx-fc-foot">
        <span>
          {foot.map(([k, v]) => (
            <span key={k}>
              {k}: <b>{v}</b>
            </span>
          ))}
        </span>
        <span className="bx-fc-end">
          {side?.id ? <LastFive atlas={atlas} side={{ ...side, id: side.id }} /> : null}
          <FollowStar follow={item.follow} name={item.name} />
        </span>
      </div>
    </div>
  );
}

/** A followed thing as a glass chip on the card: its mark, its name, and how it stands. */
function Chip({ board, w }: { board: Board; w: Watch }) {
  const { now, times } = board;
  const { item, focus } = w;
  const t = item.follow.kind === "tournament" ? board.atlas.tournament(item.follow.id) : undefined;
  const own = focus ? ownSide(board.atlas, item.follow, focus) : -1;
  const score = focus && w.state === "live" ? scoreOf(board, focus, Math.max(own, 0)) : undefined;
  const state =
    w.state === "live" ? (
      <>
        <Ping />
        {w.live.length > 1 ? `${w.live.length} live` : (score ?? "Live")}
      </>
    ) : w.state === "soon" && focus ? (
      until(focus.scheduledAt, now)
    ) : w.state === "next" && focus ? (
      times.dayKey(focus.scheduledAt) === times.dayKey(now) ? (
        times.clock(focus.scheduledAt)
      ) : (
        times.weekday(focus.scheduledAt)
      )
    ) : null;
  return (
    <Go to={item.follow} className="bx-tok">
      {t ? (
        <EventFace image={t.image} size={28} />
      ) : item.side ? (
        <Disc side={item.side} size={28} />
      ) : (
        item.disc
      )}
      {item.name}
      {state ? <small data-s={w.state}>{state}</small> : null}
    </Go>
  );
}

/** A followed chess player who is in no event Kiming has, as a chip. */
function ListedChip({ id }: { id: string }) {
  const { player } = useFidePlayer(id);
  const name = player?.name ?? "Chess player";
  return (
    <Link to="/player/$playerId" params={{ playerId: id }} className="bx-tok">
      <Disc size={28} side={fideSide(name, player?.image)} />
      {name}
    </Link>
  );
}

function fideSide(name: string, image: string | undefined): SideView {
  return {
    id: null,
    name,
    label: name,
    short: "",
    color: "var(--ink)",
    ink: "var(--ground)",
    plural: false,
    image,
    person: true,
  };
}

/** A followed chess player who is in no event Kiming has: who they are, and the star. */
function ListedRow({ id }: { id: string }) {
  const { player } = useFidePlayer(id);
  const name = player?.name ?? "Chess player";
  return (
    <div className="bx-prow">
      <Link to="/player/$playerId" params={{ playerId: id }}>
        <Disc size={30} side={fideSide(name, player?.image)} />
        <span>
          <b>{name}</b>
          <small>
            <Flag country={player?.country} />
            {[player?.title, player?.ratings[0]?.value].filter(Boolean).join(" · ")}
          </small>
        </span>
      </Link>
      <FollowStar follow={{ kind: "player", id }} name={name} />
    </div>
  );
}

/** A followed organisation or whole game: no page of its own, so a row with what is next. */
function WiderRow({ item, board }: { item: Target; board: Board }) {
  return (
    <div className="bx-prow">
      <span>
        {item.disc}
        <span>
          <b>{item.name}</b>
          <small>{standing(board, item.follow)}</small>
        </span>
      </span>
      <FollowStar follow={item.follow} name={item.name} />
    </div>
  );
}

function counted(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function Following() {
  const board = useBoard();
  const { atlas } = board;
  const follows = atlas.world.follows;
  // Teams reached through an organisation count as followed, and are listed as such.
  const competitors = atlas.world.competitors
    .filter((c) => atlas.followsCompetitor(c.id))
    .map((c) => target(atlas, { kind: c.kind, id: c.id }))
    .filter(defined);
  const of = (kind: Follow["kind"]) =>
    follows
      .filter((f) => f.kind === kind)
      .map((f) => target(atlas, f))
      .filter(defined);
  const events = of("tournament");
  const wider = [...of("organization"), ...of("discipline")];
  const listed = follows.filter(
    (f) => f.kind === "player" && f.id.startsWith("fide-") && !atlas.player(f.id),
  );
  const nothing = !competitors.length && !events.length && !wider.length && !listed.length;

  const people = competitors.map((item) => watch(board, item)).sort(byState);
  const happenings = events.map((item) => watch(board, item)).sort(byState);
  const broad = wider.map((item) => watch(board, item));
  const all = [...people, ...happenings, ...broad].sort(byState);
  const liveNow = all.filter((w) => w.state === "live").length;

  const teams = competitors.filter((c) => c.follow.kind === "team").length;
  const players = competitors.length - teams + listed.length;
  const orgs = wider.filter((w) => w.follow.kind === "organization").length;
  const games = wider.length - orgs;
  const line = [
    teams && players
      ? `${teams + players} teams and players`
      : teams
        ? counted(teams, "team", "teams")
        : players
          ? counted(players, "player", "players")
          : "",
    events.length ? counted(events.length, "event", "events") : "",
    orgs ? counted(orgs, "organisation", "organisations") : "",
    games ? counted(games, "game", "games") : "",
  ]
    .filter(Boolean)
    .join(", ");

  if (nothing)
    return (
      <section className="bx-stage bx-fhead">
        <CardSky />
        <div className="bx-ent-in">
          <div className="bx-eh">
            <div>
              <h1>Following</h1>
              <p>
                Tap the star on a team, a player or an event. It shows up here and on Live, first.
              </p>
            </div>
            <div className="bx-eh-acts">
              <Link to="/search" className="bx-btn" data-k="main">
                <Plus size={17} aria-hidden />
                Find a team or a player
              </Link>
            </div>
          </div>
        </div>
      </section>
    );

  const side = wider.length > 0 || listed.length > 0;
  return (
    <>
      <section className="bx-stage bx-fhead">
        <CardSky />
        <div className="bx-ent-in">
          <div className="bx-eh">
            <div>
              <h1>Following</h1>
              <p>{[line, liveNow ? `${liveNow} live now` : ""].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="bx-toks">
              {all.map((w) => (
                <Chip key={`${w.item.follow.kind}${w.item.follow.id}`} board={board} w={w} />
              ))}
              {listed.map((f) => (
                <ListedChip key={f.id} id={f.id} />
              ))}
              <Link to="/search" className="bx-tok" data-k="add">
                <Plus size={16} aria-hidden />
                Follow more
              </Link>
            </div>
          </div>
        </div>
      </section>
      <div className={side ? "bx-one" : undefined}>
        <div>
          {people.length ? (
            <>
              <h2 className="bx-h2">Teams and players</h2>
              <div className="bx-fgrid" data-wide={side ? undefined : ""}>
                {people.map((w) => (
                  <FollowCard key={w.item.follow.id} board={board} w={w} />
                ))}
              </div>
            </>
          ) : null}
          {happenings.length ? (
            <>
              <h2 className="bx-h2">Events</h2>
              <div className="bx-fgrid" data-wide={side ? undefined : ""}>
                {happenings.map((w) => (
                  <FollowCard key={w.item.follow.id} board={board} w={w} />
                ))}
              </div>
            </>
          ) : null}
        </div>
        {side ? (
          <div>
            {wider.length ? (
              <>
                <h2 className="bx-h2">Organisations and games</h2>
                <div className="bx-panel">
                  {wider.map((item) => (
                    <WiderRow key={item.follow.id} item={item} board={board} />
                  ))}
                </div>
              </>
            ) : null}
            {listed.length ? (
              <>
                <h2 className="bx-h2">Not playing at the moment</h2>
                <div className="bx-panel">
                  {listed.map((f) => (
                    <ListedRow key={f.id} id={f.id} />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Search

/** Everything that can be found, with the words it answers to. */
export function everything(atlas: Atlas): { follow: Follow; words: string; group: string }[] {
  const { world } = atlas;
  return [
    ...world.competitors.map((c) => ({
      follow: { kind: c.kind, id: c.id } satisfies Follow,
      words:
        c.kind === "team"
          ? `${c.name} ${c.short} ${atlas.discipline(c.discipline).name}`
          : `${c.handle} ${c.name ?? ""}`,
      group: c.kind === "team" ? "Teams" : "Players",
    })),
    ...world.tournaments.map((t) => ({
      follow: { kind: "tournament", id: t.id } satisfies Follow,
      words: `${t.name} ${t.short} ${t.series ?? ""} ${atlas.discipline(t.discipline).name}`,
      group: "Events",
    })),
    ...world.organizations.map((o) => ({
      follow: { kind: "organization", id: o.id } satisfies Follow,
      words: o.name,
      group: "Organisations and games",
    })),
    ...world.disciplines.map((d) => ({
      follow: { kind: "discipline", id: d.id } satisfies Follow,
      words: `${d.name} ${d.short}`,
      group: "Organisations and games",
    })),
  ];
}

export const GROUPS = ["Teams", "Players", "Events", "Organisations and games"];
