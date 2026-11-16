import {
  type Match,
  type Stage,
  type Tournament,
  champion,
  countryName,
  dateRange,
  money,
  tournamentStatus,
} from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { scoreLine } from "../lib/view";
import { type Board, useBoard, useWide } from "./board";
import { Back, Go, useVisit } from "./links";
import { ScheduleRow } from "./lists";
import { Source } from "./match";
import { plainName, sideOf } from "./model";
import { Bracket, CrossTable, Heat, SwissTable } from "./stages";
import { until } from "./time";
import { Disc, FollowStar, Ping, Problem, Section, Segmented } from "./ui";

/** A pairing on one line, for rounds with many games: who played whom, and how it stands. */
function PairRow({ match, board }: { match: Match; board: Board }) {
  const view = board.view(match);
  const move = view.game?.chess?.move;
  return (
    <Link to="/match/$matchId" params={{ matchId: match.id }} className="bx-pair">
      <b>{view.sides.map((s) => s.name).join(" v ")}</b>
      <span
        className="bx-right"
        data-live={view.live ? "" : undefined}
        data-half={match.status === "finished" && scoreLine(match).includes("½") ? "" : undefined}
      >
        {view.live ? <Ping /> : null}
        {view.live
          ? move
            ? `move ${move}`
            : "live"
          : match.status === "finished"
            ? scoreLine(match)
            : board.times.clock(match.scheduledAt)}
      </span>
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
  if (!matches.length && stage.format !== "swiss") {
    return (
      <div className="bx-list">
        <p className="bx-empty">This stage has not been drawn yet.</p>
      </div>
    );
  }
  // A list of rounds: for a stage known only as its pairings, and for double elimination,
  // which has no drawing of its own yet.
  if (stage.format === "rounds" || stage.format === "double-elim") {
    return <Rounds stage={stage} board={board} />;
  }
  if (stage.format === "swiss") {
    return (
      <>
        <div className="bx-list">
          <SwissTable stage={stage} tournament={tournament} board={board} />
        </div>
      </>
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

export function TournamentPage({ tournamentId }: { tournamentId: string }) {
  const board = useBoard();
  const wide = useWide();
  const { atlas, now, times } = board;
  const t = atlas.tournament(tournamentId);
  const [chosen, setChosen] = useState<string>();
  useVisit("tournament", tournamentId, !!t);
  if (!t) {
    return (
      <>
        <Back />
        <Problem title="This event could not be found">
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
  // The stage to open on is the one still being played.
  const current =
    t.stages.find((s) => atlas.stageMatches(s).some((m) => m.status !== "finished")) ??
    t.stages.at(-1);
  const stage = t.stages.find((s) => s.id === chosen) ?? current;
  const winner = champion(t);
  const where = t.location
    ? [t.location.venue, t.location.city, countryName(t.location.country)]
        .filter(Boolean)
        .join(", ")
    : // No place is on record. That may mean online, but nothing says so.
      undefined;
  const state =
    status === "live"
      ? `Live${current ? ` · ${current.name}` : ""}${live.length ? ` · ${live.length} on now` : ""}`
      : status === "upcoming"
        ? `Starts ${until(`${t.start}T12:00:00Z`, now)}`
        : `Finished${winner ? ` · won by ${plainName(atlas, winner)}` : ""}`;

  return (
    <>
      <Back />
      <header className="bx-entity">
        <div>
          <p className="bx-label">{d.name}</p>
          <h1 className="bx-display">{t.name}</h1>
          <p className="bx-state" style={{ justifyContent: "flex-start", marginTop: 10 }}>
            {status === "live" ? <Ping /> : null}
            {state}
          </p>
        </div>
        <FollowStar follow={{ kind: "tournament", id: t.id }} name={t.name} />
      </header>
      <dl className="bx-facts">
        <div>
          <dt className="bx-label">When</dt>
          <dd>{dateRange(t.start, t.end)}</dd>
        </div>
        {where ? (
          <div>
            <dt className="bx-label">Where</dt>
            <dd>{where}</dd>
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
                options={t.stages.map((s) => ({ value: s.id, label: s.name }))}
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
        </div>
      </div>

      <Source provenance={t.provenance} now={now} times={times} pending={status === "live"} />
    </>
  );
}
