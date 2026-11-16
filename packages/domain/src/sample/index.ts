import type { Competitor, World } from "../model.ts";
import { buildChess, chessPlayers } from "./chess.ts";
import { buildCs2, cs2Players, cs2Stints, cs2Teams } from "./cs2.ts";
import { disciplines, organizations } from "./disciplines.ts";
import { fillPlacements, otherEvents, rankings } from "./events.ts";
import { SAMPLE_NOW } from "./kit.ts";
import { buildLol, lolPlayers, lolStints, lolTeams } from "./lol.ts";
import { buildRocketLeague, rlTeams } from "./rocket-league.ts";
import { cs2Rosters, lolRosters, rlRosters } from "./rosters.ts";
import { decorateCs2, decorateLol, rosterIndex } from "./stats.ts";
import { buildTrackmania, tmPlayers } from "./trackmania.ts";

export { SAMPLE_NOW, SAMPLE_PROVENANCE } from "./kit.ts";

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
  const competitors: Competitor[] = unique([
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
  ]);
  const stints = [
    ...cs2Stints,
    ...cs2Rosters.stints,
    ...lolStints,
    ...lolRosters.stints.filter((s) => s.teamId !== "lol-t1"),
    ...rlRosters.stints,
  ];
  const rosters = rosterIndex(stints);
  decorateCs2(cs2.matches, rosters);
  decorateLol(lol.matches, rosters);

  const tournaments = [
    cs2.tournament,
    chess.tournament,
    tm.tournament,
    lol.tournament,
    rl.tournament,
    ...otherEvents(),
  ];
  for (const t of tournaments) t.blurb ??= BLURBS[t.id];

  const world: World = {
    now: SAMPLE_NOW,
    disciplines,
    organizations,
    competitors,
    stints,
    tournaments,
    matches: [...cs2.matches, ...lol.matches, ...chess.matches, ...tm.matches, ...rl.matches],
    follows: [
      { kind: "organization", id: "vitality" },
      { kind: "team", id: "lol-t1" },
      { kind: "player", id: "chess-carlsen" },
      { kind: "tournament", id: "tm-cup-finals-2026" },
    ],
    rankings: [],
  };
  fillPlacements(world);
  world.rankings = rankings(world);
  return world;
}
