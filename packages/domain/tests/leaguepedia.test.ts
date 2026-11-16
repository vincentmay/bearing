import { readFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import {
  type LpGame,
  type LpPlayer,
  championKeys,
  findGames,
  gamesUrl,
  isTeam,
  playersUrl,
  readGame,
  rowsOf,
} from "../src/sources/leaguepedia.ts";

/** The 2026 Worlds final as Leaguepedia answered on 2026-11-16: four games, and the lines of two. */
const read = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
const games = rowsOf<LpGame>(read("leaguepedia-games"));
const players = rowsOf<LpPlayer>(read("leaguepedia-players"));

// The match as Bearing knows it from PandaScore: its own order of the two teams.
const sides = [
  { name: "Bilibili Gaming", short: "BLG" },
  { name: "Gen.G", short: "GEN" },
];
const rosters = [
  [
    { id: "lol-bin", handle: "Bin" },
    { id: "lol-knight", handle: "knight" },
  ],
  [{ id: "lol-chovy", handle: "Chovy" }],
];
const keys = championKeys({
  data: {
    TwistedFate: { id: "TwistedFate", name: "Twisted Fate" },
    MonkeyKing: { id: "MonkeyKing", name: "Wukong" },
    Gwen: { id: "Gwen", name: "Gwen" },
  },
});

describe("Leaguepedia", () => {
  test("the questions name the fields the answers are read by", () => {
    const url = new URL(gamesUrl(Date.UTC(2026, 10, 14), Date.UTC(2026, 10, 15)));
    expect(url.searchParams.get("tables")).toBe("ScoreboardGames");
    expect(url.searchParams.get("fields")).toContain("N_GameInMatch=n");
    expect(url.searchParams.get("where")).toBe(
      "DateTime_UTC >= '2026-11-14 00:00:00' AND DateTime_UTC <= '2026-11-15 00:00:00'",
    );
    const lines = new URL(playersUrl(["A_1", "Rock'n_2"]));
    expect(lines.searchParams.get("where")).toBe("GameId IN ('A_1','Rock\\'n_2')");
  });

  test("an answer that is not one has no rows", () => {
    expect(rowsOf(null)).toEqual([]);
    expect(rowsOf({ error: { code: "ratelimited" } })).toEqual([]);
  });

  test("a series is found by its two teams and its start", () => {
    expect(games).toHaveLength(4);
    const found = findGames(games, sides, "2026-11-14T20:00:00Z");
    expect(found.map((g) => g.n)).toEqual(["1", "2", "3", "4"]);
    // The same teams on another day are another series.
    expect(findGames(games, sides, "2026-11-12T20:00:00Z")).toEqual([]);
    expect(
      findGames(games, [sides[0]!, { name: "T1", short: "T1" }], "2026-11-14T20:00:00Z"),
    ).toEqual([]);
  });

  test("a game is turned to the match's own sides", () => {
    // Game one: Gen.G on blue, and Gen.G won it 19 kills to 4.
    const one = readGame(games[0]!, players, sides, rosters, { patch: "16.22.1", keys });
    expect(one?.firstSide).toBe(1);
    expect(one?.winner).toBe(1);
    expect(one?.scores).toEqual([4, 19]);
    expect(one?.lines).toHaveLength(10);
    expect(one?.draft?.picks.map((p) => p.length)).toEqual([5, 5]);
    expect(one?.draft?.bans.map((p) => p.length)).toEqual([5, 5]);
    expect(one?.clock).toBe(Math.round(Number(games[0]!.minutes) * 60));

    // Game four: Bilibili Gaming on blue, and they won it.
    const four = readGame(games[3]!, players, sides, rosters, { patch: "16.22.1", keys });
    expect(four?.firstSide).toBe(0);
    expect(four?.winner).toBe(0);
    expect(four?.scores).toEqual([21, 11]);
    expect(four?.objectives?.towers).toEqual([10, 5]);
    expect(four?.draft?.patch).toBe("16.22.1");
    expect(four?.draft?.picks[0]?.map((c) => c.name)).toEqual([
      "Gwen",
      "Nocturne",
      "Twisted Fate",
      "Yunara",
      "Neeko",
    ]);
    // A picture is named where the game's list has the champion, and left out where it has not.
    expect(four?.draft?.picks[0]?.[2]).toEqual({ name: "Twisted Fate", key: "TwistedFate" });
    expect(four?.draft?.picks[0]?.[1]).toEqual({ name: "Nocturne" });

    const bin = four?.lines?.find((l) => l.handle === "Bin");
    expect(bin).toMatchObject({
      playerId: "lol-bin",
      side: 0,
      champion: "Gwen",
      role: "Top",
      kills: 8,
      deaths: 2,
      assists: 9,
      gold: 17652,
      cs: 337,
    });
    // Known whatever the case of the name; a player Bearing does not have keeps the name alone.
    expect(four?.lines?.find((l) => l.handle === "Knight")?.playerId).toBe("lol-knight");
    expect(four?.lines?.find((l) => l.handle === "Ruler")).toMatchObject({ playerId: "", side: 1 });
  });

  test("a team is known under the wiki's spelling of it", () => {
    expect(isTeam("LØS", { name: "LOS", short: "LOS" })).toBe(true);
    expect(isTeam("Berlin International Gaming", { name: "BIG", short: "BIG" })).toBe(true);
    expect(isTeam("Gen.G", { name: "Gen.G", short: "GEN" })).toBe(true);
    expect(isTeam("Gen.G", { name: "T1", short: "T1" })).toBe(false);
    expect(isTeam("Bilibili Gaming", { name: "BIG", short: "BIG" })).toBe(false);
  });

  test("a game of other teams is not read", () => {
    const others = [
      { name: "T1", short: "T1" },
      { name: "G2 Esports", short: "G2" },
    ];
    expect(readGame(games[0]!, players, others, [[], []])).toBeNull();
  });
});
