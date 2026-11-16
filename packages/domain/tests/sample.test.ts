import { describe, expect, test } from "vite-plus/test";
import { Atlas, roundRobinStandings, seriesScore, swissRecords, winnerOf } from "../src/index.ts";
import { buildSampleWorld } from "../src/sample/index.ts";

const world = buildSampleWorld();
const atlas = new Atlas(world);

describe("sample world integrity", () => {
  test("every round references existing matches of the same tournament and stage", () => {
    for (const t of world.tournaments) {
      for (const stage of t.stages) {
        for (const round of stage.rounds) {
          for (const id of round.matchIds) {
            const m = atlas.match(id);
            expect(m, id).toBeDefined();
            expect(m!.tournamentId).toBe(t.id);
            expect(m!.stageId).toBe(stage.id);
            expect(m!.roundId).toBe(round.id);
          }
        }
      }
    }
  });

  test("every match side is a known competitor or an explicit placeholder", () => {
    for (const m of world.matches) {
      for (const side of m.sides) {
        if (side.competitorId)
          expect(atlas.competitor(side.competitorId), `${m.id} ${side.competitorId}`).toBeDefined();
        else expect(side.placeholder, m.id).toBeTruthy();
      }
    }
  });

  test("finished series have a decisive winner", () => {
    for (const m of world.matches.filter((x) => x.status === "finished" && x.bestOf > 1)) {
      const s = seriesScore(m);
      expect(Math.max(...s), m.id).toBe(Math.ceil(m.bestOf / 2));
    }
  });

  test("the CS2 Swiss stage sends exactly eight teams through and eight home", () => {
    const t = atlas.tournament("cs2-copenhagen-masters-2026")!;
    const records = swissRecords(atlas, t.stages[0]!, t.participantIds);
    expect(records.filter((r) => r.status === "advanced")).toHaveLength(8);
    expect(records.filter((r) => r.status === "eliminated")).toHaveLength(8);
    for (const r of records) expect(r.wins + r.losses).toBeLessThanOrEqual(5);
  });

  test("the chess round robin pairs every player with every other exactly once", () => {
    const t = atlas.tournament("chess-fall-classic-2026")!;
    const seen = new Set<string>();
    for (const m of atlas.stageMatches(t.stages[0]!)) {
      const key = m.sides
        .map((s) => s.competitorId ?? "")
        .sort((a, b) => a.localeCompare(b))
        .join("|");
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(28);
    const standings = roundRobinStandings(atlas, t.stages[0]!, t.participantIds);
    expect(standings.reduce((sum, s) => sum + s.points, 0)).toBe(
      atlas.stageMatches(t.stages[0]!).filter((m) => m.status === "finished").length,
    );
  });

  test("something is live at the sample instant", () => {
    expect(atlas.live().length).toBeGreaterThan(0);
    for (const m of atlas.live()) expect(winnerOf(m)).toBeUndefined();
  });
});
