import { describe, expect, it } from "vite-plus/test";
import { seriesScore } from "../src/derive.ts";
import {
  type LichessBroadcast,
  type LichessGame,
  mapBroadcast,
  playOf,
} from "../src/sources/lichess.ts";

const NOW = Date.parse("2026-11-17T17:00:00Z");
const player = (name: string, fideId: number) => ({ name, fideId, rating: 2700, fed: "NOR" });
const A = player("Alpha, Anna", 1);
const B = player("Beta, Bo", 2);
const C = player("Gamma, Cy", 3);
const D = player("Delta, Di", 4);
const game = (id: string, white: object, black: object, status: string): LichessGame => ({
  id,
  players: [white, black],
  status,
  fen: "8/8/8/8/8/8/8/8 w - - 0 30",
});
const round = (id: string, name: string, at: string, more: object = {}) => ({
  id,
  name,
  url: `https://lichess.org/broadcast/x/${id}`,
  startsAt: Date.parse(at),
  ...more,
});

/** Two matches of several games: A against B, C against D, colours changing each game. */
const matchPlay: LichessBroadcast = {
  tour: { id: "tourX", name: "A Knockout | Semifinals", url: "https://lichess.org/broadcast/x" },
  rounds: [
    round("r1", "Game 1 | Blitz", "2026-11-17T14:00:00Z", { finished: true }),
    round("r2", "Game 2 | Rapid", "2026-11-17T15:00:00Z", {
      finished: true,
      customScoring: { white: { win: 4, draw: 2 }, black: { win: 4, draw: 2 } },
    }),
    round("r3", "Game 3 | Classic", "2026-11-17T16:30:00Z", { ongoing: true }),
    round("r4", "Game 4 | Blitz", "2026-11-18T14:00:00Z"),
    round("r5", "Armageddon", "2026-11-18T19:00:00Z"),
  ],
  games: {
    r1: [game("g1", A, B, "1-0"), game("g2", C, D, "½-½")],
    r2: [game("g3", B, A, "½-½"), game("g4", D, C, "1-0")],
    r3: [game("g5", A, B, "*"), game("g6", C, D, "*")],
  },
};

describe("a broadcast played as matches", () => {
  it("is told from one played in rounds by who meets whom in rounds next to each other", () => {
    expect(playOf(matchPlay)).toBe("fixed");
    const rounds: LichessBroadcast = {
      ...matchPlay,
      games: {
        r1: [game("g1", A, B, "1-0"), game("g2", C, D, "½-½")],
        r2: [game("g3", A, C, "½-½"), game("g4", D, B, "1-0")],
      },
    };
    expect(playOf(rounds)).toBe("games");
    // One round alone cannot tell.
    expect(playOf({ ...matchPlay, games: { r3: matchPlay.games.r3! } })).toBeUndefined();
    expect(mapBroadcast(rounds, NOW).matches).toHaveLength(4);
  });

  it("becomes one match for each two players, with their games in it", () => {
    const mapped = mapBroadcast(matchPlay, NOW);
    expect(mapped.play).toBe("fixed");
    expect(mapped.matches.map((m) => m.id)).toEqual(["lichess-tourX-1-2", "lichess-tourX-3-4"]);
    const [first, second] = mapped.matches;
    expect(first!.games.map((g) => g.label)).toEqual([
      "Game 1 | Blitz",
      "Game 2 | Rapid",
      "Game 3 | Classic",
    ]);
    // Who has White changes from game to game; the sides of the match stay where they are.
    expect(first!.games.map((g) => g.firstSide)).toEqual([0, 1, 0]);
    expect(first!.games.map((g) => g.ref)).toEqual(["r1/g1", "r2/g3", "r3/g5"]);
    // A won the blitz game for one point, and the rapid draw gave each two.
    expect(seriesScore(first!)).toEqual([3, 2]);
    // D won the rapid game with White: four points, on top of the half from the blitz draw.
    expect(seriesScore(second!)).toEqual([0.5, 4.5]);
    expect(first!.status).toBe("live");
    // Every round but the tie-break counts towards the match.
    expect(first!.bestOf).toBe(4);
    expect(mapped.tournament.stages[0]).toMatchObject({
      id: "matches",
      rounds: [{ matchIds: ["lichess-tourX-1-2", "lichess-tourX-3-4"] }],
    });
  });

  it("is still a match when only the round being played was looked at", () => {
    const one = { ...matchPlay, games: { r3: matchPlay.games.r3! } };
    const mapped = mapBroadcast(one, NOW, "fixed");
    expect(mapped.play).toBe("fixed");
    expect(mapped.matches[0]!.id).toBe("lichess-tourX-1-2");
    expect(mapped.matches[0]!.games).toHaveLength(1);
    // Without having been told, one round is a round of games.
    expect(mapBroadcast(one, NOW).matches[0]!.id).toBe("lichess-g5");
  });

  it("waits for the next day between games, and is over when no round is left", () => {
    const evening = {
      ...matchPlay,
      rounds: matchPlay.rounds.map((r) =>
        r.id === "r3" ? { ...r, ongoing: undefined, finished: true } : r,
      ),
      games: { ...matchPlay.games, r3: [game("g5", A, B, "0-1"), game("g6", C, D, "1-0")] },
    };
    const night = mapBroadcast(evening, Date.parse("2026-11-17T20:00:00Z"));
    expect(night.matches[0]!.status).toBe("scheduled");
    expect(night.matches[0]!.scheduledAt).toBe("2026-11-18T14:00:00Z");
    // An hour before the next game it is being played again.
    expect(mapBroadcast(evening, Date.parse("2026-11-18T13:10:00Z")).matches[0]!.status).toBe(
      "live",
    );
    const done = {
      ...evening,
      rounds: evening.rounds.map((r) => ({ ...r, finished: true })),
      games: { ...evening.games, r4: [game("g7", B, A, "½-½"), game("g8", D, C, "½-½")] },
    };
    expect(mapBroadcast(done, Date.parse("2026-11-18T20:00:00Z")).matches[0]!.status).toBe(
      "finished",
    );
  });
});
