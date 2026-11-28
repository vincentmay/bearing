import "./pages-people.css";
import { type Match, type Player, countryName, playerTotals } from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import { useFidePlayer } from "../lib/fide";
import { useChampionPool } from "../lib/pool";
import { didWin, scoreLine } from "../lib/view";
import { type Board, useBoard, useWide } from "./board";
import { Back, Go, useVisit } from "./links";
import { type SideView, plainName, sideOf, standIn } from "./model";
import { MatchRow } from "./rows";
import { CardSky, light } from "./sky";
import { Figures, FollowButton, NowStrip, PersonRow, Year, points, rankOf, yearOf } from "./team";
import { Champ, Disc, Flag, Ping, Problem, positionOf, TopCard } from "./ui";

function age(born: string | undefined, now: number): string | undefined {
  if (!born) return undefined;
  const years = Math.floor((now - Date.parse(born)) / (365.25 * 24 * 60 * 60 * 1000));
  return `${years} years old`;
}

/** Every team the player has been in, newest first, with the years and what they did there. */
function Career({ board, player }: { board: Board; player: Player }) {
  const { atlas } = board;
  const stints = atlas.world.stints
    .filter((s) => s.playerId === player.id)
    .sort((a, b) => (b.from ?? "").localeCompare(a.from ?? ""));
  // One team is already said on the card above.
  if (stints.length < 2) return null;
  return (
    <>
      <h2 className="bx-h2">Career</h2>
      <div className="bx-panel">
        {stints.map((s) => (
          <Go key={s.id} to={{ kind: "team", id: s.teamId }} className="bx-pp-li">
            <Disc side={sideOf(atlas, s.teamId)} size={34} />
            <span>
              <b>{plainName(atlas, s.teamId)}</b>
              <span>{s.role}</span>
            </span>
            <span className="bx-pp-role" data-on={s.to ? undefined : ""}>
              {/* Since when is said only where it is known. */}
              {s.from
                ? `${s.from.slice(0, 4)} to ${s.to ? s.to.slice(0, 4) : "now"}`
                : s.to
                  ? ""
                  : "Now"}
            </span>
          </Go>
        ))}
      </div>
    </>
  );
}

/**
 * For someone who plays alone: their run through the event in progress, round by round, as a
 * strip of squares: the result of each game, the one being played, the ones to come.
 */
function Run({ board, player, own }: { board: Board; player: Player; own: Match[] }) {
  const { atlas } = board;
  const current = own.find((m) => m.status === "live") ?? own.find((m) => m.status === "scheduled");
  const event = (current ?? own.at(-1))?.tournamentId;
  const games = own.filter((m) => m.tournamentId === event && m.sides.length === 2);
  if (!games.length || !event) return null;
  const tournament = atlas.tournament(event);
  const finished = games.filter((m) => m.status === "finished");
  return (
    <>
      <h2 className="bx-h2">
        {tournament?.name ?? "The event"}
        <small>
          round by round
          {finished.length ? ` · ${points(finished, player.id)} of ${finished.length}` : ""}
        </small>
      </h2>
      <div className="bx-panel bx-pp-gs">
        {games.map((m) => {
          const other = m.sides.find((s) => s.competitorId !== player.id)?.competitorId;
          const round = atlas.roundOf(m)?.short ?? "";
          const won = didWin(m, player.id);
          const mark =
            m.status === "live" ? (
              <Ping />
            ) : won === true ? (
              "1"
            ) : won === "draw" ? (
              "½"
            ) : won === false ? (
              "0"
            ) : (
              <i />
            );
          const k =
            m.status === "live" ? "n" : won === true ? "w" : won === false ? "l" : won ? "d" : "";
          const name = plainName(atlas, other);
          return (
            <Link
              key={m.id}
              to="/match/$matchId"
              params={{ matchId: m.id }}
              className="bx-pp-g"
              data-k={k}
              aria-label={`${round}, against ${name}`}
              title={name}
            >
              <small>{round}</small>
              <b>{mark}</b>
              <em>{name}</em>
            </Link>
          );
        })}
      </div>
    </>
  );
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
    <>
      <h2 className="bx-h2">
        Champions
        <small>in {year}</small>
      </h2>
      <div className="bx-panel">
        {pool.map((p) => {
          const art = filed.get(p.champion);
          const rate = p.games ? Math.round((p.wins / p.games) * 100) : 0;
          return (
            <div key={p.champion} className="bx-pp-li bx-pp-pool">
              <Champ
                // A champion in none of Bearing's drafts is looked for under its plain name,
                // which is where most are filed.
                champion={{
                  name: p.champion,
                  key: art?.key ?? p.champion.replace(/[^A-Za-z]/g, ""),
                }}
                patch={art?.patch ?? anyPatch}
                size={34}
              />
              <span>
                <b>{p.champion}</b>
                <span className="bx-pp-bar" aria-hidden>
                  <i style={{ width: `${(p.games / most) * 100}%` }}>
                    <i style={{ width: `${rate}%` }} />
                  </i>
                </span>
              </span>
              <span className="bx-pp-out" data-w={rate >= 50 ? "1" : "0"}>
                <b>{rate}%</b>
                <small>
                  {p.wins} of {p.games} won
                </small>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** The player's picture, large, lighting the card's sky in their colour. */
function Face({ side }: { side: SideView }) {
  return (
    <span className="bx-pp-mark" {...light(side.color, 620, 1)}>
      <Disc side={side} size={84} />
    </span>
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
          <Problem title="This player could not be found.">
            It may have been removed, or the link is wrong.
          </Problem>
        )}
      </>
    );
  }
  const facts = [
    "Chess",
    countryName(player.country),
    player.title,
    player.born ? `born ${player.born}` : undefined,
  ].filter(Boolean);
  return (
    <>
      <Back />
      <TopCard className="bx-stage">
        <CardSky />
        <div className="bx-ent-in">
          <div className="bx-eh">
            <Face
              side={standIn({
                name: player.name,
                short: player.family.slice(0, 2).toUpperCase(),
                image: player.imageLarge ?? player.image,
                person: true,
              })}
            />
            <div>
              <h1>{player.family}</h1>
              <p>
                <Flag country={player.country} />
                {[player.name, ...facts].join(" · ")}
              </p>
            </div>
            <Figures
              figs={player.ratings.slice(0, 3).map((r) => ({ value: r.value, label: r.label }))}
            />
            <div className="bx-eh-acts">
              <FollowButton follow={{ kind: "player", id }} name={player.name} />
            </div>
          </div>
        </div>
      </TopCard>
      {player.ratings.length > 3 ? (
        <>
          <h2 className="bx-h2">Ratings</h2>
          <div className="bx-panel">
            {player.ratings.map((r) => (
              <div key={r.label} className="bx-pp-bm">
                <b>{r.label}</b>
                <span />
                <span>{r.value}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
      <p className="bx-quiet">
        {player.family} is not playing in an event Kiming has at the moment. Their games appear here
        as soon as they are.
      </p>
      <p className="bx-pp-src">
        <a href={`https://lichess.org/fide/${id.slice(5)}`} target="_blank" rel="noreferrer">
          FIDE, by way of Lichess
        </a>
        {player.credit ? ` · Picture: ${player.credit}` : ""}
      </p>
    </>
  );
}

export function PlayerPage({ playerId }: { playerId: string }) {
  const board = useBoard(playerId, { side: playerId });
  const { atlas, now } = board;
  const wide = useWide();
  const player = atlas.player(playerId);
  useVisit("player", playerId, !!player);
  if (!player && playerId.startsWith("fide-")) return <Listed id={playerId} />;
  if (!player) {
    return (
      <>
        <Back />
        <Problem title="This player could not be found.">
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
  const teamSide = team ? sideOf(atlas, team.id) : undefined;
  const discipline = atlas.discipline(player.discipline);
  const own = atlas.matchesFor(player.id);
  const matches = team ? atlas.matchesFor(team.id) : own;
  const subject = team?.id ?? player.id;
  const totals = playerTotals(matches, player.id);
  const live = matches.filter((m) => m.status === "live");
  const next = matches.filter((m) => m.status === "scheduled").slice(0, 3);
  const done = matches.filter((m) => m.status === "finished").reverse();
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
  const year = yearOf(board, subject, player.discipline, matches);
  const front = live[0] ?? next[0];
  const rank = rankOf(atlas, player.discipline, player.id);
  const teamRank = team ? rankOf(atlas, team.discipline, team.id) : undefined;
  // For someone who plays alone: how they stand in what they are playing now. A long match of
  // many games is told by its score; an event of rounds by the points so far.
  const current = team ? undefined : (front ?? own.at(-1));
  const long = current && current.bestOf > 2 && current.sides.length === 2;
  const me = current ? current.sides.findIndex((s) => s.competitorId === player.id) : -1;
  const event = current ? atlas.tournamentOf(current) : undefined;
  const run = current
    ? own.filter((m) => m.tournamentId === current.tournamentId && m.status === "finished")
    : [];
  const standing =
    current && long
      ? {
          value: (me
            ? scoreLine(current).split("–").reverse()
            : scoreLine(current).split("–")
          ).join("–"),
          label: `Against ${plainName(atlas, current.sides[1 - Math.max(0, me)]?.competitorId)}`,
        }
      : run.length && event
        ? { value: `${points(run, player.id)}/${run.length}`, label: `In ${event.short}` }
        : undefined;
  const figs = [
    ...(player.rating
      ? [{ value: player.rating.value, label: `${player.rating.system} rating` }]
      : []),
    ...(rank ? [{ value: `#${rank}`, label: "World ranking" }] : []),
    ...(standing ? [standing] : []),
    ...(totals?.rating !== undefined
      ? [
          {
            value: totals.rating.toFixed(2),
            label: `Rating over ${totals.games} ${discipline.unit.many.toLowerCase()}`,
          },
        ]
      : []),
    ...(totals ? [{ value: `${totals.kills}–${totals.deaths}`, label: "Kills, deaths" }] : []),
    ...(totals?.adr !== undefined
      ? [{ value: Math.round(totals.adr), label: "Damage a round" }]
      : []),
    ...(totals && totals.rating === undefined
      ? [{ value: totals.games, label: `${discipline.unit.many} on record` }]
      : []),
  ];
  const facts = [
    team ? undefined : discipline.name,
    player.name,
    countryName(player.country),
    player.title,
    team ? undefined : (stint?.role ?? player.role),
    age(player.born, now),
  ].filter(Boolean);
  const follow = <FollowButton follow={{ kind: "player", id: player.id }} name={player.handle} />;
  // Someone who plays alone has no team beside the results: what is coming stands there instead.
  const coming =
    live.length || next.length ? (
      <>
        <h2 className="bx-h2">{live.length ? "On now and next" : "Next"}</h2>
        <div className="bx-rows">
          {[...live, ...next].map((m) => (
            <MatchRow key={m.id} match={m} board={board} day />
          ))}
        </div>
      </>
    ) : null;

  return (
    <>
      <Back parent={team ? { kind: "team", id: team.id } : undefined} />
      <TopCard className="bx-stage" data-live={live.length ? "" : undefined}>
        <CardSky />
        <div className="bx-ent-in">
          <div className="bx-eh">
            <Face side={side} />
            <div>
              <h1>{player.handle}</h1>
              <p>
                <Flag country={player.country} />
                {facts.join(" · ")}
              </p>
              {team && teamSide ? (
                <Go to={{ kind: "team", id: team.id }} className="bx-pp-team">
                  <Disc side={teamSide} size={24} />
                  <b>{teamSide.name}</b>
                  <span>
                    {[
                      stint?.role ?? player.role,
                      stint?.from ? `since ${stint.from.slice(0, 4)}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <ChevronRight size={15} aria-hidden />
                </Go>
              ) : null}
            </div>
            <Figures figs={figs.slice(0, 3)} />
            {front ? null : <div className="bx-eh-acts">{follow}</div>}
          </div>
          {front ? (
            <NowStrip match={front} board={board} subject={subject}>
              {follow}
            </NowStrip>
          ) : null}
        </div>
      </TopCard>

      <Year
        cards={year}
        side={team ? (teamSide ?? side) : side}
        now={now}
        label={team && teamSide ? `With ${teamSide.name}` : undefined}
      />

      <div className={team || (coming && wide) ? "bx-cols2" : undefined}>
        <div>
          {/* On a phone, what is coming stands before the run and the results. */}
          {!team && !wide ? coming : null}
          {team ? null : <Run board={board} player={player} own={own} />}
          {team ? coming : null}
          {done.length ? (
            <>
              <h2 className="bx-h2">
                Results
                {team ? <small>with {plainName(atlas, team.id)}</small> : null}
              </h2>
              <div className="bx-rows">
                {done.slice(0, team ? 6 : 8).map((m) => (
                  <MatchRow key={m.id} match={m} board={board} day />
                ))}
              </div>
            </>
          ) : null}
          {figs.length > 3 ? (
            <>
              <h2 className="bx-h2">
                Numbers
                <small>{team ? `with ${plainName(atlas, team.id)}` : "on record"}</small>
              </h2>
              <div className="bx-panel">
                {figs.map((f) => (
                  <div key={f.label} className="bx-pp-bm">
                    <b>{f.label}</b>
                    <span />
                    <span>{f.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
        <div>
          {team && teamSide ? (
            <>
              <h2 className="bx-h2">Team</h2>
              <Go
                to={{ kind: "team", id: team.id }}
                className="bx-pp-tcard"
                style={{ "--pp-c": teamSide.color } as CSSProperties}
              >
                <Disc side={teamSide} size={52} />
                <span>
                  <b>{team.name}</b>
                  <span>
                    {[
                      discipline.name,
                      stint?.role ?? player.role,
                      stint?.from ? `since ${stint.from.slice(0, 4)}` : undefined,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {teamRank ? (
                  <span className="bx-pp-out">
                    <b>#{teamRank}</b>
                    <small>World ranking</small>
                  </span>
                ) : (
                  <ChevronRight size={18} aria-hidden />
                )}
              </Go>
            </>
          ) : null}
          {team && player.discipline === "lol" ? (
            <Pool handle={player.handle} team={team.name} board={board} />
          ) : null}
          {mates.length ? (
            <>
              <h2 className="bx-h2">
                Team-mates
                <small>
                  with {player.handle} at {plainName(atlas, team?.id)}
                </small>
              </h2>
              <div className="bx-panel">
                {mates.map(({ player: mate, stint: theirs }) => (
                  <PersonRow
                    key={mate.id}
                    atlas={atlas}
                    player={mate}
                    stint={theirs}
                    since={false}
                  />
                ))}
              </div>
            </>
          ) : null}
          {!team && wide ? coming : null}
          <Career board={board} player={player} />
        </div>
      </div>
      {player.imageCredit ? (
        <p className="bx-pp-src">Picture: {player.imageCredit.replace(/\s*<[^>]*>/g, "")}</p>
      ) : null}
    </>
  );
}
