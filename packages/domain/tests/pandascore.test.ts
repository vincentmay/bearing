import { readFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import { Atlas, seriesScore, winnerOf } from "../src/index.ts";
import { teamColors } from "../src/sources/colors.ts";
import { type PandaSerie, mapSerie, prizeOf, seriesToFollow } from "../src/sources/pandascore.ts";

/** BLAST Rivals Fall 2026 as PandaScore answered on 2026-11-16: two groups and the playoffs. */
const source = JSON.parse(
  readFileSync(new URL("./fixtures/pandascore-serie.json", import.meta.url), "utf8"),
) as PandaSerie;
const now = Date.UTC(2026, 10, 16, 12, 0);
const mapped = mapSerie(source, "cs2", now);
const atlas = new Atlas({
  now: new Date(now).toISOString(),
  disciplines: [],
  organizations: [],
  competitors: mapped.competitors,
  stints: mapped.stints,
  tournaments: [mapped.tournament],
  matches: mapped.matches,
  follows: [],
  rankings: [],
});

describe("PandaScore", () => {
  test("one edition of a competition becomes one tournament with its stages", () => {
    const t = mapped.tournament;
    expect(t.name).toBe("BLAST Rivals Fall 2026");
    expect(t.discipline).toBe("cs2");
    expect(t.tier).toBe("S");
    expect(t.prize).toEqual({ amount: 1_000_000, currency: "USD" });
    expect(t.location?.country).toBe("HK");
    expect(t.stages.map((s) => s.name)).toEqual(["Group A", "Group B", "Playoffs"]);
    expect(t.provenance.source).toBe("PandaScore");
    // Nobody says who organises it, so nothing is said.
    expect(t.organizer).toBe("");
  });

  test("every match sits in a round of its stage, between known teams or named places", () => {
    expect(mapped.matches).toHaveLength(source.matches.length);
    for (const m of mapped.matches) {
      expect(atlas.roundOf(m)?.matchIds, m.id).toContain(m.id);
      for (const side of m.sides) {
        if (side.competitorId) expect(atlas.team(side.competitorId), m.id).toBeDefined();
        else expect(side.placeholder).toBeTruthy();
      }
    }
  });

  test("the series score is what PandaScore reports", () => {
    for (const raw of source.matches.filter((m) => m.status === "finished")) {
      const m = atlas.match(`ps-match-${raw.id}`)!;
      const score = seriesScore(m);
      raw.opponents!.forEach((o, i) => {
        const reported = raw.results!.find((r) => r.team_id === o.opponent.id)!.score;
        expect(score[i], raw.name).toBe(reported);
      });
      expect(winnerOf(m)).not.toBeUndefined();
    }
  });

  test("a group where losers play on is double elimination; the playoffs are a single tree", () => {
    const [groupA, , playoffs] = mapped.tournament.stages;
    expect(groupA!.format).toBe("double-elim");
    expect(groupA!.explainer).toContain("losers play on");
    expect(playoffs!.format).toBe("single-elim");
    expect(playoffs!.rounds.at(-1)!.matchIds).toHaveLength(1);
    // The bracket's links say where each winner goes.
    const final = atlas.match(playoffs!.rounds.at(-1)!.matchIds[0]!)!;
    const feeders = mapped.matches.filter((m) => m.next?.winner === final.id);
    expect(feeders).toHaveLength(2);
  });

  test("the winner of the last stage is first, and whoever lost the final is second", () => {
    const places = mapped.tournament.placements!;
    expect(places.map((p) => p.place)).toEqual(["1st", "2nd"]);
    const final = atlas.match(mapped.tournament.stages.at(-1)!.rounds.at(-1)!.matchIds[0]!)!;
    const w = winnerOf(final) as number;
    expect(places[0]!.competitorIds).toEqual([final.sides[w]!.competitorId]);
    expect(places[1]!.competitorIds).toEqual([final.sides[1 - w]!.competitorId]);
  });

  test("teams have their players, with no join date made up", () => {
    const team = mapped.competitors.find((c) => c.kind === "team" && c.name === "FURIA")!;
    const roster = atlas.roster(team.id);
    expect(roster.length).toBeGreaterThanOrEqual(5);
    for (const { stint } of roster) expect(stint.from).toBeUndefined();
  });

  test("a team has a colour only when one is known for it", () => {
    expect(teamColors("Team Vitality")?.primary).toBe("#f5e50a");
    expect(teamColors("VITALITY Esports")?.primary).toBe("#f5e50a");
    expect(teamColors("A Team Nobody Has Heard Of")).toBeUndefined();
  });

  test("a prize pool is read only when its currency is one Bearing can name", () => {
    expect(prizeOf("250,000 Euro")).toEqual({ amount: 250_000, currency: "EUR" });
    expect(prizeOf("5000 Gil")).toBeUndefined();
    expect(prizeOf(null)).toBeUndefined();
  });

  test("only the top tiers are followed, busiest first", () => {
    const list = [
      { serie_id: 1, tournament: { tier: "s" } },
      { serie_id: 2, tournament: { tier: "d" } },
      { serie_id: 3, tournament: { tier: "a" } },
      { serie_id: 3, tournament: { tier: "a" } },
    ];
    expect(seriesToFollow(list, ["s", "a"], 5)).toEqual([3, 1]);
    expect(seriesToFollow(list, ["s", "a"], 1)).toEqual([3]);
  });
});
