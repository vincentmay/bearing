import { Atlas, swissRecords, winnerOf } from "../derive.ts";
import type { DisciplineId, Placement, Ranking, Tournament, World } from "../model.ts";
import { SAMPLE_PROVENANCE } from "./kit.ts";

type Band = [place: string, rank: number, prize: number];

function bands(list: Band[]): Placement[] {
  return list.map(([place, rank, prize]) => ({ place, rank, prize, competitorIds: [] }));
}

function shell(
  t: Omit<Tournament, "stages" | "provenance" | "colors"> & { colors?: Tournament["colors"] },
  palette: Record<DisciplineId, string>,
): Tournament {
  return {
    ...t,
    colors: t.colors ?? { primary: palette[t.discipline], secondary: "#111111" },
    stages: [],
    provenance: SAMPLE_PROVENANCE,
  };
}

const PALETTE: Record<DisciplineId, string> = {
  cs2: "#f0a43a",
  lol: "#c8aa6e",
  trackmania: "#2ef5a8",
  chess: "#e9e1cf",
  "rocket-league": "#3d8bff",
};

/** Completed and upcoming events with no match data: history for team pages and calendars. */
export function otherEvents(): Tournament[] {
  const done = (ids: string[][], prizes: Band[]): Placement[] =>
    bands(prizes).map((b, i) => ({ ...b, competitorIds: ids[i] ?? [] }));
  return [
    shell(
      {
        id: "cs2-autumn-showdown-2026",
        discipline: "cs2",
        name: "Autumn Showdown 2026",
        short: "Autumn Showdown",
        tier: "S",
        organizer: "Sample Esports",
        location: { city: "Stockholm", country: "SE", venue: "Avicii Arena" },
        start: "2026-10-14",
        end: "2026-10-25",
        prize: { amount: 1_000_000, currency: "USD" },
        participantIds: [],
        blurb: "Spirit beat Vitality 3–2 in a five-map final.",
        placements: done(
          [
            ["cs2-spirit"],
            ["cs2-vitality"],
            ["cs2-mouz", "cs2-falcons"],
            ["cs2-mongolz", "cs2-navi", "cs2-faze", "cs2-g2"],
          ],
          [
            ["1st", 1, 400_000],
            ["2nd", 2, 180_000],
            ["3rd–4th", 3, 80_000],
            ["5th–8th", 5, 40_000],
          ],
        ),
      },
      PALETTE,
    ),
    shell(
      {
        id: "cs2-summer-clash-2026",
        discipline: "cs2",
        name: "Summer Clash 2026",
        short: "Summer Clash",
        tier: "S",
        organizer: "Sample Esports",
        location: { city: "Cologne", country: "DE", venue: "Lanxess Arena" },
        start: "2026-08-04",
        end: "2026-08-16",
        prize: { amount: 1_000_000, currency: "USD" },
        participantIds: [],
        blurb: "Vitality's third title of the year, 3–1 over The MongolZ.",
        placements: done(
          [
            ["cs2-vitality"],
            ["cs2-mongolz"],
            ["cs2-spirit", "cs2-aurora"],
            ["cs2-mouz", "cs2-falcons", "cs2-furia", "cs2-navi"],
          ],
          [
            ["1st", 1, 400_000],
            ["2nd", 2, 180_000],
            ["3rd–4th", 3, 80_000],
            ["5th–8th", 5, 40_000],
          ],
        ),
      },
      PALETTE,
    ),
    shell(
      {
        id: "cs2-world-final-2026",
        discipline: "cs2",
        name: "World Final 2026",
        short: "World Final",
        tier: "S",
        organizer: "Sample Esports",
        location: { city: "Abu Dhabi", country: "AE", venue: "Etihad Arena" },
        start: "2026-12-09",
        end: "2026-12-13",
        prize: { amount: 2_000_000, currency: "USD" },
        participantIds: [
          "cs2-vitality",
          "cs2-spirit",
          "cs2-mouz",
          "cs2-mongolz",
          "cs2-falcons",
          "cs2-aurora",
          "cs2-faze",
          "cs2-navi",
        ],
        blurb: "The year's eight best teams. Field locked; bracket draw on 1 December.",
      },
      PALETTE,
    ),
    shell(
      {
        id: "lol-summer-showdown-2026",
        discipline: "lol",
        name: "Summer Showdown 2026",
        short: "Summer Showdown",
        tier: "S",
        organizer: "Sample Esports",
        location: { city: "Shanghai", country: "CN", venue: "Mercedes-Benz Arena" },
        start: "2026-07-01",
        end: "2026-07-13",
        prize: { amount: 1_500_000, currency: "USD" },
        participantIds: [],
        blurb: "Gen.G 3–1 T1 in an all-LCK final.",
        placements: done(
          [["lol-geng"], ["lol-t1"], ["lol-blg", "lol-hle"]],
          [
            ["1st", 1, 500_000],
            ["2nd", 2, 250_000],
            ["3rd–4th", 3, 150_000],
          ],
        ),
      },
      PALETTE,
    ),
    shell(
      {
        id: "chess-summer-rapid-2026",
        discipline: "chess",
        name: "Summer Rapid & Blitz 2026",
        short: "Summer Rapid",
        tier: "A",
        organizer: "Sample Chess Club",
        location: { city: "Zagreb", country: "HR" },
        start: "2026-07-06",
        end: "2026-07-10",
        prize: { amount: 175_000, currency: "USD" },
        participantIds: [],
        blurb: "Carlsen by a point and a half.",
        placements: done(
          [["chess-carlsen"], ["chess-nakamura"], ["chess-firouzja"]],
          [
            ["1st", 1, 40_000],
            ["2nd", 2, 30_000],
            ["3rd", 3, 25_000],
          ],
        ),
      },
      PALETTE,
    ),
    shell(
      {
        id: "chess-winter-classic-2027",
        discipline: "chess",
        name: "Winter Classic 2027",
        short: "Winter Classic",
        tier: "S",
        organizer: "Sample Chess Club",
        location: { city: "Wijk aan Zee", country: "NL" },
        start: "2027-01-16",
        end: "2027-02-01",
        prize: { amount: 300_000, currency: "EUR" },
        participantIds: [
          "chess-carlsen",
          "chess-gukesh",
          "chess-pragg",
          "chess-abdusattorov",
          "chess-weiyi",
        ],
        blurb: "Fourteen-player round robin by the sea. Five of the field confirmed.",
      },
      PALETTE,
    ),
    shell(
      {
        id: "tm-spring-cup-2026",
        discipline: "trackmania",
        name: "Trackmania Spring Cup 2026",
        short: "Spring Cup",
        tier: "A",
        organizer: "Sample Esports",
        location: null,
        start: "2026-04-18",
        end: "2026-04-19",
        prize: { amount: 40_000, currency: "EUR" },
        participantIds: [],
        blurb: "Online cup; Gwen took the final round from Bren.",
        placements: done(
          [["tm-gwen"], ["tm-bren"], ["tm-massa", "tm-affi"]],
          [
            ["1st", 1, 15_000],
            ["2nd", 2, 8_000],
            ["3rd–4th", 3, 4_000],
          ],
        ),
      },
      PALETTE,
    ),
    shell(
      {
        id: "rl-spring-major-2026",
        discipline: "rocket-league",
        name: "Spring Major 2026",
        short: "Spring Major",
        tier: "S",
        organizer: "Sample Esports",
        location: { city: "Copenhagen", country: "DK", venue: "Royal Arena" },
        start: "2026-05-28",
        end: "2026-06-07",
        prize: { amount: 350_000, currency: "USD" },
        participantIds: [],
        blurb: "Karmine Corp 4–2 Falcons.",
        placements: done(
          [["rl-kc"], ["rl-falcons"], ["rl-vitality", "rl-nrg"]],
          [
            ["1st", 1, 120_000],
            ["2nd", 2, 60_000],
            ["3rd–4th", 3, 30_000],
          ],
        ),
      },
      PALETTE,
    ),
  ];
}

/** Prize bands for the events that have matches, filled with whoever is already placed. */
export function fillPlacements(world: World) {
  const atlas = new Atlas(world);
  const set = (id: string, list: Band[], fill: (p: Placement[]) => void) => {
    const t = world.tournaments.find((x) => x.id === id);
    if (!t) return;
    t.placements = bands(list);
    fill(t.placements);
  };
  const losersOf = (roundId: string, tid: string) =>
    atlas
      .matchesOf(tid)
      .filter((m) => m.roundId === roundId && m.status === "finished")
      .map((m) => {
        const w = winnerOf(m);
        return typeof w === "number" ? m.sides[1 - w]?.competitorId : undefined;
      })
      .filter((x): x is string => !!x);

  set(
    "cs2-copenhagen-masters-2026",
    [
      ["1st", 1, 525_000],
      ["2nd", 2, 200_000],
      ["3rd–4th", 3, 100_000],
      ["5th–8th", 5, 50_000],
      ["9th–11th", 9, 20_000],
      ["12th–14th", 12, 15_000],
      ["15th–16th", 15, 10_000],
    ],
    (p) => {
      const tid = "cs2-copenhagen-masters-2026";
      const t = atlas.tournament(tid)!;
      const rec = swissRecords(atlas, t.stages[0]!, t.participantIds);
      p[2]!.competitorIds = losersOf("po-sf", tid);
      p[3]!.competitorIds = losersOf("po-qf", tid);
      p[4]!.competitorIds = rec
        .filter((r) => r.wins === 2 && r.losses === 3)
        .map((r) => r.competitorId);
      p[5]!.competitorIds = rec
        .filter((r) => r.wins === 1 && r.losses === 3)
        .map((r) => r.competitorId);
      p[6]!.competitorIds = rec.filter((r) => r.wins === 0).map((r) => r.competitorId);
    },
  );
  set(
    "lol-rift-invitational-2026",
    [
      ["1st", 1, 700_000],
      ["2nd", 2, 400_000],
      ["3rd–4th", 3, 200_000],
      ["5th–8th", 5, 125_000],
    ],
    (p) => {
      p[3]!.competitorIds = losersOf("ko-qf", "lol-rift-invitational-2026");
    },
  );
  set(
    "chess-fall-classic-2026",
    [
      ["1st", 1, 100_000],
      ["2nd", 2, 70_000],
      ["3rd", 3, 55_000],
      ["4th", 4, 40_000],
      ["5th", 5, 30_000],
      ["6th", 6, 22_000],
      ["7th", 7, 18_000],
      ["8th", 8, 15_000],
    ],
    () => {},
  );
  set(
    "tm-cup-finals-2026",
    [
      ["1st", 1, 50_000],
      ["2nd", 2, 20_000],
      ["3rd–4th", 3, 10_000],
      ["5th–8th", 5, 2_500],
    ],
    () => {},
  );
  set(
    "rl-open-major-paris-2026",
    [
      ["1st", 1, 150_000],
      ["2nd", 2, 80_000],
      ["3rd–4th", 3, 40_000],
      ["5th–8th", 5, 15_000],
      ["9th–16th", 9, 3_750],
    ],
    () => {},
  );
}

/** Illustrative rankings; points are invented for the sample. */
export function rankings(world: World): Ranking[] {
  const rank = (
    discipline: DisciplineId,
    title: string,
    ids: string[],
    top: number,
    step: number,
    changes: number[],
  ): Ranking => ({
    discipline,
    title,
    entries: ids.map((competitorId, i) => ({
      competitorId,
      points: Math.round(top - i * step - (i > 3 ? i * step * 0.3 : 0)),
      change: changes[i] ?? 0,
    })),
  });
  const chess = world.competitors
    .filter((c) => c.kind === "player" && c.discipline === "chess")
    .map((c) => c as Extract<typeof c, { kind: "player" }>)
    .sort((a, b) => (b.rating?.value ?? 0) - (a.rating?.value ?? 0));
  return [
    rank(
      "cs2",
      "Team ranking",
      [
        "cs2-vitality",
        "cs2-spirit",
        "cs2-mongolz",
        "cs2-mouz",
        "cs2-falcons",
        "cs2-aurora",
        "cs2-navi",
        "cs2-faze",
        "cs2-g2",
        "cs2-furia",
        "cs2-astralis",
        "cs2-liquid",
        "cs2-3dmax",
        "cs2-pain",
        "cs2-vp",
        "cs2-heroic",
      ],
      1000,
      48,
      [0, 1, -1, 0, 2, 3, -2, -2, 0, 1, -1, 2, -1, 0, -2, 0],
    ),
    rank(
      "lol",
      "Power ranking",
      ["lol-geng", "lol-blg", "lol-hle", "lol-t1", "lol-al", "lol-tes", "lol-g2", "lol-flyquest"],
      1000,
      55,
      [0, 0, 1, -1, 2, 0, 1, -3],
    ),
    {
      discipline: "chess",
      title: "Rating list",
      entries: chess.map((p, i) => ({
        competitorId: p.id,
        points: p.rating?.value ?? 0,
        change: [3, -2, 0, 5, -4, 1, 0, -1][i] ?? 0,
      })),
    },
    rank(
      "rocket-league",
      "Team ranking",
      ["rl-kc", "rl-falcons", "rl-nrg", "rl-vitality", "rl-furia", "rl-ssg", "rl-gm", "rl-g2"],
      1000,
      60,
      [0, 0, 1, -1, 0, 2, -1, -1],
    ),
    rank(
      "trackmania",
      "Player ranking",
      [
        "tm-bren",
        "tm-gwen",
        "tm-massa",
        "tm-affi",
        "tm-carljr",
        "tm-otaaaq",
        "tm-scrapie",
        "tm-mudda",
      ],
      1000,
      52,
      [0, 1, -1, 0, 0, 2, -1, -1],
    ),
  ];
}
