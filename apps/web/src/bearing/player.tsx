import { type Match, type Player, countryName, playerTotals } from "@bearing/domain";
import { didWin } from "../lib/view";
import { type Board, useBoard } from "./board";
import { Back, Go, useVisit } from "./links";
import { ScheduleRow } from "./lists";
import { type SideView, plainName, sideOf } from "./model";
import { type LineStop, StopLine } from "./stages";
import { ResultRow } from "./today";
import { Disc, FollowStar, Problem, Section } from "./ui";

function age(born: string | undefined, now: number): string | undefined {
  if (!born) return undefined;
  const years = Math.floor((now - Date.parse(born)) / (365.25 * 24 * 60 * 60 * 1000));
  return `${years} years old`;
}

/** A career as a line of stops: every team the player has been in, in order. */
function careerStops(board: Board, player: Player): LineStop[] {
  const { atlas } = board;
  return atlas.world.stints
    .filter((s) => s.playerId === player.id)
    .sort((a, b) => a.from.localeCompare(b.from))
    .map((s): LineStop => {
      const team = sideOf(atlas, s.teamId);
      return {
        kind: s.to ? "done" : "now",
        label: team.name,
        sub: `${s.from.slice(0, 4)} to ${s.to ? s.to.slice(0, 4) : "now"} · ${s.role}`,
        fill: team.color,
        weight: 1,
        to: { kind: "team", id: s.teamId },
      };
    });
}

/**
 * For someone who plays alone: their run through the event in progress, round by round. A stop
 * is filled for a win, split for a draw and left open for a loss.
 */
function runStops(board: Board, player: Player, side: SideView, own: Match[]): LineStop[] {
  const { atlas } = board;
  const current = own.find((m) => m.status === "live") ?? own.find((m) => m.status === "scheduled");
  const event = (current ?? own.at(-1))?.tournamentId;
  return own
    .filter((m) => m.tournamentId === event && m.sides.length === 2)
    .map((m): LineStop => {
      const other = m.sides.find((s) => s.competitorId !== player.id)?.competitorId;
      const round = atlas.roundOf(m)?.short ?? "";
      const won = didWin(m, player.id);
      return {
        kind: m.status === "finished" ? "done" : m.status === "live" ? "now" : "later",
        label: round,
        sub: plainName(atlas, other),
        weight: 1,
        fill:
          won === true
            ? side.color
            : won === "draw"
              ? `linear-gradient(90deg, ${side.color} 50%, var(--surface) 50%)`
              : m.status === "live"
                ? "var(--surface)"
                : undefined,
      };
    });
}

export function PlayerPage({ playerId }: { playerId: string }) {
  const board = useBoard(playerId);
  const { atlas, now } = board;
  const player = atlas.player(playerId);
  useVisit("player", playerId, !!player);
  if (!player) {
    return (
      <>
        <Back />
        <Problem title="This player could not be found">
          They may have been removed, or the link is wrong.
        </Problem>
      </>
    );
  }
  const stint = atlas.world.stints.find((s) => s.playerId === player.id && !s.to);
  const team = stint ? atlas.team(stint.teamId) : undefined;
  // A player in a team wears the team's colour; someone who plays alone has none and takes ink.
  const side: SideView = {
    ...sideOf(atlas, team?.id ?? player.id),
    name: player.handle,
    short: player.handle.slice(0, 2).toUpperCase(),
  };
  const own = atlas.matchesFor(player.id);
  const matches = team ? atlas.matchesFor(team.id) : own;
  const totals = playerTotals(matches, player.id);
  const live = matches.filter((m) => m.status === "live");
  const next = matches.filter((m) => m.status === "scheduled").slice(0, 3);
  const done = matches.filter((m) => m.status === "finished").reverse();
  const career = careerStops(board, player);
  const run = team ? [] : runStops(board, player, side, own);
  const event = own.length
    ? atlas.tournamentOf((own.find((m) => m.status !== "finished") ?? own.at(-1))!)
    : undefined;
  const facts = [
    player.name,
    countryName(player.country),
    player.title,
    stint?.role ?? player.role,
    age(player.born, now),
  ].filter(Boolean);

  return (
    <>
      <Back />
      <header className="bx-entity">
        <Disc side={side} size={72} />
        <div>
          <h1 className="bx-display">{player.handle}</h1>
          <p className="bx-sub" style={{ margin: "6px 0 0", fontSize: 13 }}>
            {facts.join(" · ")}
          </p>
        </div>
        <FollowStar follow={{ kind: "player", id: player.id }} name={player.handle} />
      </header>
      {team ? (
        <p className="bx-note" style={{ margin: "12px 0 0" }}>
          Plays for <Go to={{ kind: "team", id: team.id }}>{team.name}</Go> in{" "}
          {atlas.discipline(team.discipline).name}, since {stint?.from.slice(0, 4)}.
        </p>
      ) : null}

      {player.rating || totals ? (
        <dl className="bx-figures">
          {player.rating ? (
            <div>
              <dd className="bx-num">{player.rating.value}</dd>
              <dt className="bx-label">{player.rating.system} rating</dt>
            </div>
          ) : null}
          {totals?.rating !== undefined ? (
            <div>
              <dd className="bx-num">{totals.rating.toFixed(2)}</dd>
              <dt className="bx-label">Rating</dt>
            </div>
          ) : null}
          {totals ? (
            <div>
              <dd className="bx-num">
                {totals.kills}
                <i className="bx-dash" />
                {totals.deaths}
              </dd>
              <dt className="bx-label">Kills, deaths</dt>
            </div>
          ) : null}
          {totals?.adr !== undefined ? (
            <div>
              <dd className="bx-num">{Math.round(totals.adr)}</dd>
              <dt className="bx-label">Damage a round</dt>
            </div>
          ) : null}
          {totals ? (
            <div>
              <dd className="bx-num">{totals.games}</dd>
              <dt className="bx-label">
                {atlas.discipline(player.discipline).unit.many} on record
              </dt>
            </div>
          ) : null}
        </dl>
      ) : null}

      {career.length ? (
        <section className="bx-section" style={{ marginTop: 30 }}>
          <h2 className="bx-label" style={{ marginBottom: 14 }}>
            Career
          </h2>
          <div className="bx-hero">
            <StopLine stops={career} />
          </div>
        </section>
      ) : null}
      {run.length && event ? (
        <section className="bx-section" style={{ marginTop: 30 }}>
          <h2 className="bx-label" style={{ marginBottom: 14 }}>
            <Go to={{ kind: "tournament", id: event.id }}>{event.name}</Go>, round by round
          </h2>
          <div className="bx-hero">
            <StopLine stops={run} />
          </div>
          <p className="bx-note">
            A filled stop is a win, a split one a draw, an empty one a loss.
          </p>
        </section>
      ) : null}

      <div className="bx-cols">
        <div>
          {live.length || next.length ? (
            <Section label="On now and next">
              <div className="bx-list">
                {[...live, ...next].map((m) => (
                  <ScheduleRow key={m.id} match={m} board={board} overlap={false} day />
                ))}
              </div>
            </Section>
          ) : (
            <Section label="Next">
              <div className="bx-list">
                <p className="bx-empty">Nothing is scheduled for {player.handle}.</p>
              </div>
            </Section>
          )}
        </div>
        <div>
          {done.length ? (
            <Section label={team ? `Results with ${plainName(atlas, team.id)}` : "Results"}>
              <div className="bx-list">
                {done.slice(0, 6).map((m) => (
                  <ResultRow key={m.id} view={board.view(m)} />
                ))}
              </div>
            </Section>
          ) : null}
        </div>
      </div>
    </>
  );
}
