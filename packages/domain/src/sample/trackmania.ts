import type { Match, Player, Tournament } from "../model.ts";
import { SAMPLE_PROVENANCE, addMinutes, cet } from "./kit.ts";

const p = (handle: string, country: string): Player => ({
  kind: "player",
  id: `tm-${handle.toLowerCase()}`,
  discipline: "trackmania",
  handle,
  country,
});

export const tmPlayers: Player[] = [
  p("Bren", "FR"),
  p("Gwen", "FR"),
  p("Massa", "DE"),
  p("Affi", "DE"),
  p("CarlJr", "CA"),
  p("Otaaaq", "FR"),
  p("Scrapie", "DE"),
  p("Mudda", "NL"),
  p("Pac", "FR"),
  p("Elconn", "FR"),
  p("Aurel", "FR"),
  p("Kappa", "PL"),
  p("Hylis", "FR"),
  p("Link", "BE"),
  p("Spam", "FR"),
  p("Wosile", "BE"),
];

const TRACKS = ["Glacier Run", "Copper Loop", "Paddock 7", "Sunken Pier", "Ridge Drift"];

export function buildTrackmania() {
  const tid = "tm-cup-finals-2026";
  const ids = tmPlayers.map((x) => x.id);
  const matches: Match[] = [];
  const groups = [
    [0, 7, 8, 15],
    [3, 4, 11, 12],
    [1, 6, 9, 14],
    [2, 5, 10, 13],
  ];
  const qfStart = cet("2026-11-15", "19:30");
  const letters = ["A", "B", "C", "D"];
  groups.forEach((g, i) => {
    matches.push({
      id: `${tid}-qf-${letters[i]}`,
      tournamentId: tid,
      stageId: "cup",
      roundId: "cup-qf",
      scheduledAt: addMinutes(qfStart, i * 30),
      bestOf: 1,
      // Quarterfinal A is being raced right now; Mudda has reached the point limit.
      status: i === 0 ? "live" : "scheduled",
      sides: g.map((n) => ({ competitorId: ids[n]! })),
      games: [
        i === 0
          ? {
              label: TRACKS[i]!,
              status: "live",
              scores: [100, 120, 75, 40],
              detail: "Round 9",
              cup: { limit: 120, round: 9, finalists: [1] },
            }
          : { label: TRACKS[i]!, status: "scheduled" },
      ],
      next: { winner: `${tid}-sf-${i < 2 ? "A" : "B"}` },
      stream: { label: "Main stream", url: "#" },
    });
  });
  (["A", "B"] as const).forEach((l, i) => {
    const feeders = i === 0 ? ["A", "B"] : ["C", "D"];
    matches.push({
      id: `${tid}-sf-${l}`,
      tournamentId: tid,
      stageId: "cup",
      roundId: "cup-sf",
      scheduledAt: cet("2026-11-16", i === 0 ? "20:00" : "20:45"),
      bestOf: 1,
      status: "scheduled",
      sides: feeders.flatMap((f) => [
        { competitorId: null, placeholder: `Quarterfinal ${f} · 1st` },
        { competitorId: null, placeholder: `Quarterfinal ${f} · 2nd` },
      ]),
      games: [{ label: TRACKS[4 - i]!, status: "scheduled" }],
      next: { winner: `${tid}-final` },
      stream: { label: "Main stream", url: "#" },
    });
  });
  matches.push({
    id: `${tid}-final`,
    tournamentId: tid,
    stageId: "cup",
    roundId: "cup-final",
    scheduledAt: cet("2026-11-16", "21:30"),
    bestOf: 1,
    status: "scheduled",
    sides: ["A", "B"].flatMap((f) => [
      { competitorId: null, placeholder: `Semifinal ${f} · 1st` },
      { competitorId: null, placeholder: `Semifinal ${f} · 2nd` },
    ]),
    games: [{ label: "Final track", status: "scheduled" }],
    stream: { label: "Main stream", url: "#" },
  });

  const tournament: Tournament = {
    id: tid,
    discipline: "trackmania",
    name: "Trackmania Cup Finals 2026",
    short: "Cup Finals",
    tier: "S",
    organizer: "Sample Esports",
    location: { city: "Lyon", country: "FR", venue: "LDLC Arena" },
    start: "2026-11-15",
    end: "2026-11-16",
    prize: { amount: 100_000, currency: "EUR" },
    colors: { primary: "#2ef5a8", secondary: "#05110f" },
    participantIds: ids,
    provenance: SAMPLE_PROVENANCE,
    stages: [
      {
        id: "cup",
        name: "Cup knockout",
        format: "cup",
        start: "2026-11-15",
        end: "2026-11-16",
        explainer:
          "Four players race each match on the same track. Every round awards points by finishing position; reach the point limit, then win one more round to finish first. The top two in each match advance.",
        rules: { advancePerMatch: 2 },
        rounds: [
          {
            id: "cup-qf",
            name: "Quarterfinals",
            short: "QF",
            matchIds: letters.map((l) => `${tid}-qf-${l}`),
          },
          {
            id: "cup-sf",
            name: "Semifinals",
            short: "SF",
            matchIds: [`${tid}-sf-A`, `${tid}-sf-B`],
          },
          { id: "cup-final", name: "Final", short: "F", matchIds: [`${tid}-final`] },
        ],
      },
    ],
  };
  return { tournament, matches };
}
