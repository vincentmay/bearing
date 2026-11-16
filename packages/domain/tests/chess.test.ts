import { describe, expect, it } from "vite-plus/test";
import { CHESS_START, MATE, annotatedPgn, movesOfPgn, replayChess } from "../src/chess.ts";
import { SAMPLE_GAMES } from "../src/sample/games.ts";

describe("following a game of chess", () => {
  it("makes the first moves", () => {
    const [e4, e5, nf3] = replayChess(["e4", "e5", "Nf3"]);
    expect(e4?.squares.slice(32, 40)).toBe("....P...");
    expect(e5?.squares.slice(24, 32)).toBe("....p...");
    expect(nf3?.from).toBe(62);
    expect(nf3?.to).toBe(45);
  });

  it("castles, takes in passing and promotes", () => {
    const castled = replayChess(["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O"]).at(-1);
    expect(castled?.squares.slice(56)).toBe("RNBQ.RK.");
    const passing = replayChess(["e4", "a6", "e5", "d5", "exd6"]).at(-1);
    // The pawn that was passed is gone from d5, and the taker stands on d6.
    expect(passing?.squares[27]).toBe(".");
    expect(passing?.squares[19]).toBe("P");
    const queened = replayChess(["a4", "b5", "axb5", "a6", "bxa6", "Bb7", "axb7", "Nc6", "bxa8=Q"]);
    expect(queened.at(-1)?.squares[0]).toBe("Q");
  });

  it("tells two pieces apart by the one that may move", () => {
    // Both knights could go to d2; the one on f3 is pinned to nothing, the note says which.
    const plies = replayChess(["Nf3", "d5", "Nc3", "d4", "Nb1", "d3", "Nbd2"]);
    expect(plies).toHaveLength(7);
    expect(plies.at(-1)?.from).toBe(57);
  });

  it("stops at a move it cannot make sense of", () => {
    expect(replayChess(["e4", "e5", "Ke3", "Nf6"])).toHaveLength(2);
  });

  it("plays every game of the sample to its end", () => {
    for (const game of SAMPLE_GAMES) {
      const plies = replayChess(game.moves);
      expect(plies.length, `${game.opening}: stopped at ${game.moves[plies.length]}`).toBe(
        game.moves.length,
      );
    }
  });

  it("starts from the usual position", () => {
    expect(CHESS_START).toHaveLength(64);
  });

  it("reads the moves out of a written game", () => {
    const pgn = `[Event "Test"]
[White "A"]

1. e4 {best by test} e5 2. Nf3 (2. f4 exf4 (2... d5)) 2... Nc6 $1 3. Bb5 a6 1/2-1/2`;
    expect(movesOfPgn(pgn)).toEqual(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"]);
  });
});

describe("a round of written games from Lichess", () => {
  it("gives each game its moves and its opening, by game id", async () => {
    const { gamesOfPgn } = await import("../src/sources/lichess.ts");
    const pgn = `[Event "Round 1: A - B"]
[Opening "Ruy Lopez"]
[GameURL "https://lichess.org/broadcast/some-event/round-1/rrrrrrrr/gameAAAA"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 1/2-1/2


[Event "Round 1: C - D"]
[Opening "?"]
[GameURL "https://lichess.org/broadcast/some-event/round-1/rrrrrrrr/gameBBBB"]

 *
`;
    const games = gamesOfPgn(pgn);
    expect(games.gameAAAA).toEqual({
      moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"],
      opening: "Ruy Lopez",
    });
    expect(games.gameBBBB).toEqual({ moves: [], opening: undefined });
  });

  it("the notes beside the moves are read: the engine's judgement and the clocks", () => {
    const pgn = `[Event "A game"]
[Result "1-0"]

1. d4 { [%eval 0.15] [%clk 1:30:10] } 1... d5 { [%eval 0.27] [%clk 1:30:55] } (1... Nf6 2. c4)
2. c4 { [%eval #3] [%clk 0:00:38] } 2... e6 { [%eval #-2] } 1-0`;
    const read = annotatedPgn(pgn);
    expect(read.moves).toEqual(["d4", "d5", "c4", "e6"]);
    expect(read.evals).toEqual([0.15, 0.27, MATE - 3, -(MATE - 2)]);
    expect(read.clocks).toEqual([5410, 5455, 38, -1]);
    // A game without notes has its moves and nothing else.
    expect(annotatedPgn("1. e4 e5 2. Nf3 *")).toEqual({
      moves: ["e4", "e5", "Nf3"],
      evals: [],
      clocks: [-1, -1, -1],
    });
    // Judgements that stop part of the way are kept as far as they go, never with a hole.
    expect(annotatedPgn("1. e4 { [%eval 0.2] } e5 2. Nf3 { [%eval 0.3] } *").evals).toEqual([0.2]);
  });
});
