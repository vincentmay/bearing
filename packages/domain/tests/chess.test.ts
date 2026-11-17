import { describe, expect, it } from "vite-plus/test";
import {
  CHESS_START,
  CHESS_START_FEN,
  MATE,
  annotatedPgn,
  chessDests,
  chessLine,
  chessMove,
  chessSquare,
  chessTurn,
  movesOfPgn,
  replayChess,
} from "../src/chess.ts";
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
    // Both knights could go to d2; the note says which.
    const plies = replayChess(["d3", "d5", "Nf3", "d4", "Nbd2"]);
    expect(plies).toHaveLength(5);
    expect(plies.at(-1)?.from).toBe(57);
  });

  it("reads past an annotator's marks on a move", () => {
    const plies = replayChess(["e4", "e5?!", "Nf3!", "Nc6??"]);
    expect(plies.map((p) => p.san)).toEqual(["e4", "e5", "Nf3", "Nc6"]);
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

  it("says where the pieces may go, makes a move by its squares, and writes an engine's line", () => {
    // From the start, the king's knight has two squares and the king none.
    const dests = chessDests(CHESS_START_FEN);
    expect(dests.get(62)?.sort()).toEqual([45, 47]);
    expect(dests.has(60)).toBe(false);
    const e4 = chessMove(CHESS_START_FEN, 52, 36);
    expect(e4?.san).toBe("e4");
    expect(chessTurn(e4!.fen)).toBe(1);
    // A move the rules do not allow is not made.
    expect(chessMove(CHESS_START_FEN, 52, 28)).toBeUndefined();
    // Castling is offered as the king going two squares, and is written O-O.
    const ready = replayChess(["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"]).at(-1)!;
    expect(chessDests(ready.fen).get(60)).toContain(62);
    expect(chessMove(ready.fen, 60, 62)?.san).toBe("O-O");
    // A pawn on the last rank becomes a queen unless told otherwise, and mate is seen.
    expect(chessMove("7k/P7/8/8/8/8/8/K7 w - - 0 1", 8, 0)?.san).toBe("a8=Q+");
    expect(chessMove("7k/P7/8/8/8/8/8/K7 w - - 0 1", 8, 0, "n")?.san).toBe("a8=N");
    expect(replayChess(["f3", "e5", "g4", "Qh4#"]).at(-1)?.mate).toBe(true);
    expect(chessLine(CHESS_START_FEN, ["e2e4", "e7e5", "g1f3"]).map((p) => p.san)).toEqual([
      "e4",
      "e5",
      "Nf3",
    ]);
    expect(chessSquare(36)).toBe("e4");
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

describe("when to look at a broadcast again", () => {
  it("is when its next round is due, or soon while rounds follow one another", async () => {
    const { nextLook } = await import("../src/sources/lichess.ts");
    const round = (over: object) => ({ id: "r", name: "R", url: "", ...over });
    const now = 1_000_000;
    // Nothing left to play: never.
    expect(nextLook([round({ finished: true })], now)).toBe(0);
    // A round under way: now.
    expect(nextLook([round({ finished: true }), round({ ongoing: true })], now)).toBe(now);
    // The next round has its time: then.
    expect(nextLook([round({ finished: true }), round({ startsAt: now + 9000 })], now)).toBe(
      now + 9000,
    );
    // The next round follows the last and gives no time: in a few minutes.
    expect(
      nextLook([round({ finished: true }), round({}), round({ startsAt: now + 9_000_000 })], now),
    ).toBe(now + 300_000);
    // Not begun, and no times at all: nothing to wait for.
    expect(nextLook([round({}), round({})], now)).toBe(0);
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
      result: "1/2-1/2",
    });
    expect(games.gameBBBB).toEqual({ moves: [], opening: undefined, result: "*" });
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
