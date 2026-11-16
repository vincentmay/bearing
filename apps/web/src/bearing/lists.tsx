import {
  type Atlas,
  type Follow,
  type Match,
  type Tournament,
  champion,
  dateRange,
  form,
  tournamentStatus,
  winnerOf,
} from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Rows3,
  Search as SearchIcon,
  Trophy,
  Users,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { bundle, scoreLine, upcomingForYou } from "../lib/view";
import { useRecents } from "../lib/recents";
import { type Board, useBoard, useWide } from "./board";
import { Go } from "./links";
import { type Dot, type SideView, bestOf, heat, inkOn, plainName, sideOf } from "./model";
import { type Times, until } from "./time";
import { Disc, Dots, Flag, FollowStar, Ping, Section, Segmented, Tick } from "./ui";
import { useFideSearch } from "../lib/fide";

const DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------------------------
// Schedule

const SCOPES = [
  { value: "all", label: "Everything" },
  { value: "mine", label: "What I follow" },
] as const;

const dayNumber = (date: string) => Math.round(Date.parse(`${date}T12:00:00Z`) / DAY);

/**
 * A strip of days that can be moved a week at a time, as far as anyone likes. Under it the
 * chosen day: each event that plays that day with its matches in time order, and beside them
 * the events that are running or about to begin, since an event is longer than its matches.
 */
export function Schedule() {
  const board = useBoard();
  const { atlas, now, times } = board;
  const wide = useWide();
  const [scope, setScope] = useState<(typeof SCOPES)[number]["value"]>("all");
  const [offset, setOffset] = useState(0);
  const span = wide ? 10 : 7;
  // The first day shown; today sits a few days in, so that yesterday is at hand.
  const [first, setFirst] = useState<number>();
  const start = first ?? (wide ? -3 : -2);
  const offsets = Array.from({ length: span }, (_, i) => start + i);
  const day = now + offset * DAY;
  const key = times.dayKey(day);
  const move = (by: number) => {
    setFirst(start + by);
    setOffset(offset + by);
  };
  const today = () => {
    setFirst(undefined);
    setOffset(0);
  };

  // What the viewer follows includes matches a followed team only reaches by winning first.
  const maybe = new Set(upcomingForYou(atlas).map((u) => u.match.id));
  const mine = (m: Match) => atlas.isFollowed(m) || maybe.has(m.id);
  const wanted = atlas.world.matches.filter((m) => scope === "all" || mine(m));
  const perDay = new Map<string, number>();
  for (const m of wanted) {
    const k = times.dayKey(m.scheduledAt);
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  const matches = wanted
    .filter((m) => times.dayKey(m.scheduledAt) === key)
    .sort((x, y) => x.scheduledAt.localeCompare(y.scheduledAt));

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
  const standing = (t: Tournament) => {
    const stage = t.stages.find((s) => s.start <= key && key <= s.end);
    const days = dayNumber(t.end) - dayNumber(t.start) + 1;
    return [
      stage && t.stages.length > 1 ? stage.name : undefined,
      days > 1 ? `Day ${dayNumber(key) - dayNumber(t.start) + 1} of ${days}` : undefined,
    ].filter(Boolean);
  };
  const eventRow = (t: Tournament, note: string[]) => (
    <Go key={t.id} to={{ kind: "tournament", id: t.id }} className="bx-line bx-event-line">
      <span style={{ minWidth: 0 }}>
        <b>{t.name}</b>
        <span className="bx-sub">
          {[atlas.discipline(t.discipline).short, ...note].join(" · ")}
        </span>
      </span>
      <span className="bx-sub bx-mono">{dateRange(t.start, t.end)}</span>
    </Go>
  );

  return (
    <>
      <header className="bx-head">
        <h1 className="bx-title">Schedule</h1>
        <span className="bx-date">{times.month(day)}</span>
      </header>
      <div className="bx-daybar">
        <button
          type="button"
          className="bx-iconbtn"
          aria-label="A week earlier"
          onClick={() => move(-7)}
        >
          <ChevronLeft size={16} strokeWidth={2.4} aria-hidden />
        </button>
        <div className="bx-days" role="group" aria-label="Day">
          {offsets.map((i) => {
            const d = now + i * DAY;
            const count = perDay.get(times.dayKey(d)) ?? 0;
            return (
              <button
                key={i}
                type="button"
                aria-pressed={i === offset}
                aria-label={`${times.date(d)}, ${count} ${count === 1 ? "match" : "matches"}`}
                data-today={i === 0 ? "" : undefined}
                data-busy={count ? "" : undefined}
                onClick={() => setOffset(i)}
              >
                {i === 0 ? "Today" : times.weekday(d)}
                <b>{times.dayOfMonth(d)}</b>
                <i aria-hidden />
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="bx-iconbtn"
          aria-label="A week later"
          onClick={() => move(7)}
        >
          <ChevronRight size={16} strokeWidth={2.4} aria-hidden />
        </button>
      </div>
      <div className="bx-daytools">
        <Segmented options={SCOPES} value={scope} onChange={setScope} label="Which matches" />
        {offset !== 0 || first !== undefined ? (
          <button type="button" className="bx-pill" onClick={today}>
            Today
          </button>
        ) : null}
      </div>
      <div className="bx-cols bx-cols-main">
        <div>
          <h2 className="bx-dayname">
            {times.day(day, now)}
            <span className="bx-sub">
              {matches.length
                ? `${matches.length} ${matches.length === 1 ? "match" : "matches"} in ${groups.size} ${groups.size === 1 ? "event" : "events"}`
                : ""}
            </span>
          </h2>
          {[...groups].map(([id, list]) => {
            const t = atlas.tournament(id);
            if (!t) return null;
            return (
              <section key={id} className="bx-dayevent">
                <Go to={{ kind: "tournament", id }} className="bx-dayevent-head">
                  <span>
                    <b>{t.name}</b>
                    <span className="bx-sub">
                      {[atlas.discipline(t.discipline).name, ...standing(t)].join(" · ")}
                    </span>
                  </span>
                  <ChevronRight size={15} strokeWidth={2.4} aria-hidden />
                </Go>
                <div className="bx-list">
                  {bundle(atlas, list).map((item) =>
                    item.kind === "match" ? (
                      <ScheduleRow key={item.match.id} match={item.match} board={board} inEvent />
                    ) : (
                      <RoundRow key={item.key} matches={item.matches} board={board} inEvent />
                    ),
                  )}
                </div>
              </section>
            );
          })}
          {matches.length ? null : (
            <div className="bx-list">
              <p className="bx-empty">
                {scope === "mine"
                  ? "Nothing you follow is on this day."
                  : "Nothing is on this day."}
              </p>
            </div>
          )}
        </div>
        <div>
          {running.length ? (
            <Section label={`Events · ${times.day(day, now)}`}>
              <div className="bx-list">
                {running.map((t) => eventRow(t, standing(t) as string[]))}
              </div>
            </Section>
          ) : null}
          {soon.length ? (
            <Section label="Beginning soon">
              <div className="bx-list">
                {soon.map((t) => eventRow(t, [`Starts ${times.day(`${t.start}T12:00:00Z`, now)}`]))}
              </div>
            </Section>
          ) : null}
        </div>
      </div>
    </>
  );
}

/** A whole round of an event on one line: how many games, and how many are being played. */
export function RoundRow({
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
  const to = { kind: "tournament", id: tournament.id } as const;
  return (
    <Go to={to} className="bx-mr">
      <span className="bx-mr-when">
        <b>{times.clock(first.scheduledAt)}</b>
        {live ? (
          <span data-live="">
            <Ping />
            Live
          </span>
        ) : (
          <span>{done === matches.length ? "Final" : ""}</span>
        )}
      </span>
      <span className="bx-mr-body">
        <span className="bx-mr-side">
          <span className="bx-disc bx-disc-plain" style={{ "--s": "20px" } as never} aria-hidden>
            <Rows3 size={11} strokeWidth={2.4} />
          </span>
          <b>{inEvent ? round : tournament.name}</b>
          <i className="bx-num">{matches.length}</i>
        </span>
        <span className="bx-sub">
          {inEvent
            ? state
            : `${atlas.discipline(tournament.discipline).short} · ${round} · ${state}`}
        </span>
      </span>
    </Go>
  );
}

export function ScheduleRow({
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
  const { now, times } = board;
  const live = match.status === "live";
  const done = match.status === "finished";
  const elsewhen = day && times.dayKey(match.scheduledAt) !== times.dayKey(now);
  const won = done ? winnerOf(match) : undefined;
  // A series is told by its games won; a single game by its own score while it is played.
  const marks =
    view.solo || match.status === "scheduled"
      ? undefined
      : match.bestOf > 1 || done
        ? scoreLine(match).split("–")
        : view.headline.length === 2
          ? view.headline
          : undefined;
  const detail = live ? view.status.replace(/^Live(?: · )?/, "") : "";
  const place = inEvent
    ? `${bestOf(match.bestOf)}${view.solo ? "" : ` · ${view.where}`}`
    : `${view.discipline.short} · ${view.event}${view.solo ? "" : ` · ${view.where}`}`;
  const sub = [note, place, detail].filter(Boolean).join(" · ");
  const known = view.sides.filter((s) => s.id).map((s) => s.name);
  return (
    <Link to="/match/$matchId" params={{ matchId: match.id }} className="bx-mr">
      <span className="bx-mr-when">
        <b>
          {elsewhen
            ? `${times.weekday(match.scheduledAt)} ${times.dayOfMonth(match.scheduledAt)}`
            : times.clock(match.scheduledAt)}
        </b>
        {live ? (
          <span data-live="">
            <Ping />
            Live
          </span>
        ) : (
          <span>
            {done
              ? "Final"
              : elsewhen
                ? times.clock(match.scheduledAt)
                : until(match.scheduledAt, now)}
          </span>
        )}
      </span>
      {view.solo ? (
        <span className="bx-mr-body">
          <span className="bx-mr-side">
            <span className="bx-disc bx-disc-plain" style={{ "--s": "20px" } as never} aria-hidden>
              <Users size={11} strokeWidth={2.4} />
            </span>
            <b>{view.where}</b>
            {done ? <i>{view.standings[0]?.side.name ?? ""} won</i> : null}
          </span>
          <span className="bx-sub">
            {known.length ? known.join(", ") : "Field not decided yet"}
          </span>
          <span className="bx-sub">{sub}</span>
        </span>
      ) : (
        <span className="bx-mr-body">
          {view.sides.map((side, i) => (
            <span
              key={side.id ?? i}
              className="bx-mr-side"
              data-lost={typeof won === "number" && won !== i ? "" : undefined}
            >
              <Disc side={side} size={20} />
              <b>{side.name}</b>
              {marks?.[i] !== undefined ? (
                <i className="bx-num">{live ? <Tick>{marks[i]}</Tick> : marks[i]}</i>
              ) : null}
            </span>
          ))}
          <span className="bx-sub">{sub}</span>
        </span>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------------------------
// Things that can be followed: a team, a player, an event, a whole game, an organisation

interface Target {
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

function target(atlas: Atlas, follow: Follow): Target | undefined {
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

/** One plain sentence on what is next for a followed thing, or that nothing is. */
function standing(board: Board, follow: Follow): string {
  const { atlas, now, times } = board;
  const relevant = atlas.world.matches.filter((m) => atlas.touches(m, follow));
  const live = relevant.filter((m) => m.status === "live");
  const next = relevant
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
  const single = follow.kind === "team" || follow.kind === "player";
  // What a match is called depends on what is being followed: the opponent for a team, the
  // round for an event, the game and the opponent for an organisation.
  const against = (m: Match) => {
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
  };
  if (live.length) {
    return single || live.length === 1
      ? `Live now: ${against(live[0]!)}`
      : `${live.length} ${atlas.tournamentOf(live[0]!).discipline === "chess" ? "games" : "matches"} live now`;
  }
  if (next) return `Next: ${against(next)}, ${when(times, next.scheduledAt, now)}`;
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

function TargetRow({ item, board, line }: { item: Target; board: Board; line?: boolean }) {
  const side = item.side;
  return (
    <div className="bx-result">
      <Go to={item.follow} className="bx-row bx-press" style={{ gap: 10, minWidth: 0 }}>
        {item.disc}
        <span style={{ minWidth: 0 }}>
          <b>{item.name}</b>
          <span className="bx-sub" style={line ? { whiteSpace: "normal" } : undefined}>
            {line
              ? `${item.game ? `${item.game} · ` : ""}${standing(board, item.follow)}`
              : item.kind}
          </span>
        </span>
      </Go>
      <span className="bx-row" style={{ gap: 8 }}>
        {side?.id ? <LastFive atlas={board.atlas} side={{ ...side, id: side.id }} /> : null}
        <FollowStar follow={item.follow} name={item.name} />
      </span>
    </div>
  );
}

function defined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

// ---------------------------------------------------------------------------------------------
// Following

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
  const nothing = !competitors.length && !events.length && !wider.length;

  return (
    <>
      <header className="bx-head">
        <h1 className="bx-title">Following</h1>
        <span className="bx-date">Last five</span>
      </header>
      {nothing ? (
        <div className="bx-list" style={{ marginTop: 16 }}>
          <p className="bx-empty">
            You are not following anything yet. <Link to="/search">Search</Link> for a team, a
            player or an event, and tap its star.
          </p>
        </div>
      ) : null}
      <div className="bx-cols">
        {competitors.length ? (
          <Section label="Teams and players">
            <div className="bx-list">
              {competitors.map((item) => (
                <TargetRow key={item.follow.id} item={item} board={board} line />
              ))}
            </div>
          </Section>
        ) : null}
        <div>
          {events.length ? (
            <Section label="Events">
              <div className="bx-list">
                {events.map((item) => (
                  <TargetRow key={item.follow.id} item={item} board={board} line />
                ))}
              </div>
            </Section>
          ) : null}
          {wider.length ? (
            <Section label="Organisations and games">
              <div className="bx-list">
                {wider.map((item) => (
                  <TargetRow key={item.follow.id} item={item} board={board} line />
                ))}
              </div>
            </Section>
          ) : null}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Search

/** Everything that can be found, with the words it answers to. */
function everything(atlas: Atlas): { follow: Follow; words: string; group: string }[] {
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

const GROUPS = ["Teams", "Players", "Events", "Organisations and games"];

export function Search() {
  const board = useBoard();
  const { atlas } = board;
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  // A name that starts with what was typed comes before one that only contains it.
  const hits = q
    ? everything(atlas)
        .map((x) => {
          const words = x.words.toLowerCase();
          const rank = words.startsWith(q)
            ? 0
            : words.includes(` ${q}`)
              ? 1
              : words.includes(q)
                ? 2
                : 3;
          return { ...x, rank };
        })
        .filter((x) => x.rank < 3)
        .sort((a, b) => a.rank - b.rank)
    : [];
  const groups = GROUPS.map((group) => ({
    group,
    items: hits
      .filter((h) => h.group === group)
      .slice(0, 6)
      .map((h) => target(atlas, h.follow))
      .filter(defined),
  })).filter((g) => g.items.length);
  // Chess players who are in no event Bearing has, from FIDE's own list.
  const fide = useFideSearch(query).filter((p) => !atlas.player(p.id));
  const followed = atlas.world.follows.map((f) => target(atlas, f)).filter(defined);
  // Events that are being played or about to be: the top of each game first.
  const tier = { S: 0, A: 1, B: 2 } as const;
  const events = atlas.world.tournaments
    .filter((t) => tournamentStatus(atlas, t, board.now) !== "completed")
    .sort((x, y) => tier[x.tier] - tier[y.tier] || x.start.localeCompare(y.start))
    .slice(0, 12)
    .map((t) => target(atlas, { kind: "tournament", id: t.id }))
    .filter(defined);
  const recent = useRecents()
    .map((f) => target(atlas, f))
    .filter(defined);

  return (
    <>
      <header className="bx-head">
        <h1 className="bx-title">Search</h1>
      </header>
      <div className="bx-page-narrow" style={{ margin: 0 }}>
        <label className="bx-field">
          <SearchIcon size={16} aria-hidden />
          <span className="bx-only">Search for a team, player or event</span>
          <input
            type="search"
            placeholder="Team, player or event"
            value={query}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div aria-live="polite">
        {q && !groups.length && !fide.length ? (
          <div className="bx-list" style={{ marginTop: 20 }}>
            <p className="bx-empty">
              Nothing found for "{query.trim()}". Try a team's short name, such as "VIT", or a
              player's handle.
            </p>
          </div>
        ) : null}
        <div className="bx-cols">
          {groups.map(({ group, items }) => (
            <Section key={group} label={`${group} · ${items.length}`}>
              <div className="bx-list">
                {items.map((item) => (
                  <TargetRow
                    key={`${item.follow.kind}${item.follow.id}`}
                    item={item}
                    board={board}
                  />
                ))}
              </div>
            </Section>
          ))}
          {fide.length ? (
            <Section label="Chess players · not in an event right now">
              <div className="bx-list">
                {fide.map((p) => (
                  <Link
                    key={p.id}
                    to="/player/$playerId"
                    params={{ playerId: p.id }}
                    className="bx-line"
                  >
                    <span className="bx-who">
                      <Disc
                        size={30}
                        side={{
                          id: null,
                          name: p.name,
                          label: p.name,
                          short: p.family.slice(0, 2).toUpperCase(),
                          color: "var(--ink)",
                          ink: "var(--ground)",
                          plural: false,
                          image: p.image,
                          person: true,
                        }}
                      />
                      <span>
                        <b>{p.name}</b>
                        <span className="bx-sub">
                          <Flag country={p.country} />
                          {[p.title, p.ratings[0] && `${p.ratings[0].value}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </span>
                    <span />
                    <span />
                  </Link>
                ))}
              </div>
            </Section>
          ) : null}
          {q
            ? null
            : atlas.world.rankings
                .filter((r) => r.entries.some((e) => e.rank))
                .map((r) => (
                  <Section key={r.title} label={r.title}>
                    <div className="bx-list">
                      {r.entries.slice(0, 10).map((e) => {
                        const known = e.competitorId ? atlas.competitor(e.competitorId) : undefined;
                        const body = (
                          <>
                            <span className="bx-rank-n bx-num">{e.rank}</span>
                            <span className="bx-who">
                              {known ? <Disc side={sideOf(atlas, known.id)} size={24} /> : null}
                              <b>{known ? plainName(atlas, known.id) : e.name}</b>
                            </span>
                            <span className="bx-sub bx-mono bx-num">
                              {e.change > 0
                                ? `▲${e.change}  `
                                : e.change < 0
                                  ? `▼${-e.change}  `
                                  : ""}
                              {e.points}
                            </span>
                          </>
                        );
                        return known ? (
                          <Go
                            key={e.rank}
                            to={{ kind: "team", id: known.id }}
                            className="bx-line bx-rank"
                          >
                            {body}
                          </Go>
                        ) : (
                          <div key={e.rank} className="bx-line bx-rank">
                            {body}
                          </div>
                        );
                      })}
                    </div>
                  </Section>
                ))}
          {q || !events.length ? null : (
            <Section label="Events on now and coming">
              <div className="bx-list">
                {events.map((item) => (
                  <TargetRow key={item.follow.id} item={item} board={board} line />
                ))}
              </div>
            </Section>
          )}
          {q || !recent.length ? null : (
            <Section label="Recently looked at">
              <div className="bx-list">
                {recent.map((item) => (
                  <TargetRow
                    key={`${item.follow.kind}${item.follow.id}`}
                    item={item}
                    board={board}
                  />
                ))}
              </div>
            </Section>
          )}
          {q ? null : (
            <Section label="Following">
              <div className="bx-list">
                {followed.map((item) => (
                  <TargetRow
                    key={`${item.follow.kind}${item.follow.id}`}
                    item={item}
                    board={board}
                  />
                ))}
                {followed.length ? null : (
                  <p className="bx-empty">
                    Nothing yet. Type a name above and tap the star next to it.
                  </p>
                )}
              </div>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
