import "./pages-event.css";
import {
  type Match,
  type Stage,
  type Tournament,
  champion,
  countryName,
  dateRange,
  money,
  tournamentStatus,
  winnerOf,
} from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  CalendarDays,
  MapPin,
  Play,
  Rows3,
  Star,
  Trophy,
  Tv,
  Users,
} from "lucide-react";
import { Fragment, type ReactNode, useState } from "react";
import { scoreLine } from "../lib/view";
import { useFollow } from "../lib/world";
import { type Board, useBoard, useWide } from "./board";
import { Bracket, DoubleBracket } from "./bracket";
import { SeriesList } from "./chess/series";
import { leadOf } from "./front";
import { Back, Go, useVisit } from "./links";
import { Source } from "./match";
import { type MatchView, plainName, sideOf } from "./model";
import { MatchRow, RoundLine } from "./rows";
import { CardSky, light } from "./sky";
import { CrossTable, Heat } from "./stages";
import { SwissLadder } from "./swiss";
import { until } from "./time";
import { Disc, EventMark, Flag, Ping, Problem, Waiting, TopCard } from "./ui";

const DAY = 86_400_000;
const COUNT = ["no", "one", "two", "three", "four", "five", "six"];

/** "Semifinals" as it reads after a comma: "Now, semifinals". An acronym keeps its capitals. */
function lowerFirst(name: string): string {
  return /^[A-Z][A-Z0-9]/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

/** A pairing on one line, for rounds with many games: who played whom, and how it stands. */
function PairRow({ match, board }: { match: Match; board: Board }) {
  const view = board.view(match);
  const solo = view.discipline.competitor === "player";
  const single = match.bestOf === 1;
  const game = match.games[0];
  // A single game of chess is written the way chess writes it: White first.
  const first = solo && single ? (game?.firstSide ?? 0) : 0;
  const order = [first, 1 - first];
  const won = match.status === "finished" ? winnerOf(match) : undefined;
  const move = view.game?.chess?.move ?? game?.chess?.move;
  const result =
    won === undefined
      ? scoreLine(match)
      : !single
        ? scoreLine(match)
        : won === "draw"
          ? "½–½"
          : won === first
            ? "1–0"
            : "0–1";
  const side = (index: number, mirror: boolean) => {
    const s = view.sides[index];
    const player = s?.id ? board.atlas.player(s.id) : undefined;
    return (
      <span
        className="bx-e-pside"
        data-mirror={mirror ? "" : undefined}
        data-lost={typeof won === "number" && won !== index ? "" : undefined}
      >
        {solo ? <Flag country={player?.country} keep /> : s ? <Disc side={s} size={22} /> : null}
        <b>{s?.name ?? "TBD"}</b>
        {player?.title ? <i>{player.title}</i> : null}
        {player?.rating ? <small>{player.rating.value}</small> : null}
      </span>
    );
  };
  return (
    <Link to="/match/$matchId" params={{ matchId: match.id }} className="bx-e-pair">
      {side(order[0]!, false)}
      <span className="bx-e-pmid" data-live={view.live ? "" : undefined}>
        {view.live ? <Ping /> : null}
        {view.live
          ? move
            ? `move ${move}`
            : "live"
          : match.status === "finished"
            ? result
            : board.times.clock(match.scheduledAt)}
      </span>
      {side(order[1]!, true)}
    </Link>
  );
}

/**
 * The rounds of a stage, in the order they are played. A short round lists its matches in full.
 * A long one (a chess open has dozens of boards) lists pairings a line each, and only the round
 * being played, or the latest one, is open; the others open at a tap.
 */
function Rounds({ stage, board }: { stage: Stage; board: Board }) {
  const rounds = stage.rounds
    .map((round) => ({
      round,
      matches: round.matchIds.flatMap((id) => board.atlas.match(id) ?? []),
    }))
    .filter((r) => r.matches.length);
  const long = rounds.some((r) => r.matches.length > 6);
  if (!long) {
    return (
      <>
        {rounds.map(({ round, matches }) => (
          <div key={round.id} className="bx-e-round">
            <h3 className="bx-cap">
              <span>{round.name}</span>
              <span>{matches.length} games</span>
            </h3>
            <div className="bx-rows">
              {matches.map((m) => (
                <MatchRow key={m.id} match={m} board={board} day inEvent />
              ))}
            </div>
          </div>
        ))}
      </>
    );
  }
  const current =
    rounds.find((r) => r.matches.some((m) => m.status === "live")) ??
    rounds.findLast((r) => r.matches.some((m) => m.status === "finished")) ??
    rounds[0];
  // The round that matters now first, then the rest, latest first.
  const ordered = [
    ...rounds.filter((r) => r === current),
    ...rounds.filter((r) => r !== current).reverse(),
  ];
  return (
    <div className="bx-e-folds">
      {ordered.map(({ round, matches }) => {
        const live = matches.filter((m) => m.status === "live").length;
        const done = matches.filter((m) => m.status === "finished").length;
        return (
          <details key={round.id} className="bx-e-fold" open={round === current?.round}>
            <summary>
              <b>
                {live ? <Ping /> : null}
                {round.name}
              </b>
              <span>
                {matches.length} games
                {live ? `, ${live} being played` : done === matches.length ? ", all played" : ""}
              </span>
            </summary>
            <div className="bx-e-pairs">
              {matches.map((m) => (
                <PairRow key={m.id} match={m} board={board} />
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

/** A stage drawn for its format: a ladder, a bracket, a cross table, heats or rounds. */
function StageDrawing({
  stage,
  tournament,
  board,
  wide,
}: {
  stage: Stage;
  tournament: Tournament;
  board: Board;
  wide: boolean;
}) {
  const matches = board.atlas.stageMatches(stage);
  // The stage's matches may be on their way: an event from weeks back asks for them by name.
  if (!matches.length && board.loading) return <Waiting inner at="tournament" />;
  if (!matches.length && stage.format !== "swiss") {
    return <p className="bx-e-empty">This stage has not been drawn yet.</p>;
  }
  // An event played as matches: each with its games, written the way chess writes a match.
  if (stage.id === "matches") return <SeriesList matches={matches} board={board} />;
  // A list of rounds, for a stage known only as its pairings.
  if (stage.format === "rounds") return <Rounds stage={stage} board={board} />;
  if (stage.format === "swiss")
    return <SwissLadder stage={stage} tournament={tournament} board={board} />;
  if (stage.format === "round-robin") {
    return (
      <div className="bx-panel bx-e-pad">
        <CrossTable stage={stage} tournament={tournament} board={board} />
      </div>
    );
  }
  if (stage.format === "cup") {
    const through = stage.rules?.advancePerMatch ?? 1;
    return (
      <div className="bx-e-cup">
        {stage.rounds.map((round) => {
          const heats = round.matchIds.flatMap((id) => board.atlas.match(id) ?? []);
          return heats.length ? (
            <div key={round.id} className="bx-e-heats">
              {heats.map((m) => (
                <Heat key={m.id} match={m} board={board} through={through} />
              ))}
            </div>
          ) : null;
        })}
      </div>
    );
  }
  return (
    <div className="bx-panel bx-e-pad">
      {stage.format === "double-elim" ? (
        <DoubleBracket stage={stage} board={board} wide={wide} />
      ) : (
        <Bracket stage={stage} board={board} wide={wide} />
      )}
    </div>
  );
}

/** Who plays in a stage, as far as its matches say; else everyone in the event. */
function stageField(board: Board, stage: Stage, tournament: Tournament): number {
  const ids = new Set<string>();
  for (const m of board.atlas.stageMatches(stage))
    for (const s of m.sides) if (s.competitorId) ids.add(s.competitorId);
  return ids.size || tournament.participantIds.length;
}

/** The few words beside a stage's name: how many play it, and the way it is played. */
function stageLine(board: Board, stage: Stage, tournament: Tournament): string {
  const team = board.atlas.discipline(tournament.discipline).competitor === "team";
  const n = stageField(board, stage, tournament);
  const who = n ? `${n} ${team ? "teams" : "players"}` : "";
  const how =
    stage.format === "swiss"
      ? `${COUNT[stage.rules?.winsToAdvance ?? 3] ?? ""} wins go through, ${COUNT[stage.rules?.lossesToExit ?? 3] ?? ""} losses go out`
      : stage.format === "single-elim"
        ? "single elimination"
        : stage.format === "double-elim"
          ? "double elimination"
          : stage.format === "round-robin"
            ? "everyone plays everyone"
            : stage.format === "cup"
              ? `the top ${COUNT[stage.rules?.advancePerMatch ?? 1] ?? ""} of each match go through`
              : stage.format === "rounds"
                ? `${stage.rounds.length} rounds`
                : "";
  return [who, how].filter(Boolean).join(" · ");
}

/** Where a stage stands, in the small line of its pick: "Now, round 4", "From Mon 30 Nov". */
function stageWhen(board: Board, stage: Stage): string {
  const { atlas, times } = board;
  const ms = atlas.stageMatches(stage).sort((x, y) => x.scheduledAt.localeCompare(y.scheduledAt));
  const live = ms.find((m) => m.status === "live");
  const round = (m: Match) => atlas.roundOf(m)?.name;
  if (live) return round(live) ? `Now, ${lowerFirst(round(live)!)}` : "Now";
  if (ms.length && ms.every((m) => m.status === "finished")) return "Finished";
  const from = `From ${times.date(`${stage.start}T12:00:00Z`).replace(",", "")}`;
  if (!ms.some((m) => m.status === "finished")) return from;
  const next = ms.find((m) => m.status !== "finished");
  return next && round(next) ? `Next, ${lowerFirst(round(next)!)}` : "Under way";
}

/** What a part of an event is called once the event's own name is taken off it. */
function partName(part: Tournament, series: string): string {
  const rest = part.name.startsWith(series) ? part.name.slice(series.length) : part.name;
  return rest.replace(/^[\s:|–-]+/, "").trim() || part.name;
}

/** Follow the event, or stop: a button in the top card, with Sunrise's star when on. */
function FollowEvent({ id, name }: { id: string; name: string }) {
  const [on, toggle] = useFollow({ kind: "tournament", id });
  return (
    <button
      type="button"
      className="bx-btn"
      data-k="quiet"
      aria-pressed={on}
      aria-label={on ? `Stop following ${name}` : `Follow ${name}`}
      onClick={toggle}
    >
      <Star size={17} aria-hidden />
      {on ? "Following" : "Follow"}
    </button>
  );
}

/**
 * The match of the event being played now, as a strip of glass in the top card. The event has no
 * colour of its own: the card's sky takes the colours of whoever is playing.
 */
function NowStrip({ view, others }: { view: MatchView; others: number }) {
  const { match } = view;
  const [a, b] = view.sides;
  const stream = match.stream && match.stream.url !== "#" ? match.stream : undefined;
  const detail = view.status.replace(/^Live(?: · )?/, "");
  const line = [view.where, detail, others ? `${others} more live` : ""]
    .filter(Boolean)
    .join(" · ");
  const lead = leadOf(view);
  const duo =
    view.solo || !a || !b ? (
      <span className="bx-e-duo">
        <span>{view.where}</span>
      </span>
    ) : (
      <>
        <span {...light(a.color, 340, lead >= 0 ? 0.8 : 0.65)}>
          <Disc side={a} size={30} />
        </span>
        <span className="bx-e-duo">
          <span>
            <i>{a.name}</i>
            <i>{a.label}</i>
          </span>
          <b>{match.bestOf > 1 ? scoreLine(match) : view.headline.join("–")}</b>
          <span>
            <i>{b.name}</i>
            <i>{b.label}</i>
          </span>
        </span>
        <span {...light(b.color, 340, lead >= 0 ? 0.65 : 0.8)}>
          <Disc side={b} size={30} />
        </span>
      </>
    );
  return (
    <div className="bx-enow bx-e-now">
      <span className="bx-tag">
        <Ping />
        Live
      </span>
      <Link
        to="/match/$matchId"
        params={{ matchId: match.id }}
        className="bx-e-duos"
        aria-label={view.solo ? view.where : `${a?.name ?? ""} against ${b?.name ?? ""}`}
      >
        {duo}
      </Link>
      <div className="bx-enow-t">
        <span>{view.solo ? view.subs.filter(Boolean).join(" · ") || line : line}</span>
      </div>
      <div className="bx-enow-acts">
        {stream ? (
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
            Follow it live
          </Link>
        )}
      </div>
    </div>
  );
}

/** One line of a panel: an icon or a mark, two lines of words, and something at the end. */
function Line({
  icon,
  title,
  sub,
  end,
}: {
  icon: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  end?: ReactNode;
}) {
  return (
    <div className="bx-e-li">
      {icon}
      <div>
        <b>{title}</b>
        {sub ? <span>{sub}</span> : null}
      </div>
      {end ?? <span />}
    </div>
  );
}

/** Everyone in an event, each a way to their own page. */
function Entrants({ ids, board }: { ids: string[]; board: Board }) {
  const { atlas } = board;
  return (
    <div className="bx-e-ents">
      {ids.map((id) => {
        const c = atlas.competitor(id);
        if (!c) return null;
        return (
          <Go key={id} to={{ kind: c.kind, id }} className="bx-e-ent">
            <Disc side={sideOf(atlas, id)} size={26} />
            <b>{plainName(atlas, id)}</b>
            {c.kind === "player" ? <Flag country={c.country} /> : null}
          </Go>
        );
      })}
    </div>
  );
}

/** What the viewer follows in this event: how each one stands, and what it is doing now. */
function Yours({ t, board, matches }: { t: Tournament; board: Board; matches: Match[] }) {
  const { atlas, times, now } = board;
  const ids = t.participantIds.filter((id) => atlas.followsCompetitor(id)).slice(0, 6);
  if (!ids.length) return null;
  return (
    <>
      <h2 className="bx-h2">Yours here</h2>
      <div className="bx-panel">
        {ids.map((id) => {
          const kind = atlas.competitor(id)?.kind ?? "team";
          const theirs = matches.filter((m) => m.sides.some((s) => s.competitorId === id));
          const live = theirs.find((m) => m.status === "live");
          const next = theirs
            .filter((m) => m.status === "scheduled")
            .sort((x, y) => x.scheduledAt.localeCompare(y.scheduledAt))[0];
          const place = t.placements?.find((p) => p.competitorIds.includes(id))?.place;
          const against = (m: Match) =>
            plainName(atlas, m.sides.find((s) => s.competitorId !== id)?.competitorId);
          const sub = live
            ? `Against ${against(live)} now`
            : next
              ? `${against(next) || "Next"} · ${times.day(next.scheduledAt, now)}, ${times.clock(next.scheduledAt)}`
              : place
                ? `Finished ${place}`
                : "Taking part";
          return (
            <Go key={id} to={{ kind, id }} className="bx-e-lgo">
              <Line
                icon={<Disc side={sideOf(atlas, id)} size={30} />}
                title={plainName(atlas, id)}
                sub={sub}
                end={
                  live ? (
                    <em className="bx-e-live">
                      <Ping />
                      {scoreLine(live)}
                    </em>
                  ) : undefined
                }
              />
            </Go>
          );
        })}
      </div>
    </>
  );
}

export function TournamentPage({ tournamentId }: { tournamentId: string }) {
  const board = useBoard(undefined, { event: tournamentId });
  const wide = useWide();
  const { atlas, now, times } = board;
  const t = atlas.tournament(tournamentId);
  const [chosen, setChosen] = useState<string>();
  useVisit("tournament", tournamentId, !!t);
  if (!t) {
    return (
      <>
        <Back />
        <Problem title="This event could not be found.">
          It may have been removed, or the link is wrong.
        </Problem>
      </>
    );
  }
  const d = atlas.discipline(t.discipline);
  const team = d.competitor === "team";
  const status = tournamentStatus(atlas, t, now);
  const matches = atlas.matchesOf(t.id);
  const live = matches
    .filter((m) => m.status === "live")
    .sort((x, y) => Number(atlas.isFollowed(y)) - Number(atlas.isFollowed(x)));
  const next = matches
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .slice(0, 4);
  // In the order they are played; stages played side by side (groups) by their names.
  const stages = [...t.stages].sort(
    (x, y) =>
      x.start.localeCompare(y.start) ||
      x.end.localeCompare(y.end) ||
      x.name.localeCompare(y.name, undefined, { numeric: true }),
  );
  // The stage to open on is the one still being played.
  const current =
    stages.find((s) => atlas.stageMatches(s).some((m) => m.status !== "finished")) ?? stages.at(-1);
  const stage = t.stages.find((s) => s.id === chosen) ?? current;
  const winner = champion(t);
  // The other parts of the same event: its group stage, its semifinals, its final.
  const parts = t.series
    ? atlas.world.tournaments
        .filter((x) => x.series === t.series && x.discipline === t.discipline)
        .sort((x, y) => x.start.localeCompare(y.start) || x.name.localeCompare(y.name))
    : [];
  const entrants = t.participantIds.filter((id) => atlas.competitor(id));
  const place = t.location
    ? [t.location.city, countryName(t.location.country)].filter(Boolean).join(", ")
    : // No place is on record. That may mean online, but nothing says so.
      undefined;
  const startAt = Date.parse(`${t.start}T00:00:00Z`);
  const days = Math.round((Date.parse(`${t.end}T00:00:00Z`) - startAt) / DAY) + 1;
  const today = Math.floor((Date.parse(`${times.dayKey(now)}T00:00:00Z`) - startAt) / DAY) + 1;
  const stream = matches.find((m) => m.stream && m.stream.url !== "#")?.stream;
  const lead = live[0];

  const tag =
    status === "live" ? (
      live.length ? (
        <span className="bx-tag">
          <Ping />
          Live
        </span>
      ) : (
        <span className="bx-tag" data-k="later">
          Under way
        </span>
      )
    ) : status === "upcoming" ? (
      <span
        className="bx-tag"
        data-k={Date.parse(`${t.start}T12:00:00Z`) - now < DAY ? "soon" : "later"}
      >
        Starts {until(`${t.start}T12:00:00Z`, now)}
      </span>
    ) : (
      <span className="bx-tag" data-k="done">
        Finished
      </span>
    );
  const said =
    status === "live" && days > 1 && today >= 1 && today <= days ? (
      <>
        <b>
          Day {today} of {days}
        </b>{" "}
        · {d.name}
      </>
    ) : status === "completed" && winner ? (
      <>
        <b>Won by {plainName(atlas, winner)}</b> · {d.name}
      </>
    ) : (
      d.name
    );
  const facts = [
    dateRange(t.start, t.end),
    place ? (
      <span key="p" className="bx-e-where">
        <Flag country={t.location?.country} />
        {place}
      </span>
    ) : null,
    t.organizer || null,
    t.prize ? money(t.prize.amount, t.prize.currency) : null,
  ].filter(Boolean);

  // A part of the event is picked by its own address when the source keeps the parts apart, and
  // on the page when they are stages of one event.
  const partPicks =
    parts.length > 1 ? (
      <nav className="bx-picks bx-e-picks" aria-label={`Parts of ${t.series}`}>
        {/* The parts of one event are one page: choosing another changes what the page
            shows. Nothing is left and nothing is entered, the page stays where it is
            scrolled to, and going back leads out of the event, not through its parts. */}
        {parts.map((part) => {
          const s = tournamentStatus(atlas, part, now);
          return (
            <Link
              key={part.id}
              to="/tournament/$tournamentId"
              params={{ tournamentId: part.id }}
              replace
              resetScroll={false}
              aria-current={part.id === t.id ? "page" : undefined}
            >
              <small>
                {s === "live"
                  ? "Now"
                  : s === "upcoming"
                    ? `From ${times.date(`${part.start}T12:00:00Z`).replace(",", "")}`
                    : "Finished"}
              </small>
              {partName(part, t.series ?? "")}
            </Link>
          );
        })}
      </nav>
    ) : null;
  const stagePicks =
    t.stages.length > 1 && stage ? (
      <div className="bx-picks bx-e-picks" role="group" aria-label="Stage">
        {stages.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === stage.id}
            onClick={() => setChosen(s.id)}
          >
            <small>{stageWhen(board, s)}</small>
            {s.name}
          </button>
        ))}
      </div>
    ) : null;

  const soon = [...live, ...next];
  // A round of many boards is one line here; its pairings are in the drawing above.
  const rounds = new Map<string, Match[]>();
  for (const m of soon) {
    const key = atlas.roundOf(m)?.id ?? m.id;
    rounds.set(key, [...(rounds.get(key) ?? []), m]);
  }
  const lines = [...rounds.values()];

  return (
    <>
      <Back />
      <TopCard className="bx-stage bx-e-card" data-live={lead ? "" : undefined}>
        <CardSky />
        <div className="bx-ent-in">
          <div className="bx-eh">
            <div>
              <div className="bx-hrow">
                {tag}
                <span>{said}</span>
              </div>
              <h1 className="bx-e-name">
                {t.image ? (
                  <span className="bx-e-mark">
                    <EventMark image={t.image} size={52} />
                  </span>
                ) : null}
                {t.name}
              </h1>
              <p className="bx-e-facts">
                {facts.map((f, i) => (
                  <Fragment key={i}>
                    {i ? " " : null}
                    <span>{f}</span>
                  </Fragment>
                ))}
              </p>
            </div>
            <div className="bx-eh-acts">
              <FollowEvent id={t.id} name={t.name} />
            </div>
          </div>
          {lead ? <NowStrip view={board.view(lead)} others={live.length - 1} /> : null}
          {partPicks}
          {stagePicks}
        </div>
      </TopCard>

      <div key={t.id} className="bx-view bx-e-cols">
        <div>
          {stage ? (
            <>
              <h2 className="bx-h2">
                {stage.name}
                <small>{stageLine(board, stage, t)}</small>
              </h2>
              <StageDrawing stage={stage} tournament={t} board={board} wide={wide} />
              {stage.explainer ? <p className="bx-e-note">{stage.explainer}</p> : null}
            </>
          ) : null}
          {lines.length ? (
            <>
              <h2 className="bx-h2">
                {live.length ? "On now and next" : "Next"}
                {live.length ? <small>live first</small> : null}
              </h2>
              <div className="bx-rows">
                {lines.map((ms) =>
                  ms.length > 6 ? (
                    <RoundLine key={ms[0]!.id} matches={ms} board={board} inEvent />
                  ) : (
                    ms.map((m) => <MatchRow key={m.id} match={m} board={board} day inEvent />)
                  ),
                )}
              </div>
            </>
          ) : null}
          {entrants.length ? (
            <>
              <h2 className="bx-h2">
                Taking part
                <small>
                  {entrants.length} {team ? "teams" : "players"}
                </small>
              </h2>
              <Entrants ids={entrants} board={board} />
            </>
          ) : null}
        </div>
        <div>
          <Yours t={t} board={board} matches={matches} />
          <h2 className="bx-h2">About</h2>
          <div className="bx-panel">
            {t.location ? (
              <Line
                icon={
                  <span className="bx-e-ico">
                    <MapPin size={15} aria-hidden />
                  </span>
                }
                title={t.location.venue ?? t.location.city}
                sub={
                  <span className="bx-e-where">
                    <Flag country={t.location.country} />
                    {place}
                  </span>
                }
              />
            ) : null}
            <Line
              icon={
                <span className="bx-e-ico">
                  <CalendarDays size={15} aria-hidden />
                </span>
              }
              title={dateRange(t.start, t.end)}
              sub={days > 1 ? `${days} days` : "One day"}
            />
            {entrants.length ? (
              <Line
                icon={
                  <span className="bx-e-ico">
                    <Users size={15} aria-hidden />
                  </span>
                }
                title={`${entrants.length} ${team ? "teams" : "players"}`}
                sub={
                  stage && stages.length > 1
                    ? `${stage.name}: ${stageField(board, stage, t)}`
                    : "Taking part"
                }
              />
            ) : null}
            {t.prize ? (
              <Line
                icon={
                  <span className="bx-e-ico">
                    <Trophy size={15} aria-hidden />
                  </span>
                }
                title={money(t.prize.amount, t.prize.currency)}
                sub="Prize money"
              />
            ) : null}
            {t.organizer ? (
              <Line
                icon={
                  <span className="bx-e-ico">
                    <Building2 size={15} aria-hidden />
                  </span>
                }
                title={t.organizer}
                sub="Organiser"
              />
            ) : null}
            {stream ? (
              <a href={stream.url} target="_blank" rel="noreferrer" className="bx-e-lgo">
                <Line
                  icon={
                    <span className="bx-e-ico">
                      <Tv size={15} aria-hidden />
                    </span>
                  }
                  title={stream.label}
                  sub="Where to watch"
                />
              </a>
            ) : null}
          </div>
          {t.blurb ? <p className="bx-panel bx-e-blurb">{t.blurb}</p> : null}
          {t.placements?.length ? (
            <>
              <h2 className="bx-h2">Places and prize money</h2>
              <div className="bx-panel">
                {t.placements.map((p) => (
                  <div
                    key={p.place}
                    className="bx-e-place"
                    data-first={p.rank === 1 ? "" : undefined}
                  >
                    <b>{p.place}</b>
                    <span>
                      {p.competitorIds.length ? (
                        p.competitorIds.map((id) => {
                          const kind = atlas.competitor(id)?.kind ?? "team";
                          return (
                            <Go key={id} to={{ kind, id }}>
                              <Disc side={sideOf(atlas, id)} size={20} />
                              <b>{plainName(atlas, id)}</b>
                            </Go>
                          );
                        })
                      ) : (
                        <small>Not decided yet</small>
                      )}
                    </span>
                    <em>{p.prize && t.prize ? money(p.prize, t.prize.currency) : ""}</em>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <Source provenance={t.provenance} now={now} times={times} pending={status === "live"} />
    </>
  );
}
