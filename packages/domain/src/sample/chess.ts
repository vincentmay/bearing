import type { Match, Player, Round, Tournament } from "../model.ts";
import { SAMPLE_GAMES, type SampleGame } from "./games.ts";
import { SAMPLE_PROVENANCE, cet, pick, rng, type Rand } from "./kit.ts";

const p = (
  id: string,
  handle: string,
  name: string,
  country: string,
  rating: number,
  born: string,
): Player => ({
  kind: "player",
  id: `chess-${id}`,
  discipline: "chess",
  handle,
  name,
  country,
  born,
  title: "GM",
  rating: { system: "FIDE classical", value: rating },
});

/** Ratings are illustrative, not a FIDE list. */
export const chessPlayers: Player[] = [
  p("carlsen", "Carlsen", "Magnus Carlsen", "NO", 2833, "1990-11-30"),
  p("gukesh", "Gukesh", "Gukesh Dommaraju", "IN", 2777, "2006-05-29"),
  p("caruana", "Caruana", "Fabiano Caruana", "US", 2795, "1992-07-30"),
  p("nakamura", "Nakamura", "Hikaru Nakamura", "US", 2804, "1987-12-09"),
  p("firouzja", "Firouzja", "Alireza Firouzja", "FR", 2760, "2003-06-18"),
  p("pragg", "Praggnanandhaa", "Praggnanandhaa Rameshbabu", "IN", 2782, "2005-08-10"),
  p("abdusattorov", "Abdusattorov", "Nodirbek Abdusattorov", "UZ", 2768, "2004-09-18"),
  p("weiyi", "Wei Yi", "Wei Yi", "CN", 2754, "1999-06-02"),
];

/** Positions for the boards still in play in round 6. Illustrative, not from real games. */
const LIVE: Record<
  number,
  { opening: string; fen: string; clocks: string[]; eval: number; lastMove: string }
> = {
  0: {
    opening: "Catalan, Open",
    fen: "2r2rk1/1b2qppp/p3pn2/1p6/3P4/P3PNP1/1Q3PBP/2RR2K1 w - - 2 27",
    clocks: ["0:41:12", "0:23:47"],
    eval: 0.4,
    lastMove: "Rac8",
  },
  1: {
    opening: "English, Four Knights",
    fen: "3r2k1/pp3pp1/2p1b2p/4P3/2P2P2/1PN3P1/P5KP/3R4 b - - 0 31",
    clocks: ["0:18:05", "0:31:50"],
    eval: 0.2,
    lastMove: "Kg2",
  },
  3: {
    opening: "Italian Game, Giuoco Pianissimo",
    fen: "6k1/5pp1/p2q3p/1p1p4/3P1Q2/P5P1/1P3P1P/6K1 w - - 0 34",
    clocks: ["0:09:31", "0:12:58"],
    eval: 0.0,
    lastMove: "Qd6",
  },
};

/** Berger table: round-robin pairings with alternating colours. */
function berger(n: number): [number, number][][] {
  const rounds: [number, number][][] = [];
  const last = n - 1;
  for (let r = 0; r < n - 1; r++) {
    const pairs: [number, number][] = [];
    pairs.push(r % 2 === 0 ? [r, last] : [last, r]);
    for (let i = 1; i < n / 2; i++) {
      const a = (r + i) % (n - 1);
      const b = (r - i + (n - 1)) % (n - 1);
      pairs.push(i % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
  }
  return rounds;
}

function play(r: Rand, white: Player, black: Player) {
  const diff = (white.rating!.value - black.rating!.value + 35) / 400;
  const expected = 1 / (1 + 10 ** -diff);
  const drawRate = 0.58;
  const roll = r();
  if (roll < drawRate) return "draw" as const;
  return r() < expected ? (0 as const) : (1 as const);
}

/** A game from the shelf that ended the way this one is said to have ended. */
function gameFor(r: Rand, result: 0 | 1 | "draw"): SampleGame {
  const wanted = result === "draw" ? 0.5 : result === 0 ? 1 : 0;
  return pick(
    r,
    SAMPLE_GAMES.filter((g) => g.result === wanted),
  );
}

/** The games being played in round 6, by board, and how far each has got. */
const ON_THE_BOARDS: Record<number, { game: SampleGame; move: number }> = {
  0: { game: SAMPLE_GAMES.find((g) => g.opening === "Grünfeld Defence")!, move: 27 },
  1: { game: SAMPLE_GAMES.find((g) => g.opening === "Petroff Defence")!, move: 12 },
  3: { game: SAMPLE_GAMES.find((g) => g.opening === "Evans Gambit")!, move: 15 },
};
const QUICK_DRAW = SAMPLE_GAMES.find((g) => g.opening === "Berlin Defence")!;

export function buildChess() {
  const r = rng(20261110);
  const tid = "chess-fall-classic-2026";
  const ids = chessPlayers.map((x) => x.id);
  const schedule = berger(ids.length);
  const matches: Match[] = [];
  const rounds: Round[] = [];
  schedule.forEach((pairs, ri) => {
    const date = `2026-11-${String(10 + ri).padStart(2, "0")}`;
    const at = cet(date, "19:00");
    const round: Round = {
      id: `rr-r${ri + 1}`,
      name: `Round ${ri + 1}`,
      short: `R${ri + 1}`,
      matchIds: [],
    };
    pairs.forEach(([w, b], gi) => {
      const white = chessPlayers[w]!;
      const black = chessPlayers[b]!;
      const id = `${tid}-r${ri + 1}-b${gi + 1}`;
      let match: Match;
      if (ri < 5) {
        const result = play(r, white, black);
        const played = gameFor(r, result);
        match = {
          id,
          tournamentId: tid,
          stageId: "round-robin",
          roundId: round.id,
          scheduledAt: at,
          bestOf: 1,
          status: "finished",
          sides: [{ competitorId: white.id }, { competitorId: black.id }],
          games: [
            {
              label: `Board ${gi + 1}`,
              status: "finished",
              firstSide: 0,
              winner: result,
              scores: result === "draw" ? [0.5, 0.5] : result === 0 ? [1, 0] : [0, 1],
              detail: `${played.opening} · ${Math.ceil(played.moves.length / 2)} moves`,
              moves: played.moves,
            },
          ],
        };
      } else if (ri === 5) {
        // Round 6 is in progress: one quick draw, three games still being played.
        const done = gi === 2;
        const on = ON_THE_BOARDS[gi];
        const move = on?.move ?? 22;
        match = {
          id,
          tournamentId: tid,
          stageId: "round-robin",
          roundId: round.id,
          scheduledAt: at,
          bestOf: 1,
          status: done ? "finished" : "live",
          sides: [{ competitorId: white.id }, { competitorId: black.id }],
          games: [
            done
              ? {
                  label: `Board ${gi + 1}`,
                  status: "finished",
                  firstSide: 0,
                  winner: "draw",
                  scores: [0.5, 0.5],
                  detail: `${QUICK_DRAW.opening} · ${Math.ceil(QUICK_DRAW.moves.length / 2)} moves`,
                  moves: QUICK_DRAW.moves,
                }
              : {
                  label: `Board ${gi + 1}`,
                  status: "live",
                  firstSide: 0,
                  detail: `${on!.game.opening} · move ${move}`,
                  chess: { fen: "", move, clocks: LIVE[gi]!.clocks },
                  // White has just made move number `move`.
                  moves: on!.game.moves.slice(0, move * 2 - 1),
                },
          ],
          stream: { label: "Commentary", url: "#" },
        };
      } else {
        match = {
          id,
          tournamentId: tid,
          stageId: "round-robin",
          roundId: round.id,
          scheduledAt: at,
          bestOf: 1,
          status: "scheduled",
          sides: [{ competitorId: white.id }, { competitorId: black.id }],
          games: [{ label: `Board ${gi + 1}`, status: "scheduled", firstSide: 0 }],
          stream: { label: "Commentary", url: "#" },
        };
      }
      matches.push(match);
      round.matchIds.push(id);
    });
    rounds.push(round);
  });

  const tournament: Tournament = {
    id: tid,
    discipline: "chess",
    name: "Fall Classic 2026",
    short: "Fall Classic",
    tier: "S",
    organizer: "Sample Chess Club",
    location: { city: "St. Louis", country: "US", venue: "Chess Club" },
    start: "2026-11-10",
    end: "2026-11-16",
    prize: { amount: 350_000, currency: "USD" },
    colors: { primary: "#e9e1cf", secondary: "#16120d" },
    participantIds: ids,
    provenance: SAMPLE_PROVENANCE,
    stages: [
      {
        id: "round-robin",
        name: "Round robin",
        format: "round-robin",
        start: "2026-11-10",
        end: "2026-11-16",
        explainer:
          "Eight players each play everyone once: seven rounds of classical chess. A win is one point, a draw half. Ties are split by Sonneborn–Berger, which rewards points taken from stronger finishers.",
        rounds,
      },
    ],
  };
  return { tournament, matches };
}
