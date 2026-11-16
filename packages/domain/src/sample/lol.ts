import type { GameResult, Match, Player, Stint, Team, Tournament } from "../model.ts";
import { SAMPLE_PROVENANCE, cet, rng, scheduled, series, type Rand } from "./kit.ts";

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
  id: `lol-${id}`,
  discipline: "lol",
  orgId,
  name,
  short,
  region,
  country,
  colors: { primary, secondary },
});

export const lolTeams: Team[] = [
  team("geng", "Gen.G", "GEN", "LCK", "KR", "#b8952c", "#141414"),
  team("blg", "Bilibili Gaming", "BLG", "LPL", "CN", "#36a3ff", "#0c1830"),
  team("t1", "T1", "T1", "LCK", "KR", "#e2012d", "#121212"),
  team("hle", "Hanwha Life Esports", "HLE", "LCK", "KR", "#f37321", "#191919"),
  team("al", "Anyone's Legend", "AL", "LPL", "CN", "#d6b56d", "#1b1712"),
  team("g2", "G2 Esports", "G2", "LEC", "DE", "#f03e3e", "#111111", "g2"),
  team("tes", "Top Esports", "TES", "LPL", "CN", "#ff6c00", "#1a0f06"),
  team("flyquest", "FlyQuest", "FLY", "LTA", "US", "#3ddc84", "#0b1a12"),
];

const STRENGTH = [0.9, 0.85, 0.88, 0.8, 0.74, 0.62, 0.7, 0.55];

const p = (id: string, handle: string, name: string, country: string, role: string): Player => ({
  kind: "player",
  id: `lol-${id}`,
  discipline: "lol",
  handle,
  name,
  country,
  role,
});

export const lolPlayers: Player[] = [
  p("doran", "Doran", "Choi Hyeon-joon", "KR", "Top"),
  p("oner", "Oner", "Mun Hyeon-jun", "KR", "Jungle"),
  p("faker", "Faker", "Lee Sang-hyeok", "KR", "Mid"),
  p("peyz", "Peyz", "Kim Su-hwan", "KR", "Bot"),
  p("keria", "Keria", "Ryu Min-seok", "KR", "Support"),
];

export const lolStints: Stint[] = [
  { id: "lol-t1-doran", playerId: "lol-doran", teamId: "lol-t1", role: "Top", from: "2025-11-20" },
  { id: "lol-t1-oner", playerId: "lol-oner", teamId: "lol-t1", role: "Jungle", from: "2020-11-20" },
  { id: "lol-t1-faker", playerId: "lol-faker", teamId: "lol-t1", role: "Mid", from: "2013-02-01" },
  { id: "lol-t1-peyz", playerId: "lol-peyz", teamId: "lol-t1", role: "Bot", from: "2025-11-20" },
  {
    id: "lol-t1-keria",
    playerId: "lol-keria",
    teamId: "lol-t1",
    role: "Support",
    from: "2020-11-20",
  },
];

function gameScore(r: Rand, w: number) {
  const winnerKills = 14 + Math.floor(r() * 16);
  const loserKills = 3 + Math.floor(r() * (winnerKills - 6));
  const minutes = 26 + Math.floor(r() * 14);
  const seconds = Math.floor(r() * 60);
  return {
    scores: w === 0 ? [winnerKills, loserKills] : [loserKills, winnerKills],
    detail: `${minutes}:${String(seconds).padStart(2, "0")}`,
  };
}

export function buildLol() {
  const r = rng(20261107);
  const tid = "lol-rift-invitational-2026";
  const ids = lolTeams.map((t) => t.id);
  const strength = new Map(ids.map((id, i) => [id, STRENGTH[i]!]));
  const matches: Match[] = [];
  const pairs: [string, string][] = [
    [ids[0]!, ids[7]!],
    [ids[3]!, ids[4]!],
    [ids[1]!, ids[6]!],
    [ids[2]!, ids[5]!],
  ];
  const times = [
    cet("2026-11-07", "09:00"),
    cet("2026-11-07", "13:00"),
    cet("2026-11-08", "09:00"),
    cet("2026-11-08", "13:00"),
  ];
  const winners: string[] = [];
  pairs.forEach(([a, b], i) => {
    const s = series(r, {
      bestOf: 5,
      strengths: [strength.get(a)!, strength.get(b)!],
      labels: () => ({ games: [1, 2, 3, 4, 5].map((n) => `Game ${n}`) }),
      score: gameScore,
    });
    s.games.forEach((g, gi) => (g.firstSide = gi % 2));
    winners.push(s.games.filter((g) => g.winner === 0).length >= 3 ? a : b);
    matches.push({
      id: `${tid}-qf${i + 1}`,
      tournamentId: tid,
      stageId: "knockouts",
      roundId: "ko-qf",
      scheduledAt: times[i]!,
      bestOf: 5,
      status: "finished",
      sides: [{ competitorId: a }, { competitorId: b }],
      games: s.games,
      next: { winner: `${tid}-sf${i < 2 ? 1 : 2}` },
      stream: { label: "Broadcast", url: "#" },
    });
  });
  const gameLabel = (i: number) => `Game ${i + 1}`;
  // Semifinal 1 is being played now: three games done, the fourth 27 minutes in.
  const sf1Games: GameResult[] = [0, 1, 0].map((w, i) => ({
    label: gameLabel(i),
    status: "finished",
    winner: w,
    firstSide: i % 2,
    ...gameScore(r, w),
  }));
  sf1Games.push(
    {
      label: gameLabel(3),
      status: "live",
      firstSide: 1,
      scores: [14, 9],
      clock: 27 * 60 + 12,
      objectives: { towers: [5, 2], dragons: [2, 1], barons: [1, 0], gold: [51_400, 46_900] },
      events: (
        [
          [3, 0, "tower"],
          [6, 1, "dragon"],
          [9, 0, "tower"],
          [12, 0, "dragon"],
          [14, 1, "tower"],
          [15, 0, "tower"],
          [17, 0, "tower"],
          [19, 1, "tower"],
          [22, 0, "dragon"],
          [24, 0, "tower"],
          [26, 0, "baron"],
        ] as const
      ).map(([min, side, kind]) => ({ at: min * 60 + ((min * 37) % 60), side, kind })),
    },
    { label: gameLabel(4), status: "scheduled", firstSide: 0 },
  );
  matches.push(
    {
      id: `${tid}-sf1`,
      tournamentId: tid,
      stageId: "knockouts",
      roundId: "ko-sf",
      scheduledAt: cet("2026-11-15", "17:00"),
      bestOf: 5,
      status: "live",
      sides: [{ competitorId: winners[0]! }, { competitorId: winners[1]! }],
      games: sf1Games,
      next: { winner: `${tid}-final` },
      stream: { label: "Broadcast", url: "#" },
    },
    {
      id: `${tid}-sf2`,
      tournamentId: tid,
      stageId: "knockouts",
      roundId: "ko-sf",
      scheduledAt: cet("2026-11-22", "09:00"),
      bestOf: 5,
      status: "scheduled",
      sides: [{ competitorId: winners[2]! }, { competitorId: winners[3]! }],
      games: scheduled(5, gameLabel),
      next: { winner: `${tid}-final` },
      stream: { label: "Broadcast", url: "#" },
    },
    {
      id: `${tid}-final`,
      tournamentId: tid,
      stageId: "knockouts",
      roundId: "ko-final",
      scheduledAt: cet("2026-11-29", "09:00"),
      bestOf: 5,
      status: "scheduled",
      sides: [
        { competitorId: null, placeholder: "Winner of Semifinal 1" },
        { competitorId: null, placeholder: "Winner of Semifinal 2" },
      ],
      games: [],
      stream: { label: "Broadcast", url: "#" },
    },
  );

  const tournament: Tournament = {
    id: tid,
    discipline: "lol",
    name: "Rift Invitational 2026",
    short: "Rift Invitational",
    tier: "S",
    organizer: "Sample Esports",
    location: { city: "Seoul", country: "KR", venue: "Jamsil Arena" },
    start: "2026-11-07",
    end: "2026-11-29",
    prize: { amount: 2_000_000, currency: "USD" },
    colors: { primary: "#c8aa6e", secondary: "#071318" },
    participantIds: ids,
    provenance: SAMPLE_PROVENANCE,
    stages: [
      {
        id: "knockouts",
        name: "Knockout stage",
        format: "single-elim",
        start: "2026-11-07",
        end: "2026-11-29",
        explainer:
          "Eight teams, single elimination, every series best-of-five. Sides alternate each game; the higher seed starts on blue.",
        rounds: [
          {
            id: "ko-qf",
            name: "Quarterfinals",
            short: "QF",
            matchIds: [1, 2, 3, 4].map((n) => `${tid}-qf${n}`),
          },
          { id: "ko-sf", name: "Semifinals", short: "SF", matchIds: [`${tid}-sf1`, `${tid}-sf2`] },
          { id: "ko-final", name: "Final", short: "F", matchIds: [`${tid}-final`] },
        ],
      },
    ],
  };
  return { tournament, matches };
}
