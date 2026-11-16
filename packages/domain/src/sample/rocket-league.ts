import type { Match, Team, Tournament } from "../model.ts";
import { SAMPLE_PROVENANCE, addMinutes, cet, scheduled } from "./kit.ts";

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
