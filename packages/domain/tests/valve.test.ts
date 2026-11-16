import { describe, expect, test } from "vite-plus/test";
import { globalStandings, likelyStandings, readStandings } from "../src/sources/valve.ts";

// The head of the worldwide standings as Valve's repository had them on 2026-11-16.
const TABLE = `### Standings as of 2026_11_02<br />
<br />

| Standing | Points | Team Name            | Roster                                               |                                    |
| :- | -: | :- | :- | :- |
| 1        |   1960 | MOUZ                 | PR, Spinx, torzsi, xelex, xertioN                    | [details](details/2026_11_02/0001--mouz.md) |
| 2        |   1922 | Vitality             | flameZ, jL, mezii, ropz, ZywOo                       | [details](details/2026_11_02/0002--vitality.md) |
`;

describe("Valve's standings", () => {
  test("the rows of the table are read, and nothing else", () => {
    expect(readStandings(TABLE)).toEqual([
      {
        rank: 1,
        points: 1960,
        team: "MOUZ",
        roster: ["PR", "Spinx", "torzsi", "xelex", "xertioN"],
      },
      {
        rank: 2,
        points: 1922,
        team: "Vitality",
        roster: ["flameZ", "jL", "mezii", "ropz", "ZywOo"],
      },
    ]);
    expect(readStandings("not a table")).toEqual([]);
  });

  test("the likely days of a ranking are the first Mondays, latest first", () => {
    const likely = likelyStandings(Date.UTC(2026, 10, 16), 3);
    expect(likely.map((l) => l.file)).toEqual([
      "standings_global_2026_11_02.md",
      "standings_global_2026_10_05.md",
      "standings_global_2026_09_07.md",
    ]);
    // On the first of a month that begins on a Tuesday, this month's Monday is still to come.
    expect(likelyStandings(Date.UTC(2026, 11, 1), 2).map((l) => l.date)).toEqual(["2026-11-02"]);
  });

  test("the worldwide standings are found among a folder's files, oldest first", () => {
    const listing = [
      { name: "standings_global_2026_11_02.md" },
      { name: "standings_europe_2026_11_02.md" },
      { name: "details" },
      { name: "standings_global_2026_10_05.md" },
    ];
    expect(globalStandings(listing)).toEqual([
      { file: "standings_global_2026_10_05.md", date: "2026-10-05" },
      { file: "standings_global_2026_11_02.md", date: "2026-11-02" },
    ]);
    expect(globalStandings({ message: "rate limited" })).toEqual([]);
  });
});
