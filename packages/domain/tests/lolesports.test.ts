import { readFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import {
  type LolDetails,
  type LolEvent,
  type LolFrame,
  between,
  blueSide,
  findEvent,
  lookTimes,
  playersOf,
  readGame,
  sameTeam,
  stateOf,
} from "../src/sources/lolesports.ts";

/** Game one of the 2026 Worlds final, looked at once a minute, as the feed answered on 2026-11-16. */
const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/lolesports-game.json", import.meta.url), "utf8"),
) as { event: LolEvent; details: LolDetails; game: { number: number }; frames: LolFrame[] };

// The match as Bearing knows it from PandaScore: other spellings of the same two teams.
const sides = [
  { name: "Bilibili Gaming", short: "BLG" },
  { name: "Gen.G", short: "GEN" },
];

describe("League of Legends, inside a game", () => {
  test("a team is recognised by its short name or by its name", () => {
    expect(sameTeam({ name: "Gen.G Esports", code: "GEN" }, { name: "Gen.G", short: "GEN" })).toBe(
      true,
    );
    expect(
      sameTeam(
        { name: "BILIBILI GAMING", code: "BLG" },
        { name: "Bilibili Gaming", short: "BILI" },
      ),
    ).toBe(true);
    expect(sameTeam({ name: "T1", code: "T1" }, { name: "Gen.G", short: "GEN" })).toBe(false);
  });

  test("a match is found by its two teams and its time, in either order", () => {
    expect(findEvent([fixture.event], sides, fixture.event.startTime)).toBe(fixture.event);
    const later = new Date(Date.parse(fixture.event.startTime) + 5 * 3600_000).toISOString();
    expect(findEvent([fixture.event], sides, later)).toBeUndefined();
    expect(
      findEvent([fixture.event], [sides[0]!, { name: "T1", short: "T1" }], fixture.event.startTime),
    ).toBeUndefined();
  });

  test("the side on blue is told by the match's own order of teams", () => {
    // Gen.G was on blue, and Gen.G is the second side of the match as Bearing has it.
    expect(blueSide(fixture.details, fixture.game.number, sides)).toBe(1);
    expect(blueSide(fixture.details, 99, sides)).toBeUndefined();
  });

  test("a game read from its frames has its clock, its kills and its totals", () => {
    const game = readGame(fixture.frames, 1)!;
    const last = fixture.frames.at(-1)!;
    expect(game.firstSide).toBe(1);
    expect(game.scores).toEqual([last.redTeam.totalKills, last.blueTeam.totalKills]);
    expect(game.objectives!.towers).toEqual([last.redTeam.towers, last.blueTeam.towers]);
    expect(game.objectives!.barons).toEqual([last.redTeam.barons, last.blueTeam.barons]);
    expect(game.clock).toBeGreaterThan(30 * 60);
    expect(game.clock).toBeLessThan(45 * 60);
  });

  test("every objective is on the clock once, in order, on the side that took it", () => {
    const game = readGame(fixture.frames, 1)!;
    const count = (kind: string, side: number) =>
      game.events!.filter((e) => e.kind === kind && e.side === side).length;
    for (const side of [0, 1]) {
      expect(count("tower", side)).toBe(game.objectives!.towers[side]);
      expect(count("dragon", side)).toBe(game.objectives!.dragons[side]);
      expect(count("baron", side)).toBe(game.objectives!.barons[side]);
    }
    const times = game.events!.map((e) => e.at);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(Math.max(...times)).toBeLessThanOrEqual(game.clock!);
  });

  test("between two looks, only what changed is new", () => {
    const start = Date.parse(fixture.frames[0]!.rfc460Timestamp);
    const a = stateOf(fixture.frames[20]!, start, 0);
    const b = stateOf(fixture.frames[26]!, start, 0);
    const gained = between(a, b);
    const towers = b.towers[0]! + b.towers[1]! - a.towers[0]! - a.towers[1]!;
    expect(gained.filter((e) => e.kind === "tower")).toHaveLength(towers);
    expect(between(b, b)).toEqual([]);
    for (const e of gained) expect(e.at).toBe(Math.round((a.clock + b.clock) / 2));
  });

  test("a game is looked at once a minute, on the feed's ten-second marks", () => {
    const start = Date.UTC(2026, 10, 14, 19, 53, 15);
    const times = lookTimes(start, start + 5 * 60_000);
    expect(times).toHaveLength(5);
    for (const t of times) expect(Date.parse(t) % 10_000).toBe(0);
  });

  test("the players of a moment are read by name, on the match's own sides", () => {
    const team = (first: number) => ({
      totalGold: 0,
      totalKills: 0,
      towers: 0,
      barons: 0,
      dragons: [],
      participants: [
        { participantId: first, totalGold: 4321, kills: 2, deaths: 1, assists: 3, creepScore: 88 },
      ],
    });
    const frame = {
      rfc460Timestamp: "2026-11-14T20:00:00Z",
      gameState: "in_game",
      blueTeam: team(1),
      redTeam: team(6),
    };
    const meta = {
      patchVersion: "16.20.826.3891",
      blueTeamMetadata: {
        participantMetadata: [
          { participantId: 1, summonerName: "GEN Kiin", championId: "LeeSin", role: "top" },
        ],
      },
      redTeamMetadata: {
        participantMetadata: [
          { participantId: 6, summonerName: "BLG Bin", championId: "MonkeyKing", role: "bottom" },
        ],
      },
    };
    // Blue is the match's second side.
    const read = playersOf(frame, meta, 1);
    expect(read.lines).toEqual([
      {
        playerId: "",
        handle: "Kiin",
        side: 1,
        kills: 2,
        deaths: 1,
        assists: 3,
        role: "Top",
        gold: 4321,
        champion: "Lee Sin",
        cs: 88,
      },
      {
        playerId: "",
        handle: "Bin",
        side: 0,
        kills: 2,
        deaths: 1,
        assists: 3,
        role: "Bot",
        gold: 4321,
        champion: "Wukong",
        cs: 88,
      },
    ]);
    expect(read.draft).toEqual({
      patch: "16.20.1",
      picks: [[{ name: "Wukong", key: "MonkeyKing" }], [{ name: "Lee Sin", key: "LeeSin" }]],
      bans: [[], []],
    });
    expect(playersOf(frame, undefined, 0)).toEqual({});
  });
});
