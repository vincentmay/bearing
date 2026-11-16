import { describe, expect, test } from "vite-plus/test";
import { Atlas, playerTotals } from "../src/index.ts";
import { buildSampleWorld } from "../src/sample/index.ts";

const world = buildSampleWorld();
const atlas = new Atlas(world);

describe("enriched sample", () => {
  test("every team has a current roster", () => {
    for (const c of world.competitors) {
      if (c.kind !== "team") continue;
      const size = atlas.roster(c.id).filter((r) => r.stint.role !== "Coach").length;
      expect(size, c.id).toBeGreaterThanOrEqual(c.discipline === "rocket-league" ? 3 : 5);
    }
  });

  test("CS2 round histories add up to each map score", () => {
    for (const m of world.matches.filter((x) => x.tournamentId.startsWith("cs2-"))) {
      for (const g of m.games) {
        if (!g.rounds || !g.scores) continue;
        expect(g.rounds.filter((r) => r.winner === 0).length, `${m.id} ${g.label}`).toBe(
          g.scores[0],
        );
        expect(g.rounds.filter((r) => r.winner === 1).length, `${m.id} ${g.label}`).toBe(
          g.scores[1],
        );
        if (g.status === "finished") expect(g.rounds.at(-1)!.winner).toBe(g.winner);
      }
    }
  });

  test("player kills on a map equal the opponent's deaths", () => {
    for (const m of world.matches) {
      for (const g of m.games) {
        if (!g.lines || !g.rounds) continue;
        const k0 = g.lines.filter((l) => l.side === 0).reduce((s, l) => s + l.kills, 0);
        const d1 = g.lines.filter((l) => l.side === 1).reduce((s, l) => s + l.deaths, 0);
        expect(Math.abs(k0 - d1), `${m.id} ${g.label}`).toBeLessThanOrEqual(2);
      }
    }
  });

  test("a player who changed teams is one person with two stints", () => {
    expect(world.competitors.filter((c) => c.id === "cs2-spinx")).toHaveLength(1);
    expect(
      world.stints
        .filter((s) => s.playerId === "cs2-spinx")
        .map((s) => s.teamId)
        .sort(),
    ).toEqual(["cs2-mouz", "cs2-vitality"]);
  });

  test("ZywOo has stats across the event", () => {
    const totals = playerTotals(atlas.matchesFor("cs2-vitality"), "cs2-zywoo");
    expect(totals?.games).toBeGreaterThan(5);
    expect(totals?.rating).toBeGreaterThan(0.9);
  });

  test("prize bands sum to the advertised prize pool", () => {
    for (const t of world.tournaments) {
      if (!t.placements || !t.prize || t.stages.length === 0) continue;
      const sum = t.placements.reduce((s, p) => {
        const [lo, hi] = p.place.match(/\d+/g)!.map(Number);
        const count = hi ? hi - lo! + 1 : 1;
        return s + (p.prize ?? 0) * count;
      }, 0);
      expect(sum, t.id).toBe(t.prize.amount);
    }
  });
});
