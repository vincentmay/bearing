import type { Competitor, World } from "../model.ts";
import { buildChess, chessPlayers } from "./chess.ts";
import { buildCs2, cs2Players, cs2Stints, cs2Teams } from "./cs2.ts";
import { disciplines, organizations } from "./disciplines.ts";
import { fillPlacements, otherEvents, rankings } from "./events.ts";
import { SAMPLE_NOW } from "./kit.ts";
import { playHistory } from "./history.ts";
import { sampleImage } from "./images.ts";
import { buildLol, lolPlayers, lolStints, lolTeams } from "./lol.ts";
import { buildRocketLeague, buildRocketLeagueOpen, rlTeams } from "./rocket-league.ts";
import { cs2Rosters, lolRosters, rlRosters } from "./rosters.ts";
import { decorateCs2, decorateLol, rosterIndex } from "./stats.ts";
import { buildTrackmania, tmPlayers } from "./trackmania.ts";

export { SAMPLE_NOW, SAMPLE_PROVENANCE, rng, type Rand } from "./kit.ts";
export { SAMPLE_FOLLOWS } from "./follows.ts";
import { SAMPLE_FOLLOWS } from "./follows.ts";
export { advance } from "./play.ts";

const BLURBS: Record<string, string> = {
  "cs2-copenhagen-masters-2026":
    "Sixteen teams, a Swiss stage and an eight-team arena playoff in Royal Arena.",
  "chess-fall-classic-2026":
    "Eight of the world's best in a single round robin of classical chess.",
  "tm-cup-finals-2026": "Sixteen of the fastest drivers race four at a time until one is left.",
  "lol-rift-invitational-2026":
    "The eight best teams from the year's regional leagues, best-of-five knockouts.",
  "rl-open-major-paris-2026":
    "Sixteen teams from five regions; Swiss stage, then a best-of-seven playoff.",
};

/** What the sample's viewer follows, so that a first look shows a personal page. */

/** One entity per id: a player who moved teams appears once. */
function unique<T extends { id: string }>(list: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of list) if (!seen.has(item.id)) seen.set(item.id, item);
  return [...seen.values()];
}

export function buildSampleWorld(): World {
  const cs2 = buildCs2();
  const lol = buildLol();
  const chess = buildChess();
  const tm = buildTrackmania();
  const rl = buildRocketLeague();
  const rlOpen = buildRocketLeagueOpen();
  const competitors: Competitor[] = unique<Competitor>([
    ...cs2Teams,
    ...cs2Players,
    ...cs2Rosters.players,
    ...lolTeams,
    ...lolPlayers,
    ...lolRosters.players,
    ...chessPlayers,
    ...tmPlayers,
    ...rlTeams,
    ...rlRosters.players,
  ]).map((c) => {
    const image = sampleImage(c.id);
    return image ? { ...c, image } : c;
  });
  const stints = [
    ...cs2Stints,
    ...cs2Rosters.stints,
    ...lolStints,
    ...lolRosters.stints.filter((s) => s.teamId !== "lol-t1"),
    ...rlRosters.stints,
  ];
  const rosters = rosterIndex(stints);
  // The events that are over get the brackets that led to their final standings.
  const past = otherEvents();
  const history = playHistory(past);
  const of = (prefix: string) => history.filter((m) => m.tournamentId.startsWith(prefix));
  decorateCs2([...cs2.matches, ...of("cs2-")], rosters);
  decorateLol([...lol.matches, ...of("lol-")], rosters);

  const tournaments = [
    cs2.tournament,
    chess.tournament,
    tm.tournament,
    lol.tournament,
    rl.tournament,
    rlOpen.tournament,
    ...past,
  ];
  for (const t of tournaments) t.blurb ??= BLURBS[t.id];

  const world: World = {
    now: SAMPLE_NOW,
    disciplines,
    organizations,
    competitors,
    stints,
    tournaments,
    matches: [
      ...cs2.matches,
      ...lol.matches,
      ...chess.matches,
      ...tm.matches,
      ...rl.matches,
      ...rlOpen.matches,
      ...history,
    ],
    follows: SAMPLE_FOLLOWS,
    rankings: [],
  };
  fillPlacements(world);
  world.rankings = rankings(world);
  return world;
}
