import type { Match, Player, Round, Stint, Team, Tournament, Veto } from "../model.ts";
import {
  SAMPLE_PROVENANCE,
  addMinutes,
  cet,
  rng,
  series,
  shuffle,
  statusAt,
  type Rand,
} from "./kit.ts";

const MAP_POOL = ["Ancient", "Anubis", "Dust2", "Inferno", "Mirage", "Nuke", "Train"] as const;

const team = (
  id: string,
  name: string,
  short: string,
  region: string,
  country: string | undefined,
  primary: string,
  secondary: string,
  orgId?: string,
): Team => ({
  kind: "team",
  id: `cs2-${id}`,
  discipline: "cs2",
  orgId,
  name,
  short,
  region,
  country,
  colors: { primary, secondary },
});

/** Seed order for the event, strongest first. */
export const cs2Teams: Team[] = [
  {
    ...team("vitality", "Team Vitality", "VIT", "Europe", "FR", "#f5e50a", "#0d0d0d", "vitality"),
    founded: "2013",
  },
  team("mouz", "MOUZ", "MOUZ", "Europe", "DE", "#e8343b", "#1a0b0c"),
  team("spirit", "Team Spirit", "SPR", "CIS", undefined, "#d9d9de", "#18181b"),
  team("mongolz", "The MongolZ", "MGLZ", "Asia", "MN", "#ff7a1a", "#13204d"),
  team("falcons", "Team Falcons", "FLC", "Middle East", "SA", "#00c26e", "#0b1a12", "falcons"),
  team("faze", "FaZe Clan", "FAZE", "Europe", undefined, "#e43d30", "#121212"),
  team("navi", "Natus Vincere", "NAVI", "Europe", "UA", "#ffe14d", "#0f1730"),
  team("aurora", "Aurora", "AUR", "Europe", "TR", "#9b7bff", "#140f24"),
  team("g2", "G2 Esports", "G2", "Europe", "DE", "#f03e3e", "#111111", "g2"),
  team("furia", "FURIA", "FUR", "South America", "BR", "#e9e3d3", "#101010", "furia"),
  team("astralis", "Astralis", "AST", "Europe", "DK", "#ff3a3a", "#101a3a"),
  team("pain", "paiN Gaming", "PAIN", "South America", "BR", "#ff2e4c", "#0f0f10"),
  team("liquid", "Team Liquid", "TL", "North America", "US", "#3ea6ff", "#0b2e5c"),
  team("3dmax", "3DMAX", "3DM", "Europe", "FR", "#ff5a1f", "#141414"),
  team("vp", "Virtus.pro", "VP", "CIS", undefined, "#ff8a00", "#121212"),
  team("heroic", "HEROIC", "HER", "Europe", "DK", "#ff9e2e", "#151515"),
];

const STRENGTH = [
  0.95, 0.82, 0.84, 0.86, 0.74, 0.7, 0.72, 0.66, 0.64, 0.6, 0.55, 0.52, 0.5, 0.48, 0.46, 0.4,
];

const p = (
  id: string,
  handle: string,
  name: string,
  country: string,
  born: string,
  role: string,
): Player => ({
  kind: "player",
  id: `cs2-${id}`,
  discipline: "cs2",
  handle,
  name,
  country,
  born,
  role,
});

export const cs2Players: Player[] = [
  p("apex", "apEX", "Dan Madesclaire", "FR", "1993-02-22", "In-game leader"),
  p("zywoo", "ZywOo", "Mathieu Herbaut", "FR", "2000-11-09", "AWPer"),
  p("flamez", "flameZ", "Shahar Shushan", "IL", "2003-06-21", "Entry"),
  p("mezii", "mezii", "William Merriman", "GB", "1998-10-15", "Support"),
  p("ropz", "ropz", "Robin Kool", "EE", "1999-12-22", "Lurker"),
  p("xtqzzz", "XTQZZZ", "Rémy Quoniam", "FR", "1992-03-09", "Coach"),
  p("spinx", "Spinx", "Lotan Giladi", "IL", "2000-04-20", "Rifler"),
  p("dupreeh", "dupreeh", "Peter Rasmussen", "DK", "1993-03-26", "Rifler"),
  p("magisk", "Magisk", "Emil Reif", "DK", "1998-04-24", "Rifler"),
  p("misutaaa", "misutaaa", "Kévin Rabier", "FR", "2001-07-02", "Entry"),
  p("kyojin", "Kyojin", "Jayson Nguyen Van", "FR", "2002-03-14", "Rifler"),
  p("shox", "shox", "Richard Papillon", "FR", "1992-05-27", "Rifler"),
  p("rpk", "RpK", "Cédric Guipouy", "FR", "1989-12-20", "Rifler"),
  p("nbk", "NBK-", "Nathan Schmitt", "FR", "1994-04-07", "Rifler"),
  p("alex", "ALEX", "Alex McMeekin", "GB", "1995-02-04", "In-game leader"),
];

const stint = (
  playerId: string,
  role: string,
  from: string,
  to?: string,
  note?: string,
): Stint => ({
  id: `cs2-vitality-${playerId}-${from}`,
  playerId: `cs2-${playerId}`,
  teamId: "cs2-vitality",
  role,
  from,
  to,
  note,
});

/** Approximate history for the sample; dates are not verified. */
export const cs2Stints: Stint[] = [
  stint("nbk", "Rifler", "2018-08-01", "2020-03-01"),
  stint("alex", "In-game leader", "2018-08-01", "2020-01-15"),
  stint("rpk", "Rifler", "2018-08-01", "2021-07-01"),
  stint("apex", "In-game leader", "2018-08-01"),
  stint("zywoo", "AWPer", "2018-10-01"),
  stint("shox", "Rifler", "2020-03-01", "2021-12-31"),
  stint("misutaaa", "Entry", "2020-12-01", "2021-12-31"),
  stint("kyojin", "Rifler", "2021-07-01", "2021-12-31"),
  stint("magisk", "Rifler", "2022-01-01", "2023-07-01"),
  stint("dupreeh", "Rifler", "2022-01-01", "2023-12-31"),
  stint("spinx", "Rifler", "2022-01-01", "2025-01-01"),
  stint("flamez", "Entry", "2023-07-01"),
  stint("mezii", "Support", "2024-01-01"),
  stint("ropz", "Lurker", "2025-01-01"),
  stint("xtqzzz", "Coach", "2023-01-01"),
];

function bo3Veto(r: Rand): { games: string[]; veto: Veto[]; picks: (number | undefined)[] } {
  const order = shuffle(r, MAP_POOL);
  const veto: Veto[] = [
    { action: "ban", side: 0, label: order[0]! },
    { action: "ban", side: 1, label: order[1]! },
    { action: "pick", side: 0, label: order[2]! },
    { action: "pick", side: 1, label: order[3]! },
    { action: "ban", side: 0, label: order[4]! },
    { action: "ban", side: 1, label: order[5]! },
    { action: "decider", label: order[6]! },
  ];
  return { games: [order[2]!, order[3]!, order[6]!], veto, picks: [0, 1, undefined] };
}

function bo5Veto(r: Rand): { games: string[]; veto: Veto[]; picks: (number | undefined)[] } {
  const order = shuffle(r, MAP_POOL);
  const veto: Veto[] = [
    { action: "ban", side: 0, label: order[0]! },
    { action: "ban", side: 1, label: order[1]! },
    { action: "pick", side: 0, label: order[2]! },
    { action: "pick", side: 1, label: order[3]! },
    { action: "pick", side: 0, label: order[4]! },
    { action: "pick", side: 1, label: order[5]! },
    { action: "decider", label: order[6]! },
  ];
  return { games: order.slice(2, 7), veto, picks: [0, 1, 0, 1, undefined] };
}

function mapScore(r: Rand, w: number) {
  const ot = r() < 0.12;
  let a: number;
  let b: number;
  let detail: string | undefined;
  if (ot) {
    const extra = r() < 0.75 ? 0 : 3;
    a = 16 + extra;
    b = 14 + extra;
    detail = extra ? "Double overtime" : "Overtime";
  } else {
    a = 13;
    b = Math.floor(r() * 12);
  }
  return { scores: w === 0 ? [a, b] : [b, a], detail };
}

export function buildCs2() {
  const r = rng(20261105);
  const ids = cs2Teams.map((t) => t.id);
  const strength = new Map(ids.map((id, i) => [id, STRENGTH[i]!]));
  const seedOf = new Map(ids.map((id, i) => [id, i]));
  const matches: Match[] = [];
  const tid = "cs2-copenhagen-masters-2026";

  // ---- Swiss stage ----
  const record = new Map(ids.map((id) => [id, { w: 0, l: 0 }]));
  const played = new Map(ids.map((id) => [id, new Set<string>()]));
  const swissRounds: Round[] = [];
  for (let round = 0; round < 5; round++) {
    const active = ids.filter((id) => record.get(id)!.w < 3 && record.get(id)!.l < 3);
    const pairs: [string, string][] = [];
    if (round === 0) {
      for (let i = 0; i < 8; i++) pairs.push([ids[i]!, ids[i + 8]!]);
    } else {
      const groups = new Map<string, string[]>();
      for (const id of active) {
        const { w, l } = record.get(id)!;
        const key = `${w}-${l}`;
        groups.set(key, [...(groups.get(key) ?? []), id]);
      }
      const keys = [...groups.keys()].sort(
        (a, b) => Number(b.split("-")[0]) - Number(a.split("-")[0]),
      );
      for (const key of keys) {
        const pool = groups.get(key)!.sort((a, b) => seedOf.get(a)! - seedOf.get(b)!);
        while (pool.length) {
          const top = pool.shift()!;
          let idx = pool.length - 1;
          while (idx > 0 && played.get(top)!.has(pool[idx]!)) idx--;
          const [bottom] = pool.splice(idx, 1);
          pairs.push([top, bottom!]);
        }
      }
    }
    const date = `2026-11-${String(5 + round).padStart(2, "0")}`;
    const round_: Round = {
      id: `swiss-r${round + 1}`,
      name: `Round ${round + 1}`,
      short: `R${round + 1}`,
      matchIds: [],
    };
    let clockMin = 11 * 60;
    pairs.forEach(([a, b], i) => {
      const ra = record.get(a)!;
      const decisive = ra.w === 2 || ra.l === 2;
      const bestOf = decisive ? 3 : 1;
      const at = cet(
        date,
        `${String(Math.floor(clockMin / 60)).padStart(2, "0")}:${String(clockMin % 60).padStart(2, "0")}`,
      );
      clockMin += bestOf === 3 ? 150 : 70;
      const s = series(r, {
        bestOf,
        strengths: [strength.get(a)!, strength.get(b)!],
        labels: (rr) => (bestOf === 3 ? bo3Veto(rr) : { games: [shuffle(rr, MAP_POOL)[0]!] }),
        score: mapScore,
      });
      const id = `${tid}-swiss-r${round + 1}-m${i + 1}`;
      matches.push({
        id,
        tournamentId: tid,
        stageId: "swiss",
        roundId: round_.id,
        scheduledAt: at,
        bestOf,
        status: "finished",
        sides: [{ competitorId: a }, { competitorId: b }],
        games: s.games,
        veto: s.veto,
      });
      round_.matchIds.push(id);
      const winner =
        s.games.filter((g) => g.winner === 0).length > s.games.filter((g) => g.winner === 1).length
          ? a
          : b;
      const loser = winner === a ? b : a;
      record.get(winner)!.w++;
      record.get(loser)!.l++;
      played.get(a)!.add(b);
      played.get(b)!.add(a);
    });
    swissRounds.push(round_);
  }

  const qualified = ids
    .filter((id) => record.get(id)!.w === 3)
    .sort((a, b) => record.get(a)!.l - record.get(b)!.l || seedOf.get(a)! - seedOf.get(b)!);

  // ---- Playoffs: 8-team single elimination ----
  const q = (n: number) => qualified[n - 1]!;
  const qfPairs: [string, string][] = [
    [q(1), q(8)],
    [q(4), q(5)],
    [q(2), q(7)],
    [q(3), q(6)],
  ];
  const qfTimes = [
    cet("2026-11-12", "14:30"),
    cet("2026-11-12", "18:00"),
    cet("2026-11-13", "14:30"),
    cet("2026-11-13", "18:00"),
  ];
  const qfIds = qfPairs.map((_, i) => `${tid}-po-qf${i + 1}`);
  const sfIds = [`${tid}-po-sf1`, `${tid}-po-sf2`];
  const finalId = `${tid}-po-final`;
  const qfWinners: string[] = [];
  qfPairs.forEach(([a, b], i) => {
    const s = series(r, {
      bestOf: 3,
      strengths: [strength.get(a)!, strength.get(b)!],
      labels: bo3Veto,
      score: mapScore,
    });
    const w = s.games.filter((g) => g.winner === 0).length >= 2 ? a : b;
    qfWinners.push(w);
    matches.push({
      id: qfIds[i]!,
      tournamentId: tid,
      stageId: "playoffs",
      roundId: "po-qf",
      scheduledAt: qfTimes[i]!,
      bestOf: 3,
      status: "finished",
      sides: [{ competitorId: a }, { competitorId: b }],
      games: s.games,
      veto: s.veto,
      next: { winner: sfIds[i < 2 ? 1 : 0] },
      stream: { label: "Main stream", url: "#" },
    });
  });

  // Semifinal 1 (bottom half) was yesterday; semifinal 2 (top half) is live now.
  const sf1Sides: [string, string] = [qfWinners[2]!, qfWinners[3]!];
  const sf1 = series(r, {
    bestOf: 3,
    strengths: [strength.get(sf1Sides[0])!, strength.get(sf1Sides[1])!],
    labels: bo3Veto,
    score: mapScore,
  });
  const sf1Winner = sf1.games.filter((g) => g.winner === 0).length >= 2 ? sf1Sides[0] : sf1Sides[1];
  matches.push({
    id: sfIds[0]!,
    tournamentId: tid,
    stageId: "playoffs",
    roundId: "po-sf",
    scheduledAt: cet("2026-11-14", "18:00"),
    bestOf: 3,
    status: "finished",
    sides: sf1Sides.map((c) => ({ competitorId: c })),
    games: sf1.games,
    veto: sf1.veto,
    next: { winner: finalId },
    stream: { label: "Main stream", url: "#" },
  });

  const sf2Sides: [string, string] = [qfWinners[0]!, qfWinners[1]!];
  const sf2Start = cet("2026-11-15", "18:00");
  const sf2 = series(rng(77), {
    bestOf: 3,
    strengths: [0.9, 0.5],
    labels: bo3Veto,
    score: mapScore,
    liveAfter: 1,
    liveScore: [9, 7],
  });
  matches.push({
    id: sfIds[1]!,
    tournamentId: tid,
    stageId: "playoffs",
    roundId: "po-sf",
    scheduledAt: sf2Start,
    bestOf: 3,
    status: statusAt(sf2Start, 240),
    sides: sf2Sides.map((c) => ({ competitorId: c })),
    games: sf2.games,
    veto: sf2.veto,
    next: { winner: finalId },
    stream: { label: "Main stream", url: "#" },
  });

  matches.push({
    id: finalId,
    tournamentId: tid,
    stageId: "playoffs",
    roundId: "po-final",
    scheduledAt: cet("2026-11-16", "18:00"),
    bestOf: 5,
    status: "scheduled",
    sides: [
      { competitorId: sf1Winner },
      { competitorId: null, placeholder: "Winner of Semifinal 2" },
    ],
    games: [],
    stream: { label: "Main stream", url: "#" },
  });
  void bo5Veto;

  const tournament: Tournament = {
    id: tid,
    discipline: "cs2",
    name: "Copenhagen Masters 2026",
    short: "CPH Masters",
    series: "Masters",
    tier: "S",
    organizer: "Sample Esports",
    location: { city: "Copenhagen", country: "DK", venue: "Royal Arena" },
    start: "2026-11-05",
    end: "2026-11-16",
    prize: { amount: 1_250_000, currency: "USD" },
    colors: { primary: "#f0a43a", secondary: "#160f06" },
    participantIds: ids,
    provenance: SAMPLE_PROVENANCE,
    stages: [
      {
        id: "swiss",
        name: "Swiss stage",
        format: "swiss",
        start: "2026-11-05",
        end: "2026-11-09",
        explainer:
          "Sixteen teams, five rounds. Each round pairs teams with the same win–loss record. Three wins sends a team to the playoffs, three losses sends it home. Matches that decide advancement or elimination are best-of-three; the rest are a single map.",
        rules: { winsToAdvance: 3, lossesToExit: 3 },
        rounds: swissRounds,
      },
      {
        id: "playoffs",
        name: "Playoffs",
        format: "single-elim",
        start: "2026-11-12",
        end: "2026-11-16",
        explainer:
          "The eight Swiss qualifiers play a single-elimination bracket in the arena, seeded by Swiss record. Every series is best-of-three until the grand final, which is best-of-five. Lose once and you are out.",
        rounds: [
          // Bracket order, top to bottom: QF3 and QF4 feed Semifinal 1, QF1 and QF2 feed Semifinal 2.
          {
            id: "po-qf",
            name: "Quarterfinals",
            short: "QF",
            matchIds: [qfIds[2]!, qfIds[3]!, qfIds[0]!, qfIds[1]!],
          },
          { id: "po-sf", name: "Semifinals", short: "SF", matchIds: [sfIds[0]!, sfIds[1]!] },
          { id: "po-final", name: "Grand final", short: "GF", matchIds: [finalId] },
        ],
      },
    ],
  };

  void addMinutes;
  return { tournament, matches, seeds: ids };
}
