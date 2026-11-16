import type { GameResult, Match, Tournament } from "../model.ts";
import { MAP_POOL, mapScore } from "./cs2.ts";
import { cet, rng, shuffle, type Rand } from "./kit.ts";
import { gameScore } from "./lol.ts";
import { rlGame } from "./rocket-league.ts";

/**
 * The events that are over were only a name and a list of who finished where. Here each of them
 * gets the bracket that led to that list: quarterfinals, semifinals and a final, played out game
 * by game, so that a team has a record to look back on and an old event has something to show.
 * Nothing is invented against what is already said: who finished where decides who beat whom,
 * and a final whose score is told in words is played to that score.
 */
const FINALS: Record<string, { bestOf: number; score: [number, number] }> = {
  "cs2-autumn-showdown-2026": { bestOf: 5, score: [3, 2] },
  "cs2-summer-clash-2026": { bestOf: 5, score: [3, 1] },
  "lol-summer-showdown-2026": { bestOf: 5, score: [3, 1] },
  "rl-spring-major-2026": { bestOf: 7, score: [4, 2] },
};

/** The day `back` days before a date, as a date. */
function before(date: string, back: number): string {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - back);
  return day.toISOString().slice(0, 10);
}

/** The games of a series that ended `won`–`lost` for side `winner`, in an order that fits. */
function gamesOf(
  r: Rand,
  discipline: Tournament["discipline"],
  winner: number,
  [won, lost]: [number, number],
): GameResult[] {
  // The loser's games fall anywhere but last.
  const order = [
    ...shuffle(r, [
      ...Array.from({ length: won - 1 }, () => winner),
      ...Array.from({ length: lost }, () => 1 - winner),
    ]),
    winner,
  ];
  const maps = shuffle(r, MAP_POOL);
  return order.map((w, i): GameResult => {
    if (discipline === "rocket-league") return rlGame(r, `Game ${i + 1}`, w);
    const label = discipline === "cs2" ? (maps[i] ?? `Map ${i + 1}`) : `Game ${i + 1}`;
    const { scores, detail } = discipline === "cs2" ? mapScore(r, w) : gameScore(r, w);
    return { label, status: "finished", winner: w, scores, detail };
  });
}

/** Give every finished team event its bracket; returns the matches and fills in the events. */
export function playHistory(events: Tournament[]): Match[] {
  const matches: Match[] = [];
  for (const t of events) {
    const final = FINALS[t.id];
    const [first, second, semis, quarters] = (t.placements ?? []).map((p) => p.competitorIds);
    const [a, b] = [first?.[0], second?.[0]];
    if (!final || !a || !b || semis?.length !== 2 || quarters?.length !== 4) continue;
    const r = rng(t.id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 20260000));
    const short = Math.ceil(final.bestOf / 2) - (final.bestOf === 7 ? 0 : 1);
    const early = final.bestOf === 7 ? 7 : 3;
    const id = (round: string, n: number) => `${t.id}-${round}${n}`;
    const play = (
      matchId: string,
      roundId: string,
      at: string,
      winner: string,
      loser: string,
      bestOf: number,
      score: [number, number],
      next?: string,
    ) => {
      // Who is named first is left to chance, so the winner is not always on the left.
      const flip = r() < 0.5;
      matches.push({
        id: matchId,
        tournamentId: t.id,
        stageId: "playoffs",
        roundId,
        scheduledAt: at,
        bestOf,
        status: "finished",
        sides: (flip ? [loser, winner] : [winner, loser]).map((c) => ({ competitorId: c })),
        games: gamesOf(r, t.discipline, flip ? 1 : 0, score),
        next: next ? { winner: next } : undefined,
      });
    };
    const any = (): [number, number] => [short, Math.floor(r() * short)];
    const qf = before(t.end, 2);
    const sf = before(t.end, 1);
    // The top half leads to the winner, the bottom half to the runner-up.
    play(id("qf", 1), "po-qf", cet(qf, "14:00"), a, quarters[0]!, early, any(), id("sf", 1));
    play(
      id("qf", 2),
      "po-qf",
      cet(qf, "17:00"),
      semis[0]!,
      quarters[1]!,
      early,
      any(),
      id("sf", 1),
    );
    play(id("qf", 3), "po-qf", cet(qf, "20:00"), b, quarters[2]!, early, any(), id("sf", 2));
    play(
      id("qf", 4),
      "po-qf",
      cet(qf, "23:00"),
      semis[1]!,
      quarters[3]!,
      early,
      any(),
      id("sf", 2),
    );
    play(id("sf", 1), "po-sf", cet(sf, "16:00"), a, semis[0]!, early, any(), id("final", 1));
    play(id("sf", 2), "po-sf", cet(sf, "20:00"), b, semis[1]!, early, any(), id("final", 1));
    play(id("final", 1), "po-final", cet(t.end, "18:00"), a, b, final.bestOf, final.score);

    t.participantIds = [a, b, ...semis, ...quarters];
    t.stages = [
      {
        id: "playoffs",
        name: "Playoffs",
        format: "single-elim",
        start: qf,
        end: t.end,
        explainer: `Eight teams, single elimination. Every series is best-of-${early === 7 ? "seven" : "three"}${
          final.bestOf === early
            ? ""
            : `, the final best-of-${final.bestOf === 5 ? "five" : "seven"}`
        }.`,
        rounds: [
          {
            id: "po-qf",
            name: "Quarterfinals",
            short: "QF",
            matchIds: [1, 2, 3, 4].map((n) => id("qf", n)),
          },
          { id: "po-sf", name: "Semifinals", short: "SF", matchIds: [id("sf", 1), id("sf", 2)] },
          { id: "po-final", name: "Final", short: "F", matchIds: [id("final", 1)] },
        ],
      },
    ];
  }
  return matches;
}
