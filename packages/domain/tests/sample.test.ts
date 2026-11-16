import { describe, expect, test } from "vite-plus/test";
import { Atlas, roundRobinStandings, seriesScore, swissRecords, winnerOf } from "../src/index.ts";
import { advance, buildSampleWorld, rng } from "../src/sample/index.ts";

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

describe("playing the sample forward", () => {
  test("the sample has a live match in every game", () => {
    const live = new Set(atlas.live().map((m) => atlas.tournamentOf(m).discipline));
    expect([...live].sort()).toEqual(["chess", "cs2", "lol", "rocket-league", "trackmania"]);
  });

  test("timed events add up to the score they explain", () => {
    for (const m of world.matches) {
      const d = atlas.tournamentOf(m).discipline;
      for (const g of m.games) {
        if (d === "rocket-league" && g.status !== "scheduled") {
          expect(g.events, `${m.id} ${g.label}`).toBeDefined();
          for (const side of [0, 1])
            expect(g.events!.filter((e) => e.side === side).length).toBe(g.scores![side]);
        }
        if (d === "lol" && g.status === "finished") {
          expect(g.events!.filter((e) => e.kind === "tower").length).toBe(
            g.objectives!.towers[0]! + g.objectives!.towers[1]!,
          );
          for (const e of g.events!) expect(e.at).toBeLessThanOrEqual(g.clock!);
        }
        if (g.cup?.rounds) {
          expect(g.cup.rounds.length).toBe(g.cup.round - (g.status === "live" ? 1 : 0));
        }
      }
    }
  });

  test("a world that is played forward stays whole, and every live match ends", () => {
    const r = rng(7);
    const now = Date.parse(world.now);
    let w = world;
    for (let step = 0; step < 4000; step++) {
      const next = advance(w, r, now);
      if (step % 50 === 0 || next === w) {
        const a = new Atlas(next);
        for (const m of next.matches) {
          for (const g of m.games) {
            if (g.rounds && g.scores) {
              expect(g.rounds.filter((x) => x.winner === 0).length).toBe(g.scores[0]);
              expect(g.rounds.filter((x) => x.winner === 1).length).toBe(g.scores[1]);
            }
            if (g.status === "finished" && a.tournamentOf(m).discipline === "rocket-league")
              expect(g.scores![0]).not.toBe(g.scores![1]);
          }
          if (m.status === "finished" && m.bestOf > 1)
            expect(Math.max(...seriesScore(m)), m.id).toBe(Math.ceil(m.bestOf / 2));
          expect(m.games.filter((g) => g.status === "live").length).toBeLessThanOrEqual(1);
        }
      }
      w = next;
    }
    expect(w).not.toBe(world);
    expect(w.matches.filter((m) => m.status === "live")).toHaveLength(0);
    // The untouched world is still what it was: playing forward never changes its input.
    expect(new Atlas(world).live().length).toBe(atlas.live().length);
    // The semifinal's winner reached the final, and the cup's top two reached their semifinal.
    const after = new Atlas(w);
    const final = after.match("cs2-copenhagen-masters-2026-po-final")!;
    expect(final.sides.every((s) => s.competitorId)).toBe(true);
    const semi = after.match("tm-cup-finals-2026-sf-A")!;
    expect(semi.sides.slice(0, 2).every((s) => s.competitorId)).toBe(true);
    // An event that has been played to the end knows who won it, and its prize bands still add up.
    const open = after.tournament("rl-winter-open-2026")!;
    expect(open.placements!.find((p) => p.rank === 1)!.competitorIds).toHaveLength(1);
    expect(open.placements!.find((p) => p.rank === 2)!.competitorIds).toHaveLength(1);
    expect(open.placements!.find((p) => p.rank === 3)!.competitorIds).toHaveLength(2);
    const classic = after.tournament("chess-fall-classic-2026")!;
    expect(classic.placements!.every((p) => p.competitorIds.length <= 1)).toBe(true);
  });
});
