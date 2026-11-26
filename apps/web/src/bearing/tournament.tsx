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
import { useState } from "react";
import { scoreLine } from "../lib/view";
import { type Board, useBoard, useWide } from "./board";
import { SeriesList } from "./chess/series";
import { Back, Go, useVisit } from "./links";
import { ScheduleRow } from "./lists";
import { Source } from "./match";
import { plainName, sideOf } from "./model";
import { Bracket, DoubleBracket } from "./bracket";
import { CrossTable, Heat } from "./stages";
import { SwissFlow } from "./swiss";
import { until } from "./time";
import {
  Disc,
  EventMark,
  Flag,
  FollowStar,
  Ping,
  Problem,
  Waiting,
  Section,
  Segmented,
} from "./ui";

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
        className="bx-pair-side"
        data-mirror={mirror ? "" : undefined}
        data-lost={typeof won === "number" && won !== index ? "" : undefined}
      >
        {solo ? <Flag country={player?.country} keep /> : s ? <Disc side={s} size={18} /> : null}
        <b>{s?.name ?? "TBD"}</b>
        {player?.title ? <i>{player.title}</i> : null}
        {player?.rating ? <span className="bx-pair-elo">{player.rating.value}</span> : null}
      </span>
    );
  };
  return (
    <Link to="/match/$matchId" params={{ matchId: match.id }} className="bx-pair">
      {side(order[0]!, false)}
      <span className="bx-pair-mid" data-live={view.live ? "" : undefined}>
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
          <div key={round.id} style={{ marginBottom: 20 }}>
            <h3 className="bx-label" style={{ margin: "0 8px 8px" }}>
              {round.name}
            </h3>
            <div className="bx-list">
              {matches.map((m) => (
                <ScheduleRow key={m.id} match={m} board={board} day inEvent />
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
    <>
      {ordered.map(({ round, matches }) => {
        const live = matches.filter((m) => m.status === "live").length;
        const done = matches.filter((m) => m.status === "finished").length;
        return (
          <details key={round.id} className="bx-fold" open={round === current?.round}>
            <summary>
              <span className="bx-label">{round.name}</span>
              <span className="bx-sub">
                {matches.length} games
                {live ? `, ${live} being played` : done === matches.length ? ", all played" : ""}
              </span>
            </summary>
            <div className="bx-list">
              {matches.map((m) => (
                <PairRow key={m.id} match={m} board={board} />
              ))}
            </div>
          </details>
        );
      })}
    </>
  );
}

/** A stage drawn for its format: a bracket, a table of paths, a cross table, or heats. */
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
  if (!matches.length && board.loading) return <Waiting />;
  if (!matches.length && stage.format !== "swiss") {
    return (
      <div className="bx-list">
        <p className="bx-empty">This stage has not been drawn yet.</p>
      </div>
    );
  }
  // An event played as matches: each with its games, written the way chess writes a match.
  if (stage.id === "matches") return <SeriesList matches={matches} board={board} />;
  // A list of rounds, for a stage known only as its pairings.
  if (stage.format === "rounds") {
    return <Rounds stage={stage} board={board} />;
  }
  if (stage.format === "double-elim") {
    return (
      <div className="bx-list bx-pad">
        <DoubleBracket stage={stage} board={board} wide={wide} />
      </div>
    );
  }
  if (stage.format === "swiss") {
    return (
      <div className="bx-list bx-pad">
        <SwissFlow stage={stage} tournament={tournament} board={board} />
      </div>
    );
  }
  if (stage.format === "round-robin") {
    return (
      <>
        <div className="bx-list bx-pad">
          <CrossTable stage={stage} tournament={tournament} board={board} />
        </div>
      </>
    );
  }
  if (stage.format === "cup") {
    const through = stage.rules?.advancePerMatch ?? 1;
    return (
      <>
        {stage.rounds.map((round) => (
          <div key={round.id} className="bx-list bx-heats" style={{ marginBottom: 12 }}>
            {round.matchIds.map((id) => {
              const m = board.atlas.match(id);
              return m ? <Heat key={id} match={m} board={board} through={through} /> : null;
            })}
          </div>
        ))}
      </>
    );
  }
  return (
    <div className="bx-list bx-pad">
      <Bracket stage={stage} board={board} wide={wide} />
    </div>
  );
}

/** Everyone in an event, each a way to their own page. */
function Entrants({ ids, board }: { ids: string[]; board: Board }) {
  const { atlas } = board;
  return (
    <div className="bx-entrants">
      {ids.map((id) => {
        const c = atlas.competitor(id);
        if (!c) return null;
        return (
          <Go key={id} to={{ kind: c.kind, id }} className="bx-entrant">
            <Disc side={sideOf(atlas, id)} size={24} />
            <b>{plainName(atlas, id)}</b>
            {c.kind === "player" ? <Flag country={c.country} /> : null}
          </Go>
        );
      })}
    </div>
  );
}

/** What a part of an event is called once the event's own name is taken off it. */
function partName(part: Tournament, series: string): string {
  const rest = part.name.startsWith(series) ? part.name.slice(series.length) : part.name;
  return rest.replace(/^[\s:|–-]+/, "").trim() || part.name;
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
  const status = tournamentStatus(atlas, t, now);
  const matches = atlas.matchesOf(t.id);
  const live = matches.filter((m) => m.status === "live");
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
  const where = t.location
    ? [t.location.venue, t.location.city, countryName(t.location.country)]
        .filter(Boolean)
        .join(", ")
    : // No place is on record. That may mean online, but nothing says so.
      undefined;
  const state =
    status === "live"
      ? live.length
        ? `Live${current ? ` · ${current.name}` : ""} · ${live.length} on now`
        : // Under way, with nothing being played this minute: not "live".
          `Under way${current ? ` · ${current.name}` : ""}`
      : status === "upcoming"
        ? `Starts ${until(`${t.start}T12:00:00Z`, now)}`
        : `Finished${winner ? ` · won by ${plainName(atlas, winner)}` : ""}`;

  return (
    <>
      <Back />
      <header className="bx-entity">
        {/* With room the event's mark stands beside its name; on a phone it leads the line
            above it, where it takes no width from the name. */}
        {t.image ? (
          <span className="bx-wideonly">
            <EventMark image={t.image} size={64} />
          </span>
        ) : null}
        <div>
          <p className="bx-label bx-row" style={{ gap: 8 }}>
            <span className="bx-phone" style={{ display: "inline-flex" }}>
              <EventMark image={t.image} size={20} />
            </span>
            {d.name}
          </p>
          <h1 className="bx-display">{t.name}</h1>
          <p className="bx-state" style={{ justifyContent: "flex-start", marginTop: 10 }}>
            {status === "live" && live.length ? <Ping /> : null}
            {state}
          </p>
        </div>
        <FollowStar follow={{ kind: "tournament", id: t.id }} name={t.name} />
      </header>
      {parts.length > 1 ? (
        <nav className="bx-parts" aria-label={`Parts of ${t.series}`}>
          {/* The parts of one event are one page: choosing another changes what the page
              shows. Nothing is left and nothing is entered, the page stays where it is
              scrolled to, and going back leads out of the event, not through its parts. */}
          {parts.map((part) => (
            <Link
              key={part.id}
              to="/tournament/$tournamentId"
              params={{ tournamentId: part.id }}
              replace
              resetScroll={false}
              className="bx-part"
              aria-current={part.id === t.id ? "page" : undefined}
            >
              {partName(part, t.series ?? "")}
            </Link>
          ))}
        </nav>
      ) : null}
      <div key={t.id} className="bx-view">
        <dl className="bx-facts">
          <div>
            <dt className="bx-label">When</dt>
            <dd>{dateRange(t.start, t.end)}</dd>
          </div>
          {where ? (
            <div>
              <dt className="bx-label">Where</dt>
              <dd>
                <Flag country={t.location?.country} />
                {where}
              </dd>
            </div>
          ) : null}
          {t.organizer ? (
            <div>
              <dt className="bx-label">Organiser</dt>
              <dd>{t.organizer}</dd>
            </div>
          ) : null}
          {t.prize ? (
            <div>
              <dt className="bx-label">Prize money</dt>
              <dd>{money(t.prize.amount, t.prize.currency)}</dd>
            </div>
          ) : null}
        </dl>

        <div className="bx-cols bx-cols-main">
          <div>
            {t.stages.length > 1 && stage ? (
              <div style={{ marginTop: 6 }}>
                <Segmented
                  options={stages.map((s) => ({ value: s.id, label: s.name }))}
                  value={stage.id}
                  onChange={setChosen}
                  label="Stage"
                />
              </div>
            ) : null}
            {stage ? (
              <Section label={stage.name}>
                {stage.explainer ? <p className="bx-explain">{stage.explainer}</p> : null}
                <StageDrawing stage={stage} tournament={t} board={board} wide={wide} />
              </Section>
            ) : t.blurb ? (
              <Section label="The event">
                <p className="bx-explain">{t.blurb}</p>
              </Section>
            ) : null}
            {entrants.length && (!stage || status === "upcoming") ? (
              <Section label={`Taking part · ${entrants.length}`}>
                <Entrants ids={entrants} board={board} />
              </Section>
            ) : null}
          </div>
          <div>
            {live.length || next.length ? (
              <Section label="On now and next">
                <div className="bx-list">
                  {[...live, ...next].map((m) => (
                    <ScheduleRow key={m.id} match={m} board={board} day />
                  ))}
                </div>
              </Section>
            ) : null}
            {t.placements?.length ? (
              <Section label="Places and prize money">
                <div className="bx-list">
                  {t.placements.map((p) => (
                    <div key={p.place} className="bx-place">
                      <span className="bx-mono">{p.place}</span>
                      <span>
                        {p.competitorIds.length ? (
                          p.competitorIds.map((id) => {
                            const kind = atlas.competitor(id)?.kind ?? "team";
                            return (
                              <Go key={id} to={{ kind, id }} className="bx-row">
                                <Disc side={sideOf(atlas, id)} size={16} />
                                <b>{plainName(atlas, id)}</b>
                              </Go>
                            );
                          })
                        ) : (
                          <span className="bx-sub">Not decided yet</span>
                        )}
                      </span>
                      <span className="bx-mono bx-num">
                        {p.prize && t.prize ? money(p.prize, t.prize.currency) : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}
            {entrants.length && stage && status !== "upcoming" ? (
              <Section label={`Taking part · ${entrants.length}`}>
                <Entrants ids={entrants} board={board} />
              </Section>
            ) : null}
          </div>
        </div>

        <Source provenance={t.provenance} now={now} times={times} pending={status === "live"} />
      </div>
    </>
  );
}
