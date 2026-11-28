import "./pages-people.css";
import {
  type Atlas,
  type Follow,
  type Match,
  type Player,
  type Stint,
  type Team,
  type Tournament,
  countryName,
  tournamentStatus,
} from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Play, Rows3, Star, Trophy } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useHistory } from "../lib/meetings";
import { achievements, didWin, scoreLine } from "../lib/view";
import { useAtlas, useFollow } from "../lib/world";
import { type Board, useBoard } from "./board";
import { StateTag } from "./front";
import { Back, Go, useVisit } from "./links";
import { type Dot, type SideView, bestOf, sideOf, standIn } from "./model";
import { MatchRow } from "./rows";
import { CardSky, light } from "./sky";
import { Disc, Dots, Flag, Ping, Problem, Role, positionOf } from "./ui";

/** A team's or player's matches as dots: filled for a win, open for a loss, a ring for one on. */
function resultDots(matches: Match[], id: string): Dot[] {
  return matches.flatMap((m): Dot[] => {
    if (m.status === "live") return [{ k: "now", label: "Live" }];
    const won = didWin(m, id);
    if (won === undefined) return [];
    if (won === "draw") return [{ k: "shared", label: "Draw" }];
    return [won ? { k: "won", side: 0, label: "Won" } : { k: "open" }];
  });
}

/** Points from finished games, a win one and a draw a half, as chess counts them: "4½". */
export function points(matches: Match[], id: string): string {
  let sum = 0;
  for (const m of matches) {
    const won = didWin(m, id);
    if (won === true) sum += 1;
    else if (won === "draw") sum += 0.5;
  }
  const whole = Math.floor(sum);
  return sum % 1 ? `${whole || ""}½` : String(whole);
}

/** Follow or stop, in words, on a top card. Followed through the organisation: shown, not changed. */
export function FollowButton({ follow, name }: { follow: Follow; name: string }) {
  const atlas = useAtlas();
  const [direct, toggle] = useFollow(follow);
  const inherited =
    !direct &&
    (follow.kind === "team" || follow.kind === "player") &&
    atlas.followsCompetitor(follow.id);
  const on = direct || inherited;
  const says = inherited
    ? `${name} is followed through its organisation`
    : on
      ? `Stop following ${name}`
      : `Follow ${name}`;
  return (
    <button
      type="button"
      className="bx-btn bx-pp-follow"
      data-k="quiet"
      aria-pressed={on}
      aria-label={says}
      title={inherited ? says : undefined}
      disabled={inherited}
      onClick={toggle}
    >
      <Star size={17} aria-hidden />
      <span className="bx-pp-fl">{on ? "Following" : "Follow"}</span>
    </button>
  );
}

/** The large figures on a top card. */
export function Figures({ figs }: { figs: { value: ReactNode; label: string }[] }) {
  if (!figs.length) return null;
  return (
    <div className="bx-figs">
      {figs.map((f) => (
        <div key={f.label}>
          <b>{f.value}</b>
          <span>{f.label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * What the team or player is playing now, or next: one strip of glass in the top card, with the
 * opponent, where in the event, the score or the start, and the way to the match.
 */
export function NowStrip({
  match,
  board,
  subject,
  children,
}: {
  match: Match;
  board: Board;
  /** Whose page this is: the other side is the opponent. */
  subject: string;
  /** The follow button, which sits in the strip when there is one. */
  children?: ReactNode;
}) {
  const view = board.view(match);
  const { times, now } = board;
  const live = match.status === "live";
  const me = Math.max(
    0,
    match.sides.findIndex((s) => s.competitorId === subject),
  );
  const two = !view.solo && view.sides.length === 2;
  const opponent = two ? view.sides[1 - me] : undefined;
  const turn = (pair: string[]) => (me ? [pair[1], pair[0]] : pair).join("–");
  const started = match.status !== "scheduled" || view.resumes;
  const series =
    two && started
      ? match.bestOf > 1
        ? turn(scoreLine(match).split("–"))
        : view.headline.length === 2
          ? turn(view.headline)
          : undefined
      : undefined;
  const game = live && match.bestOf > 1 ? view.game : undefined;
  const gameScore =
    game?.scores && game.scores.length === 2 ? turn(game.scores.map(String)) : undefined;
  const big = started ? (series ?? view.headline.join(" ")) : times.clock(match.scheduledAt);
  const small = started
    ? game
      ? [game.label, gameScore].filter(Boolean).join(" ")
      : ""
    : times.day(match.scheduledAt, now);
  const stream = match.stream && match.stream.url !== "#" ? match.stream : undefined;
  const where = [view.event, two ? view.where : "", match.bestOf > 1 ? bestOf(match.bestOf) : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="bx-enow">
      <StateTag view={view} now={now} />
      {opponent ? (
        <span className="bx-pp-opp" {...light(opponent.color, 300, 0.6)}>
          <Disc side={opponent} size={30} />
        </span>
      ) : null}
      <Link to="/match/$matchId" params={{ matchId: match.id }} className="bx-enow-t bx-pp-nowt">
        <b>{opponent ? `Against ${opponent.name}` : view.where}</b>
        <span>{where}</span>
      </Link>
      {big ? (
        <div className="bx-enow-sc">
          {big}
          {small ? <small>{small}</small> : null}
        </div>
      ) : null}
      <div className="bx-enow-acts">
        {live && stream ? (
          <a href={stream.url} target="_blank" rel="noreferrer" className="bx-btn" data-k="main">
            <Play size={15} data-fill="" aria-hidden />
            Watch on {stream.label.replace(/^.* on /, "")}
          </a>
        ) : (
          <Link
            to="/match/$matchId"
            params={{ matchId: match.id }}
            className="bx-btn"
            data-k="main"
          >
            <Rows3 size={15} aria-hidden />
            {live ? "Follow it live" : "Line-ups and form"}
          </Link>
        )}
        {children}
      </div>
    </div>
  );
}

/** One event of the year, as a card. */
interface YearCard {
  t: Tournament;
  kind: "won" | "done" | "now" | "later";
  big: string;
  dots?: Dot[];
  /** For the card of the event in progress: what is next in it. */
  head?: string;
}

/**
 * The year as cards, one per event the team or player has played or will play: where they
 * finished, a trophy for a win, and the event in progress with its results as dots.
 */
export function yearOf(board: Board, id: string, discipline: string, all: Match[]): YearCard[] {
  const { atlas, now, times } = board;
  const placed = achievements(atlas, id);
  const chess = atlas.discipline(discipline as Team["discipline"]).competitor !== "team";
  return atlas.world.tournaments
    .filter(
      (t) =>
        t.discipline === discipline &&
        (t.participantIds.includes(id) || placed.some((x) => x.t.id === t.id)),
    )
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((t): YearCard => {
      const place = placed.find((x) => x.t.id === t.id)?.p;
      if (place)
        return {
          t,
          kind: place.rank === 1 ? "won" : "done",
          big: place.rank === 1 ? "Won" : place.place,
        };
      const mine = all.filter((m) => m.tournamentId === t.id);
      if (
        tournamentStatus(atlas, t, now) === "upcoming" &&
        !mine.some((m) => m.status !== "scheduled")
      ) {
        return { t, kind: "later", big: times.date(`${t.start}T12:00:00Z`) };
      }
      const finished = mine.filter((m) => m.status === "finished");
      const won = finished.filter((m) => didWin(m, id) === true).length;
      const lost = finished.filter((m) => didWin(m, id) === false).length;
      const live = mine.some((m) => m.status === "live");
      const ahead = mine.find((m) => m.status === "scheduled");
      return {
        t,
        kind: "now",
        big: finished.length
          ? chess
            ? `${points(finished, id)} of ${finished.length}`
            : `${won}–${lost} so far`
          : live
            ? "Playing now"
            : "Under way",
        dots: resultDots(mine, id),
        head: live
          ? "Now"
          : ahead
            ? `Next ${times.day(ahead.scheduledAt, now).toLowerCase()}`
            : "Under way",
      };
    });
}

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

/** The cards of the year, under a heading that names it. */
export function Year({
  cards,
  side,
  now,
  label,
}: {
  cards: YearCard[];
  side: SideView;
  now: number;
  label?: string;
}) {
  if (!cards.length) return null;
  const year = String(new Date(now).getFullYear());
  const one = cards.every((c) => c.t.start.startsWith(year));
  const pair = [side, { ...side, color: "var(--surface)" }];
  return (
    <>
      <h2 className="bx-h2">
        {label ?? (one ? year : "Events")}
        <small>event by event</small>
      </h2>
      <div className="bx-pp-yr">
        {cards.map((c) => (
          <Go
            key={c.t.id}
            to={{ kind: "tournament", id: c.t.id }}
            className="bx-pp-yc"
            style={{ "--pp-c": side.color } as CSSProperties}
          >
            <small data-k={c.kind}>
              {c.kind === "now" ? (
                <>
                  {c.head === "Now" ? <Ping /> : null}
                  {c.head}
                </>
              ) : (
                MONTH.format(new Date(`${c.t.start}T12:00:00Z`))
              )}
              {c.kind === "won" ? <Trophy size={17} aria-label="Won" /> : null}
            </small>
            {c.dots?.length ? <Dots dots={c.dots} sides={pair} size={11} fix /> : null}
            <div data-k={c.kind}>
              <b>{c.big}</b>
              <span title={c.t.name}>{c.t.name}</span>
            </div>
          </Go>
        ))}
      </div>
    </>
  );
}

/** A person of the team as a row: face, name, what they do and since when. */
export function PersonRow({
  atlas,
  player,
  stint,
  since = true,
}: {
  atlas: Atlas;
  player: Player;
  stint: Stint;
  since?: boolean;
}) {
  return (
    <Go to={{ kind: "player", id: player.id }} className="bx-pp-li">
      <Disc side={sideOf(atlas, player.id)} size={34} />
      <span>
        <b>{player.handle}</b>
        <span>{player.name || countryName(player.country)}</span>
      </span>
      <span className="bx-pp-role">
        <Role role={stint.role} />
        {since && stint.from ? <small>since {stint.from.slice(0, 4)}</small> : null}
      </span>
    </Go>
  );
}

/** Who was in the team and when: a line per player from the day they joined. */
function History({
  atlas,
  team,
  side,
  now,
}: {
  atlas: Atlas;
  team: Team;
  side: SideView;
  now: number;
}) {
  // Only stints with a known start can be put on a line of time.
  const stints = atlas.stints(team.id).filter((s): s is typeof s & { from: string } => !!s.from);
  if (!stints.length) return null;
  const start = Math.min(...stints.map((s) => Date.parse(s.from)));
  const span = Math.max(1, now - start);
  const at = (iso: string) => ((Date.parse(iso) - start) / span) * 100;
  const first = new Date(start).getUTCFullYear();
  const last = new Date(now).getUTCFullYear();
  const years = Array.from({ length: last - first + 1 }, (_, i) => first + i).filter(
    (y, _, list) => list.length <= 5 || (y - first) % Math.ceil(list.length / 5) === 0,
  );
  return (
    <>
      <h2 className="bx-h2">Who played when</h2>
      <div className="bx-panel bx-pp-hist" style={{ "--pp-c": side.color } as CSSProperties}>
        <div className="bx-pp-st" aria-hidden>
          <span />
          <span className="bx-pp-tr">
            {years.map((y) => (
              <i key={y} className="bx-pp-yl" style={{ left: `${Math.max(0, at(`${y}-01-01`))}%` }}>
                {y}
              </i>
            ))}
          </span>
        </div>
        {[...stints].reverse().map((s) => {
          const player = atlas.player(s.playerId);
          const from = at(s.from);
          const to = s.to ? at(s.to) : 100;
          return (
            <Go key={s.id} to={{ kind: "player", id: s.playerId }} className="bx-pp-st">
              <b>{player?.handle ?? s.playerId}</b>
              <span
                className="bx-pp-tr"
                title={`${s.role}, ${s.from.slice(0, 4)} to ${s.to ? s.to.slice(0, 4) : "now"}`}
              >
                <i
                  className="bx-pp-tl"
                  data-on={s.to ? undefined : ""}
                  style={{ left: `${from}%`, width: `${Math.max(0, to - from)}%` }}
                />
                <i className="bx-pp-td" style={{ left: `${from}%` }} />
                {s.to ? <i className="bx-pp-td" data-end="" style={{ left: `${to}%` }} /> : null}
              </span>
            </Go>
          );
        })}
      </div>
    </>
  );
}

/** How the team has done on each map, game by game. */
function Maps({ all, team, side }: { all: Match[]; team: Team; side: SideView }) {
  const maps = new Map<string, Dot[]>();
  for (const m of all) {
    const index = m.sides.findIndex((s) => s.competitorId === team.id);
    for (const g of m.games) {
      if (g.status !== "finished" || typeof g.winner !== "number") continue;
      // "Map 2" is a position in a series, not a map: where the name is not known, say nothing.
      if (/^Map \d+$/.test(g.label)) continue;
      const list = maps.get(g.label) ?? [];
      list.push(g.winner === index ? { k: "won", side: 0, label: "Won" } : { k: "open" });
      maps.set(g.label, list);
    }
  }
  const rows = [...maps.entries()].sort((a, b) => b[1].length - a[1].length);
  if (!rows.length) return null;
  return (
    <>
      <h2 className="bx-h2">By map</h2>
      <div className="bx-panel">
        {rows.map(([map, dots]) => {
          const won = dots.filter((d) => d.k === "won").length;
          return (
            <div key={map} className="bx-pp-bm">
              <b>{map}</b>
              <Dots dots={dots} sides={[side]} size={11} fix />
              <span>
                {won}–{dots.length - won}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/**
 * What a team did before the weeks Bearing keeps as matches: its series back through the
 * year, with who it played, at which event, and how it ended.
 */
function Earlier({ older, board, record }: { older: Past[]; board: Board; record: string }) {
  const { atlas, now, times } = board;
  if (!older.length) return null;
  const year = String(new Date(now).getFullYear());
  const when = (at: string) =>
    at.startsWith(year) ? times.date(at) : `${times.date(at)} ${at.slice(0, 4)}`;
  return (
    <>
      <h2 className="bx-h2">
        Earlier
        {record ? <small>{record}</small> : null}
      </h2>
      <div className="bx-panel">
        {older.slice(0, 12).map((p) => {
          const known = atlas.team(p.opponentId);
          const body = (
            <>
              <Disc
                size={30}
                side={
                  known
                    ? sideOf(atlas, known.id)
                    : standIn({
                        name: p.opponent,
                        short: p.opponent.slice(0, 2).toUpperCase(),
                        image: p.image,
                        person: false,
                      })
                }
              />
              <span>
                <b>{p.opponent}</b>
                <span>
                  {when(p.at)} · {p.event}
                </span>
              </span>
              <span
                className="bx-pp-out"
                data-w={p.won === true ? "1" : p.won === false ? "0" : ""}
              >
                <b>
                  {p.score[0]}–{p.score[1]}
                </b>
                <small>{p.won === true ? "Won" : p.won === false ? "Lost" : ""}</small>
              </span>
            </>
          );
          return known ? (
            <Go key={p.id} to={{ kind: "team", id: known.id }} className="bx-pp-li">
              {body}
            </Go>
          ) : (
            <div key={p.id} className="bx-pp-li">
              {body}
            </div>
          );
        })}
      </div>
    </>
  );
}

type Past = ReturnType<typeof useHistory>[number];
type Person = { stint: Stint; player: Player };
const POSITION_ORDER = ["top", "jungle", "mid", "bot", "support"];

/**
 * A team's people as they take the field: those who play, in the order of their positions;
 * those who wait behind them; and those who do not play at all. Where two hold one position,
 * the one with more games on record plays and the other waits.
 */
export function lineupOf(roster: Person[], matches: Match[]) {
  const staff = roster.filter((r) => /coach|manager|analyst/i.test(r.stint.role));
  const players = roster.filter((r) => !staff.includes(r));
  const games = new Map<string, number>();
  for (const m of matches)
    for (const g of m.games)
      for (const line of g.lines ?? [])
        if (line.playerId) games.set(line.playerId, (games.get(line.playerId) ?? 0) + 1);
  const at = (r: Person) => POSITION_ORDER.indexOf(positionOf(r.stint.role) ?? "");
  if (!players.some((r) => at(r) >= 0)) return { playing: players, bench: [], staff };
  const playing: Person[] = [];
  const bench: Person[] = [];
  for (const [index] of POSITION_ORDER.entries()) {
    const here = players
      .filter((r) => at(r) === index)
      .sort((x, y) => (games.get(y.player.id) ?? 0) - (games.get(x.player.id) ?? 0));
    playing.push(...here.slice(0, 1));
    bench.push(...here.slice(1));
  }
  // Someone whose position is not said is taken to play.
  playing.push(...players.filter((r) => at(r) < 0));
  return { playing, bench, staff };
}

/** Where a team or player stands in its game's ranking, if it is in one. */
export function rankOf(atlas: Atlas, discipline: string, id: string): number | undefined {
  const entries = atlas.world.rankings.find((r) => r.discipline === discipline)?.entries ?? [];
  const at = entries.findIndex((e) => e.competitorId === id);
  return at < 0 ? undefined : (entries[at]!.rank ?? at + 1);
}

export function TeamPage({ teamId }: { teamId: string }) {
  const board = useBoard(teamId, { side: teamId });
  const { atlas, now } = board;
  const team = atlas.team(teamId);
  const past = useHistory(team?.id);
  useVisit("team", teamId, !!team);
  if (!team) {
    return (
      <>
        <Back />
        <Problem title="This team could not be found.">
          It may have been removed, or the link is wrong.
        </Problem>
      </>
    );
  }
  const side = sideOf(atlas, team.id);
  const d = atlas.discipline(team.discipline);
  const all = atlas.matchesFor(team.id);
  const live = all.filter((m) => m.status === "live");
  const next = all.filter((m) => m.status === "scheduled").slice(0, 3);
  const done = all.filter((m) => m.status === "finished").reverse();
  const siblings = atlas.world.competitors.filter(
    (c): c is Team =>
      c.kind === "team" && !!team.orgId && c.orgId === team.orgId && c.id !== team.id,
  );
  const roster = atlas.roster(team.id);
  const rank = rankOf(atlas, team.discipline, team.id);
  const lineup = lineupOf(roster, all);
  const year = yearOf(board, team.id, team.discipline, all);
  // Maps or games won and lost, across every finished match.
  const games = done.reduce(
    (sum, m) => {
      const index = m.sides.findIndex((x) => x.competitorId === team.id);
      for (const g of m.games) {
        if (g.status !== "finished" || typeof g.winner !== "number") continue;
        sum[g.winner === index ? 0 : 1]!++;
      }
      return sum;
    },
    [0, 0],
  );
  const titles = achievements(atlas, team.id).filter((x) => x.p.rank === 1).length;
  // The year's record: the matches Bearing keeps, and the series before them it looked up.
  const thisYear = String(new Date(now).getFullYear());
  const kept = done.filter((m) => m.scheduledAt.startsWith(thisYear));
  const older = past.filter((p) => !atlas.match(p.id));
  const olderYear = older.filter((p) => p.at.startsWith(thisYear));
  const won =
    kept.filter((m) => didWin(m, team.id) === true).length +
    olderYear.filter((p) => p.won === true).length;
  const lost =
    kept.filter((m) => didWin(m, team.id) === false).length +
    olderYear.filter((p) => p.won === false).length;
  const pastYear = past.filter((p) => p.at.startsWith(thisYear));
  const record = pastYear.length
    ? `${pastYear.filter((p) => p.won === true).length} won, ${pastYear.filter((p) => p.won === false).length} lost in ${thisYear}`
    : "";
  const front = live[0] ?? next[0];
  const follow = <FollowButton follow={{ kind: "team", id: team.id }} name={team.name} />;
  const figs = [
    ...(rank ? [{ value: `#${rank}`, label: "World ranking" }] : []),
    ...(won + lost ? [{ value: `${won}–${lost}`, label: `Matches in ${thisYear}` }] : []),
    ...(titles
      ? [{ value: String(titles), label: titles === 1 ? "Event won" : "Events won" }]
      : []),
  ];

  return (
    <>
      <Back />
      <section className="bx-stage" data-live={live.length ? "" : undefined}>
        <CardSky />
        <div className="bx-ent-in">
          <div className="bx-eh">
            <span className="bx-pp-mark" {...light(side.color, 620, 1)}>
              <Disc side={side} size={84} />
            </span>
            <div>
              <h1>{team.name}</h1>
              <p>
                <Flag country={team.country} />
                {[
                  d.name,
                  team.region,
                  countryName(team.country),
                  team.founded && `since ${team.founded}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {siblings.length ? (
                <p className="bx-pp-also">
                  Also plays
                  {siblings.map((s) => (
                    <Go key={s.id} to={{ kind: "team", id: s.id }}>
                      {atlas.discipline(s.discipline).name}
                      <ChevronRight size={14} aria-hidden />
                    </Go>
                  ))}
                </p>
              ) : null}
            </div>
            <Figures figs={figs} />
            {front ? null : <div className="bx-eh-acts">{follow}</div>}
          </div>
          {front ? (
            <NowStrip match={front} board={board} subject={team.id}>
              {follow}
            </NowStrip>
          ) : null}
        </div>
      </section>

      <Year cards={year} side={side} now={now} />

      <div className="bx-cols2">
        <div>
          {live.length || next.length ? (
            <>
              <h2 className="bx-h2">{live.length ? "On now and next" : "Next"}</h2>
              <div className="bx-rows">
                {[...live, ...next].map((m) => (
                  <MatchRow key={m.id} match={m} board={board} day />
                ))}
              </div>
            </>
          ) : null}
          {done.length ? (
            <>
              <h2 className="bx-h2">
                Results
                <small>
                  {games[0]}–{games[1]} in {d.unit.many.toLowerCase()}
                </small>
              </h2>
              <div className="bx-rows">
                {done.slice(0, 6).map((m) => (
                  <MatchRow key={m.id} match={m} board={board} day />
                ))}
              </div>
            </>
          ) : null}
          <Earlier older={older} board={board} record={record} />
          {team.discipline === "cs2" ? <Maps all={all} team={team} side={side} /> : null}
        </div>
        <div>
          {(
            [
              ["Line-up", lineup.playing],
              ["Substitutes", lineup.bench],
              ["Staff", lineup.staff],
            ] as const
          ).map(([label, people]) =>
            people.length ? (
              <div key={label}>
                <h2 className="bx-h2">{label}</h2>
                <div className="bx-panel">
                  {people.map(({ player, stint }) => (
                    <PersonRow key={player.id} atlas={atlas} player={player} stint={stint} />
                  ))}
                </div>
              </div>
            ) : null,
          )}
          <History atlas={atlas} team={team} side={side} now={now} />
        </div>
      </div>
    </>
  );
}
