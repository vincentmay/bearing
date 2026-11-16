import { readFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import { Atlas, seriesScore } from "../src/index.ts";
import { type LichessBroadcast, mapBroadcast, roundsToFetch } from "../src/sources/lichess.ts";

/** A real broadcast and one of its rounds, as Lichess answered on 2026-11-16. */
const source = JSON.parse(
  readFileSync(new URL("./fixtures/lichess-broadcast.json", import.meta.url), "utf8"),
) as LichessBroadcast;
const now = Date.UTC(2026, 10, 16, 9, 0);
const mapped = mapBroadcast(source, now);

describe("Lichess broadcasts", () => {
  test("a broadcast becomes one chess tournament that says where it came from", () => {
    const t = mapped.tournament;
    expect(t.id).toBe(`lichess-${source.tour.id}`);
    expect(t.discipline).toBe("chess");
    expect(t.provenance.source).toBe("Lichess broadcasts");
    expect(t.provenance.note).toBe(source.tour.url);
    expect(t.stages[0]!.rounds).toHaveLength(source.rounds.length);
    // What the broadcast does not say is not made up.
    expect(t.organizer).toBe("");
    expect(t.prize).toBeUndefined();
  });

  test("every game of a fetched round is a match between two known players", () => {
    const games = Object.values(source.games).flat();
    expect(mapped.matches).toHaveLength(games.length);
    const world = {
      now: new Date(now).toISOString(),
      disciplines: [],
      organizations: [],
      competitors: mapped.competitors,
      stints: [],
      tournaments: [mapped.tournament],
      matches: mapped.matches,
      follows: [],
      rankings: [],
    };
    const atlas = new Atlas(world);
    for (const m of mapped.matches) {
      for (const side of m.sides) expect(atlas.competitor(side.competitorId), m.id).toBeDefined();
      expect(atlas.roundOf(m)?.matchIds).toContain(m.id);
    }
  });

  test("results are read as they stand: a win, a draw, or still being played", () => {
    const byId = new Map(mapped.matches.map((m) => [m.id, m]));
    for (const game of Object.values(source.games).flat()) {
      const m = byId.get(`lichess-${game.id}`)!;
      const score = seriesScore(m);
      if (game.status === "1-0") expect(score).toEqual([1, 0]);
      else if (game.status === "0-1") expect(score).toEqual([0, 1]);
      else if (game.status === "*") expect(m.status).not.toBe("finished");
      else expect(score).toEqual([0.5, 0.5]);
    }
  });

  test("a round that was not fetched has no pairings, and none are invented", () => {
    const fetched = new Set(Object.keys(source.games).map((id) => `lichess-${id}`));
    for (const round of mapped.tournament.stages[0]!.rounds) {
      if (!fetched.has(round.id)) expect(round.matchIds).toEqual([]);
    }
  });

  test("the rounds worth fetching include the one being played", () => {
    const picked = roundsToFetch(source.rounds);
    for (const r of source.rounds.filter((x) => x.ongoing)) expect(picked).toContain(r);
    expect(picked.length).toBeLessThanOrEqual(4);
  });
});
