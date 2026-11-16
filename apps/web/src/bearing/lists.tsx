import {
  type Atlas,
  type Follow,
  type Match,
  champion,
  form,
  tournamentStatus,
  winnerOf,
} from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import { Gamepad2, Search as SearchIcon, Trophy } from "lucide-react";
import { type ReactNode, useState } from "react";
import { bundle, scoreLine, upcomingForYou } from "../lib/view";
import { estimatedMinutes } from "../lib/world";
import { useRecents } from "../lib/recents";
import { type Board, useBoard, useWide } from "./board";
import { Go } from "./links";
import {
  type Dot,
  type SideView,
  bestOf,
  heat,
  inkOn,
  lineOf,
  plainName,
  sideOf,
  titleOf,
} from "./model";
import { type Times, until } from "./time";
import { Disc, Dots, Duo, FollowStar, Ping, Section, Segmented, Tick } from "./ui";

const DAY = 24 * 60 * 60 * 1000;
const SIX_HOURS = 6 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------------------------
// Schedule

const SCOPES = [
  { value: "all", label: "Everything" },
  { value: "mine", label: "What I follow" },
] as const;

/** A row of days; under it, everything on the selected day in time order, across all games. */
export function Schedule() {
  const board = useBoard();
  const { atlas, now, times } = board;
  const wide = useWide();
  const [scope, setScope] = useState<(typeof SCOPES)[number]["value"]>("all");
  const [offset, setOffset] = useState(0);
  const offsets = wide ? [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6] : [-2, -1, 0, 1, 2, 3, 4];
  const day = now + offset * DAY;
  const key = times.dayKey(day);

  // What the viewer follows includes matches a followed team only reaches by winning first.
  const maybe = new Set(upcomingForYou(atlas).map((u) => u.match.id));
  const mine = (m: Match) => atlas.isFollowed(m) || maybe.has(m.id);
  const matches = atlas.world.matches
    .filter((m) => times.dayKey(m.scheduledAt) === key && (scope === "all" || mine(m)))
    .sort((x, y) => x.scheduledAt.localeCompare(y.scheduledAt));

  // Two matches may overlap when one starts before the other is expected to be over.
  let busyUntil = -Infinity;
  const rows = bundle(atlas, matches).map((item) => {
    const m = item.kind === "match" ? item.match : item.matches[0]!;
    const start = Date.parse(m.scheduledAt);
    const length = estimatedMinutes(m, atlas.tournamentOf(m).discipline) * 60_000;
    const overlap = start < busyUntil;
    // A match that is over cannot overlap with anything that has yet to start.
    const end = m.status === "finished" ? Math.min(start + length, now) : start + length;
    busyUntil = Math.max(busyUntil, end);
    return { item, overlap };
  });

  return (
    <>
      <header className="bx-head">
        <h1 className="bx-title">Schedule</h1>
        <span className="bx-date">{times.month(day)}</span>
      </header>
      <div className="bx-days" role="group" aria-label="Day">
        {offsets.map((i) => {
          const d = now + i * DAY;
          return (
            <button
              key={i}
              type="button"
              aria-pressed={i === offset}
              aria-label={times.date(d)}
              data-today={i === 0 ? "" : undefined}
              onClick={() => setOffset(i)}
            >
              {i === 0 ? "Today" : times.weekday(d)}
              <b>{times.dayOfMonth(d)}</b>
            </button>
          );
        })}
      </div>
      <div className={wide ? "bx-page-narrow" : undefined} style={wide ? { margin: 0 } : undefined}>
        <Segmented options={SCOPES} value={scope} onChange={setScope} label="Which matches" />
        <Section
          label={`${times.day(day, now)} · ${matches.length} ${matches.length === 1 ? "match" : "matches"}`}
        >
          <div className="bx-list">
            {rows.map(({ item, overlap }) =>
              item.kind === "match" ? (
                <ScheduleRow
                  key={item.match.id}
                  match={item.match}
                  board={board}
                  overlap={overlap}
                />
              ) : (
                <RoundRow key={item.key} matches={item.matches} board={board} overlap={overlap} />
              ),
            )}
            {matches.length ? null : (
              <p className="bx-empty">
                {scope === "mine"
                  ? "Nothing you follow is on this day."
                  : "Nothing is on this day."}
              </p>
            )}
          </div>
        </Section>
      </div>
    </>
  );
}

/** A whole round of an event on one line: how many games, and how many are being played. */
export function RoundRow({
  matches,
  board,
  overlap = false,
  bare = false,
}: {
  matches: Match[];
  board: Board;
  overlap?: boolean;
  /** Without the time and the count in a disc, for a list that has neither column. */
  bare?: boolean;
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
  const text = (
    <span style={{ minWidth: 0 }}>
      <b>{tournament.name}</b>
      <span className="bx-sub">
        {atlas.discipline(tournament.discipline).short} · {round} · {state}
      </span>
    </span>
  );
  const to = { kind: "tournament", id: tournament.id } as const;
  if (bare) {
    return (
      <Go to={to} className="bx-result">
        {text}
        <span className="bx-right" data-live={live ? "" : undefined}>
          {live ? <Ping /> : null}
          {matches.length}
        </span>
      </Go>
    );
  }
  return (
    <Go to={to} className="bx-next" data-overlap={overlap ? "" : undefined}>
      <span className="bx-disc bx-disc-plain" style={{ "--s": "34px" } as never} aria-hidden>
        {matches.length}
      </span>
      <span className="bx-time">{times.clock(first.scheduledAt)}</span>
      {text}
      <span className="bx-right" data-live={live ? "" : undefined}>
        {live ? <Ping /> : null}
        {live ? "live" : ""}
      </span>
    </Go>
  );
}

export function ScheduleRow({
  match,
  board,
  overlap,
  day = false,
  inEvent = false,
}: {
  match: Match;
  board: Board;
  overlap: boolean;
  /** Say which day it is on, for lists that span several. */
  day?: boolean;
  /** Shown on the page of its own event: the event's name is left out. */
  inEvent?: boolean;
}) {
  const view = board.view(match);
  const { now, times } = board;
  const wait = Date.parse(match.scheduledAt) - now;
  const known = view.sides.filter((s) => s.id);
  const title =
    !view.solo && known.length === 1 ? `${view.where} v ${known[0]!.name}` : titleOf(view);
  const score = view.headline.length === 2 ? view.headline.join("–") : undefined;
  return (
    <Link
      to="/match/$matchId"
      params={{ matchId: match.id }}
      className="bx-next"
      data-overlap={overlap ? "" : undefined}
    >
      <Duo sides={view.sides} progress={match.status === "scheduled" ? 1 - wait / SIX_HOURS : 1} />
      <span className="bx-time">
        {times.clock(match.scheduledAt)}
        {day && times.dayKey(match.scheduledAt) !== times.dayKey(now) ? (
          <span className="bx-sub" style={{ display: "block", fontFamily: "var(--face)" }}>
            {times.weekday(match.scheduledAt)} {times.dayOfMonth(match.scheduledAt)}
          </span>
        ) : null}
      </span>
      <span style={{ minWidth: 0 }}>
        <b>{title}</b>
        <span className="bx-sub">
          {inEvent
            ? `${bestOf(match.bestOf)}${view.solo ? "" : ` · ${view.where}`}`
            : view.solo
              ? lineOf(view)
              : `${lineOf(view)} · ${view.where}`}
          {overlap ? <span className="bx-only"> · may overlap with the match above</span> : null}
        </span>
      </span>
      {match.status === "live" ? (
        <span className="bx-right" data-live="">
          <Ping />
          {score ? <Tick>{score}</Tick> : "live"}
        </span>
      ) : (
        <span
          className="bx-right"
          data-half={match.status === "finished" && scoreLine(match).includes("½") ? "" : undefined}
        >
          {match.status === "finished"
            ? view.solo
              ? `${view.standings[0]?.side.name ?? ""} won`
              : scoreLine(match)
            : until(match.scheduledAt, now).replace("in ", "")}
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
        {q && !groups.length ? (
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
