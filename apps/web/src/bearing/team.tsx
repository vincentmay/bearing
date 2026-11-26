import {
  type Atlas,
  type Match,
  type Player,
  type Stint,
  type Team,
  countryName,
  tournamentStatus,
} from "@bearing/domain";
import type { CSSProperties } from "react";
import { useHistory } from "../lib/meetings";
import { achievements, didWin } from "../lib/view";
import { type Board, useBoard } from "./board";
import { Back, Go, useVisit } from "./links";
import { ScheduleRow } from "./lists";
import { type Dot, type SideView, sideOf, standIn } from "./model";
import { type LineStop, StopLine } from "./stages";
import { ResultRow } from "./today";
import { Disc, Dots, Flag, FollowStar, Problem, Role, Section, positionOf } from "./ui";

/** A team's matches as dots: filled for a win, open for a loss, the open ring for one being played. */
function resultDots(matches: Match[], id: string): Dot[] {
  return matches.flatMap((m): Dot[] => {
    if (m.status === "live") return [{ k: "now", label: "Live" }];
    const won = didWin(m, id);
    if (won === undefined) return [];
    if (won === "draw") return [{ k: "shared", label: "Draw" }];
    return [won ? { k: "won", side: 0, label: "Won" } : { k: "open" }];
  });
}

/**
 * The year as a line of stops: every event the team has played or will play. A stop is filled
 * when the team won the event; the one in progress opens into its matches.
 */
function yearStops(board: Board, team: Team, side: SideView, all: Match[]): LineStop[] {
  const { atlas, now, times } = board;
  const placed = achievements(atlas, team.id);
  const pair = [side, { ...side, color: "var(--surface)" }];
  return atlas.world.tournaments
    .filter(
      (t) =>
        t.discipline === team.discipline &&
        (t.participantIds.includes(team.id) || placed.some((x) => x.t.id === t.id)),
    )
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((t): LineStop => {
      const to = { kind: "tournament" as const, id: t.id };
      const place = placed.find((x) => x.t.id === t.id)?.p;
      if (place) {
        return {
          kind: "done",
          label: t.short,
          sub: place.rank === 1 ? "Won" : place.place,
          fill: place.rank === 1 ? side.color : undefined,
          to,
        };
      }
      const mine = all.filter((m) => m.tournamentId === t.id);
      if (
        tournamentStatus(atlas, t, now) === "upcoming" &&
        !mine.some((m) => m.status !== "scheduled")
      ) {
        return { kind: "later", label: t.short, sub: times.date(`${t.start}T12:00:00Z`), to };
      }
      const live = mine.some((m) => m.status === "live");
      const ahead = mine.find((m) => m.status === "scheduled");
      return {
        kind: "now",
        label: t.short,
        sub: live
          ? "Playing now"
          : ahead
            ? `Next ${times.day(ahead.scheduledAt, now).toLowerCase()}`
            : "In progress",
        fill: side.color,
        inner: <Dots dots={resultDots(mine, team.id)} sides={pair} fix />,
        to,
      };
    });
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
    <Section label="Who played when">
      <div className="bx-list bx-pad">
        <div className="bx-stint bx-stint-axis" aria-hidden>
          <span />
          <span className="bx-track">
            {years.map((y) => (
              <i key={y} style={{ left: `${Math.max(0, at(`${y}-01-01`))}%` }}>
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
            <Go key={s.id} to={{ kind: "player", id: s.playerId }} className="bx-stint">
              <span>
                <b>{player?.handle ?? s.playerId}</b>
              </span>
              <span
                className="bx-track"
                title={`${s.role}, ${s.from.slice(0, 4)} to ${s.to ? s.to.slice(0, 4) : "now"}`}
              >
                <i
                  className="bx-track-line"
                  style={{ left: `${from}%`, width: `${Math.max(0, to - from)}%` }}
                />
                <i
                  className="bx-track-dot"
                  style={{ left: `${from}%`, background: side.color } as CSSProperties}
                />
                {s.to ? (
                  <i className="bx-track-dot bx-track-end" style={{ left: `${to}%` }} />
                ) : null}
              </span>
            </Go>
          );
        })}
      </div>
    </Section>
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
    <Section label="By map">
      <div className="bx-list">
        {rows.map(([map, dots]) => {
          const won = dots.filter((d) => d.k === "won").length;
          return (
            <div key={map} className="bx-result">
              <span>
                <b>{map}</b>
              </span>
              <span className="bx-row" style={{ gap: 12 }}>
                <Dots dots={dots} sides={[side]} size={11} fix />
                <span className="bx-right" style={{ minWidth: 28 }}>
                  {won}–{dots.length - won}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/**
 * What a team did before the weeks Bearing keeps as matches: its series back through the
 * year, with who it played, at which event, and how it ended; and above them its record for
 * the year so far.
 */
function Earlier({ team, board }: { team: Team; board: Board }) {
  const { atlas, now, times } = board;
  const past = useHistory(team.id);
  const older = past.filter((p) => !atlas.match(p.id));
  if (!older.length) return null;
  const year = String(new Date(now).getFullYear());
  const thisYear = past.filter((p) => p.at.startsWith(year));
  const won = thisYear.filter((p) => p.won === true).length;
  const lost = thisYear.filter((p) => p.won === false).length;
  const when = (at: string) =>
    at.startsWith(year) ? times.date(at) : `${times.date(at)} ${at.slice(0, 4)}`;
  return (
    <Section label={`Earlier${thisYear.length ? ` · ${won} won, ${lost} lost in ${year}` : ""}`}>
      <div className="bx-list">
        {older.slice(0, 12).map((p) => {
          const known = atlas.team(p.opponentId);
          const body = (
            <>
              <span className="bx-who">
                <Disc
                  size={26}
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
                  <span className="bx-sub">
                    {when(p.at)} · {p.event}
                  </span>
                </span>
              </span>
              <span className="bx-h2h-score bx-num">
                <b data-won={p.won === true ? "" : undefined}>{p.score[0]}</b>
                <i className="bx-dash" />
                <b data-won={p.won === false ? "" : undefined}>{p.score[1]}</b>
              </span>
            </>
          );
          return known ? (
            <Go key={p.id} to={{ kind: "team", id: known.id }} className="bx-line bx-h2h-row">
              {body}
            </Go>
          ) : (
            <div key={p.id} className="bx-line bx-h2h-row">
              {body}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

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

export function TeamPage({ teamId }: { teamId: string }) {
  const board = useBoard(undefined, { side: teamId });
  const { atlas, now } = board;
  const team = atlas.team(teamId);
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
  const standing = atlas.world.rankings
    .find((r) => r.discipline === team.discipline)
    ?.entries.find((e) => e.competitorId === team.id);
  const lineup = lineupOf(roster, all);
  const year = yearStops(board, team, side, all);
  const won = done.filter((m) => didWin(m, team.id) === true).length;
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

  return (
    <>
      <Back />
      <header className="bx-entity">
        <Disc side={side} size={72} />
        <div>
          <h1 className="bx-display">{team.name}</h1>
          <p className="bx-sub" style={{ margin: "6px 0 0", fontSize: 13 }}>
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
        </div>
        <FollowStar follow={{ kind: "team", id: team.id }} name={team.name} />
      </header>
      {siblings.length ? (
        <p className="bx-note" style={{ margin: "12px 0 0" }}>
          The same organisation also plays{" "}
          {siblings.map((s, i) => (
            <span key={s.id}>
              {i ? ", " : ""}
              <Go to={{ kind: "team", id: s.id }}>{atlas.discipline(s.discipline).name}</Go>
            </span>
          ))}
          .
        </p>
      ) : null}

      {done.length ? (
        <dl className="bx-figures">
          <div>
            <dd className="bx-num">
              {won}
              <i className="bx-dash" />
              {done.length - won}
            </dd>
            <dt className="bx-label">Matches won, lost</dt>
          </div>
          <div>
            <dd className="bx-num">
              {games[0]}
              <i className="bx-dash" />
              {games[1]}
            </dd>
            <dt className="bx-label">{d.unit.many} won, lost</dt>
          </div>
          {standing?.rank ? (
            <div>
              <dd className="bx-num">#{standing.rank}</dd>
              <dt className="bx-label">World ranking</dt>
            </div>
          ) : null}
          {titles ? (
            <div>
              <dd className="bx-num">{titles}</dd>
              <dt className="bx-label">{titles === 1 ? "Event won" : "Events won"}</dt>
            </div>
          ) : null}
        </dl>
      ) : null}

      {/* One event is not a line; it is already said in the results below. */}
      {year.length > 1 ? (
        <section className="bx-section" style={{ marginTop: 30 }}>
          <h2 className="bx-label" style={{ marginBottom: 14 }}>
            The year, event by event
          </h2>
          <div className="bx-hero">
            <StopLine stops={year} />
          </div>
        </section>
      ) : null}

      <div className="bx-cols">
        <div>
          {live.length || next.length ? (
            <Section label="On now and next">
              <div className="bx-list">
                {[...live, ...next].map((m) => (
                  <ScheduleRow key={m.id} match={m} board={board} day />
                ))}
              </div>
            </Section>
          ) : (
            <Section label="Next">
              <div className="bx-list">
                <p className="bx-empty">Nothing is scheduled for {side.name}.</p>
              </div>
            </Section>
          )}
          {done.length ? (
            <Section label="Results">
              <div className="bx-list">
                {done.slice(0, 6).map((m) => (
                  <ResultRow key={m.id} match={m} board={board} />
                ))}
              </div>
            </Section>
          ) : null}
          <Earlier team={team} board={board} />
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
              <Section key={label} label={label}>
                <div className="bx-list">
                  {people.map(({ player, stint }) => (
                    <Go key={player.id} to={{ kind: "player", id: player.id }} className="bx-line">
                      <span className="bx-who">
                        <Disc side={sideOf(atlas, player.id)} size={30} />
                        <span>
                          <b>{player.handle}</b>
                          <span className="bx-sub">
                            {player.name || countryName(player.country)}
                          </span>
                        </span>
                      </span>
                      <Role role={stint.role} />
                      <span>{stint.from?.slice(0, 4) ?? ""}</span>
                    </Go>
                  ))}
                </div>
              </Section>
            ) : null,
          )}
          <History atlas={atlas} team={team} side={side} now={now} />
        </div>
      </div>
    </>
  );
}
