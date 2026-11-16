import type { GameEvent, GameResult, Match, Team, Tournament } from "../model.ts";
import { SAMPLE_PROVENANCE, addMinutes, cet, rng, scheduled, type Rand } from "./kit.ts";

const team = (
  id: string,
  name: string,
  short: string,
  region: string,
  country: string,
  primary: string,
  secondary: string,
  orgId?: string,
): Team => ({
  kind: "team",
  id: `rl-${id}`,
  discipline: "rocket-league",
  orgId,
  name,
  short,
  region,
  country,
  colors: { primary, secondary },
});

export const rlTeams: Team[] = [
  team("kc", "Karmine Corp", "KC", "Europe", "FR", "#00b4ff", "#0a0f1e"),
  team("falcons", "Team Falcons", "FLC", "MENA", "SA", "#00c26e", "#0b1a12", "falcons"),
  team("nrg", "NRG", "NRG", "North America", "US", "#ff5c00", "#121212"),
  team("vitality", "Team Vitality", "VIT", "Europe", "FR", "#f5e50a", "#0d0d0d", "vitality"),
  team("furia", "FURIA", "FUR", "South America", "BR", "#e9e3d3", "#101010", "furia"),
  team("ssg", "Spacestation", "SSG", "North America", "US", "#ffd23f", "#141414"),
  team("gm", "Gentle Mates", "M8", "Europe", "FR", "#ff4fa3", "#160b12"),
  team("g2", "G2 Esports", "G2", "North America", "US", "#f03e3e", "#111111", "g2"),
  team("tm", "Twisted Minds", "TWIS", "MENA", "SA", "#b84cff", "#140a1c"),
  team("geekay", "Geekay Esports", "GK", "MENA", "AE", "#e6c34a", "#141414"),
  team("dignitas", "Dignitas", "DIG", "Europe", "US", "#ffcc00", "#1a1a1a"),
  team("wc", "Wildcard", "WC", "North America", "US", "#7cf06a", "#101410"),
  team("ultimates", "The Ultimates", "ULT", "Europe", "GB", "#4dd0ff", "#0d1218"),
  team("nip", "Ninjas in Pyjamas", "NIP", "South America", "SE", "#cfcfcf", "#111111"),
  team("mibr", "MIBR", "MIBR", "South America", "BR", "#2f7cff", "#0a1020"),
  team("pwr", "PWR", "PWR", "Oceania", "AU", "#ff3d6e", "#14080c"),
];

export function buildRocketLeague() {
  const tid = "rl-open-major-paris-2026";
  const ids = rlTeams.map((t) => t.id);
  const matches: Match[] = [];
  const start = cet("2026-11-20", "13:00");
  for (let i = 0; i < 8; i++) {
    matches.push({
      id: `${tid}-r1-m${i + 1}`,
      tournamentId: tid,
      stageId: "swiss",
      roundId: "swiss-r1",
      scheduledAt: addMinutes(start, Math.floor(i / 2) * 60),
      bestOf: 5,
      status: "scheduled",
      sides: [{ competitorId: ids[i]! }, { competitorId: ids[i + 8]! }],
      games: scheduled(5, (n) => `Game ${n + 1}`),
      stream: { label: i % 2 === 0 ? "Stream A" : "Stream B", url: "#" },
    });
  }
  const tournament: Tournament = {
    id: tid,
    discipline: "rocket-league",
    name: "Open Major Paris 2026",
    short: "Paris Major",
    tier: "S",
    organizer: "Sample Esports",
    location: { city: "Paris", country: "FR", venue: "Accor Arena" },
    start: "2026-11-20",
    end: "2026-11-29",
    prize: { amount: 400_000, currency: "USD" },
    colors: { primary: "#3d8bff", secondary: "#060c1a" },
    participantIds: ids,
    provenance: SAMPLE_PROVENANCE,
    stages: [
      {
        id: "swiss",
        name: "Swiss stage",
        format: "swiss",
        start: "2026-11-20",
        end: "2026-11-22",
        explainer:
          "Sixteen teams, best-of-five series. Three wins to qualify for the playoffs, three losses to go home.",
        rules: { winsToAdvance: 3, lossesToExit: 3 },
        rounds: [
          { id: "swiss-r1", name: "Round 1", short: "R1", matchIds: matches.map((m) => m.id) },
          ...[2, 3, 4, 5].map((n) => ({
            id: `swiss-r${n}`,
            name: `Round ${n}`,
            short: `R${n}`,
            matchIds: [],
          })),
        ],
      },
      {
        id: "playoffs",
        name: "Playoffs",
        format: "single-elim",
        start: "2026-11-27",
        end: "2026-11-29",
        explainer: "Eight qualified teams, single elimination. Best-of-seven throughout.",
        rounds: [],
      },
    ],
  };
  return { tournament, matches };
}

/** A finished game: five minutes, goals at their moments, and overtime when it was level. */
function rlGame(r: Rand, label: string, winner: number): GameResult {
  const overtime = r() < 0.2;
  const loserGoals = Math.floor(r() * 3);
  const winnerGoals = overtime ? loserGoals + 1 : loserGoals + 1 + Math.floor(r() * 3);
  const sides: number[] = [
    ...Array.from({ length: overtime ? winnerGoals - 1 : winnerGoals }, () => winner),
    ...Array.from({ length: loserGoals }, () => 1 - winner),
  ];
  const events: GameEvent[] = sides
    .map((side) => ({ at: 8 + Math.floor(r() * 288), side, kind: "goal" as const }))
    .sort((a, b) => a.at - b.at);
  let clock = 300;
  if (overtime) {
    clock = 300 + 12 + Math.floor(r() * 140);
    events.push({ at: clock, side: winner, kind: "goal" });
  }
  const scores = [0, 0];
  for (const e of events) scores[e.side]!++;
  return {
    label,
    status: "finished",
    winner,
    scores,
    clock,
    events,
    detail: overtime ? "Overtime" : undefined,
  };
}

/**
 * A four-team online event whose final is being played now, so the sample has Rocket League that
 * is live and Rocket League that is over.
 */
export function buildRocketLeagueOpen() {
  const r = rng(20261114);
  const tid = "rl-winter-open-2026";
  const label = (i: number) => `Game ${i + 1}`;
  const finished = (id: string, at: string, a: string, b: string, winners: number[]): Match => ({
    id,
    tournamentId: tid,
    stageId: "playoffs",
    roundId: "po-sf",
    scheduledAt: at,
    bestOf: 7,
    status: "finished",
    sides: [{ competitorId: a }, { competitorId: b }],
    games: winners.map((w, i) => rlGame(r, label(i), w)),
    next: { winner: `${tid}-final` },
    stream: { label: "Stream", url: "#" },
  });
  const matches: Match[] = [
    finished(`${tid}-sf1`, cet("2026-11-14", "18:00"), "rl-kc", "rl-vitality", [0, 1, 0, 0, 1, 0]),
    finished(`${tid}-sf2`, cet("2026-11-14", "20:00"), "rl-falcons", "rl-gm", [1, 1, 0, 1, 1]),
    {
      id: `${tid}-final`,
      tournamentId: tid,
      stageId: "playoffs",
      roundId: "po-final",
      scheduledAt: cet("2026-11-15", "19:00"),
      bestOf: 7,
      status: "live",
      sides: [{ competitorId: "rl-kc" }, { competitorId: "rl-gm" }],
      games: [
        ...[0, 1, 0].map((w, i) => rlGame(r, label(i), w)),
        {
          label: label(3),
          status: "live",
          scores: [3, 2],
          clock: 228,
          events: (
            [
              [42, 0],
              [90, 1],
              [135, 0],
              [183, 0],
              [216, 1],
            ] as const
          ).map(([at, side]) => ({ at, side, kind: "goal" as const })),
        },
        ...[4, 5, 6].map((i): GameResult => ({ label: label(i), status: "scheduled" })),
      ],
      stream: { label: "Stream", url: "#" },
    },
  ];
  const tournament: Tournament = {
    id: tid,
    discipline: "rocket-league",
    name: "Winter Open 2026",
    short: "Winter Open",
    tier: "A",
    organizer: "Sample Esports",
    location: null,
    start: "2026-11-14",
    end: "2026-11-15",
    prize: { amount: 50_000, currency: "USD" },
    colors: { primary: "#3d8bff", secondary: "#060c1a" },
    participantIds: ["rl-kc", "rl-vitality", "rl-falcons", "rl-gm"],
    provenance: SAMPLE_PROVENANCE,
    blurb: "Four invited teams, played online over one weekend.",
    placements: [
      { place: "1st", rank: 1, prize: 25_000, competitorIds: [] },
      { place: "2nd", rank: 2, prize: 12_500, competitorIds: [] },
      { place: "3rd–4th", rank: 3, prize: 6_250, competitorIds: ["rl-vitality", "rl-falcons"] },
    ],
    stages: [
      {
        id: "playoffs",
        name: "Playoffs",
        format: "single-elim",
        start: "2026-11-14",
        end: "2026-11-15",
        explainer:
          "Four teams, single elimination. Every series is best-of-seven: the first team to win four games goes through.",
        rounds: [
          { id: "po-sf", name: "Semifinals", short: "SF", matchIds: [`${tid}-sf1`, `${tid}-sf2`] },
          { id: "po-final", name: "Final", short: "F", matchIds: [`${tid}-final`] },
        ],
      },
    ],
  };
  return { tournament, matches };
}
