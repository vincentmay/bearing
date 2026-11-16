import { type Match, type Player, countryName, playerTotals } from "@bearing/domain";
import { useFidePlayer } from "../lib/fide";
import { useChampionPool } from "../lib/pool";
import { didWin } from "../lib/view";
import { type Board, useBoard } from "./board";
import { Back, Go, useVisit } from "./links";
import { ScheduleRow } from "./lists";
import { type SideView, plainName, sideOf } from "./model";
import { type LineStop, StopLine } from "./stages";
import { ResultRow } from "./today";
import { Champ, Disc, Flag, FollowStar, Problem, Role, Section, positionOf } from "./ui";

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
    .sort((a, b) => (a.from ?? "").localeCompare(b.from ?? ""))
    .map((s): LineStop => {
      const team = sideOf(atlas, s.teamId);
      return {
        kind: s.to ? "done" : "now",
        label: team.name,
        // Since when is said only where it is known.
        sub: [
          s.from
            ? `${s.from.slice(0, 4)} to ${s.to ? s.to.slice(0, 4) : "now"}`
            : s.to
              ? ""
              : "Now",
          s.role,
        ]
          .filter(Boolean)
          .join(" · "),
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

/**
 * The champions a League player has played this year, most played first, each with how many
 * games and how many of them were won.
 */
function Pool({ handle, team, board }: { handle: string; team: string; board: Board }) {
  const year = new Date(board.now).getFullYear();
  const pool = useChampionPool(handle, team, year);
  if (!pool.length) return null;
  // Where a champion's picture is filed is known from the drafts Bearing already has.
  const filed = new Map<string, { key?: string; patch?: string }>();
  for (const m of board.atlas.world.matches)
    for (const g of m.games)
      for (const c of g.draft?.picks.flat() ?? [])
        if (c.key && !filed.has(c.name)) filed.set(c.name, { key: c.key, patch: g.draft?.patch });
  const anyPatch = [...filed.values()].find((f) => f.patch)?.patch;
  const most = pool[0]!.games;
  return (
    <Section label={`Champions in ${year}`}>
      <div className="bx-list">
        {pool.map((p) => {
          const art = filed.get(p.champion);
          return (
            <div key={p.champion} className="bx-line bx-pool">
              <span className="bx-who">
                <Champ
                  // A champion in none of Bearing's drafts is looked for under its plain name,
                  // which is where most are filed.
                  champion={{
                    name: p.champion,
                    key: art?.key ?? p.champion.replace(/[^A-Za-z]/g, ""),
                  }}
                  patch={art?.patch ?? anyPatch}
                  size={30}
                />
                <span>
                  <b>{p.champion}</b>
                  <span className="bx-sub">
                    {p.games} {p.games === 1 ? "game" : "games"} · won {p.wins}
                  </span>
                </span>
              </span>
              <span className="bx-pool-bar" aria-hidden>
                <i style={{ width: `${(p.games / most) * 100}%` }}>
                  <i style={{ width: `${p.games ? (p.wins / p.games) * 100 : 0}%` }} />
                </i>
              </span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/**
 * A chess player who is in no event Bearing has: who they are, from FIDE's list of rated
 * players. Their games appear here once they sit down at an event Bearing follows.
 */
function Listed({ id }: { id: string }) {
  const { player, waiting } = useFidePlayer(id);
  if (!player) {
    return (
      <>
        <Back />
        {waiting ? null : (
          <Problem title="This player could not be found">
            It may have been removed, or the link is wrong.
          </Problem>
        )}
      </>
    );
  }
  const facts = [
    countryName(player.country),
    player.title,
    player.born ? `born ${player.born}` : undefined,
  ].filter(Boolean);
  return (
    <>
      <Back />
      <header className="bx-entity">
        <Disc
          size={72}
          side={{
            id: null,
            name: player.name,
            label: player.name,
            short: player.family.slice(0, 2).toUpperCase(),
            color: "var(--ink)",
            ink: "var(--ground)",
            plural: false,
            image: player.imageLarge ?? player.image,
            person: true,
          }}
        />
        <div>
          <h1 className="bx-display">{player.family}</h1>
          <p className="bx-sub" style={{ margin: "6px 0 0", fontSize: 13 }}>
            <Flag country={player.country} />
            {[player.name, ...facts].join(" · ")}
          </p>
        </div>
        <FollowStar follow={{ kind: "player", id }} name={player.name} />
      </header>
      {player.ratings.length ? (
        <dl className="bx-figures">
          {player.ratings.map((rating) => (
            <div key={rating.label}>
              <dd>{rating.value}</dd>
              <dt className="bx-label">{rating.label}</dt>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="bx-page-narrow" style={{ margin: "22px 0 0" }}>
        <div className="bx-list">
          <p className="bx-empty">
            {player.family} is not playing in an event Bearing has at the moment. Their games appear
            here as soon as they are.
          </p>
        </div>
      </div>
      <p className="bx-source">
        <a href={`https://lichess.org/fide/${id.slice(5)}`} target="_blank" rel="noreferrer">
          FIDE, by way of Lichess
        </a>
        {player.credit ? ` · Picture: ${player.credit}` : ""}
      </p>
    </>
  );
}

export function PlayerPage({ playerId }: { playerId: string }) {
  const board = useBoard(playerId);
  const { atlas, now } = board;
  const player = atlas.player(playerId);
  useVisit("player", playerId, !!player);
  if (!player && playerId.startsWith("fide-")) return <Listed id={playerId} />;
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
    // The colour is the team's; the picture is the player's own.
    image: player.image,
    person: true,
  };
  const own = atlas.matchesFor(player.id);
  const matches = team ? atlas.matchesFor(team.id) : own;
  const totals = playerTotals(matches, player.id);
  const live = matches.filter((m) => m.status === "live");
  const next = matches.filter((m) => m.status === "scheduled").slice(0, 3);
  const done = matches.filter((m) => m.status === "finished").reverse();
  const career = careerStops(board, player);
  const lane = (role: string) => {
    const at = ["top", "jungle", "mid", "bot", "support"].indexOf(positionOf(role) ?? "");
    return at < 0 ? 9 : at;
  };
  const mates = team
    ? atlas
        .roster(team.id)
        .filter((r) => r.player.id !== player.id)
        .sort((x, y) => lane(x.stint.role) - lane(y.stint.role))
    : [];
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
      <Back parent={team ? { kind: "team", id: team.id } : undefined} />
      <header className="bx-entity">
        <Disc side={side} size={72} />
        <div>
          <h1 className="bx-display">{player.handle}</h1>
          <p className="bx-sub" style={{ margin: "6px 0 0", fontSize: 13 }}>
            <Flag country={player.country} />
            {facts.join(" · ")}
          </p>
        </div>
        <FollowStar follow={{ kind: "player", id: player.id }} name={player.handle} />
      </header>
      {team ? (
        <Go to={{ kind: "team", id: team.id }} className="bx-teamchip">
          <Disc side={sideOf(atlas, team.id)} size={26} />
          <span>
            <b>{team.name}</b>
            <span className="bx-sub">
              {[
                atlas.discipline(team.discipline).name,
                stint?.role ?? player.role,
                stint?.from ? `since ${stint.from.slice(0, 4)}` : undefined,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
        </Go>
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

      {career.length > 1 ? (
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
                <p className="bx-empty">Nothing is scheduled for {player.handle}.</p>
              </div>
            </Section>
          )}
        </div>
        <div>
          {team && player.discipline === "lol" ? (
            <Pool handle={player.handle} team={team.name} board={board} />
          ) : null}
          {mates.length ? (
            <Section label={`With ${player.handle} at ${plainName(atlas, team?.id)}`}>
              <div className="bx-list">
                {mates.map(({ player: mate, stint: theirs }) => (
                  <Go key={mate.id} to={{ kind: "player", id: mate.id }} className="bx-line">
                    <span className="bx-who">
                      <Disc side={sideOf(atlas, mate.id)} size={30} />
                      <span>
                        <b>{mate.handle}</b>
                        <span className="bx-sub">{mate.name || countryName(mate.country)}</span>
                      </span>
                    </span>
                    <Role role={theirs.role} />
                    <span />
                  </Go>
                ))}
              </div>
            </Section>
          ) : null}
          {done.length ? (
            <Section label={team ? `Results with ${plainName(atlas, team.id)}` : "Results"}>
              <div className="bx-list">
                {done.slice(0, 6).map((m) => (
                  <ResultRow key={m.id} match={m} board={board} />
                ))}
              </div>
            </Section>
          ) : null}
        </div>
      </div>
      {player.imageCredit ? (
        <p className="bx-source">Picture: {player.imageCredit.replace(/\s*<[^>]*>/g, "")}</p>
      ) : null}
    </>
  );
}
