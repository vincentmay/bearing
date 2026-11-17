import { Chess, castlingSide } from "chessops/chess";
import { INITIAL_FEN, makeFen, parseFen } from "chessops/fen";
import { parseComment, parsePgn } from "chessops/pgn";
import { makeSanAndPlay, parseSan } from "chessops/san";
import type { NormalMove, Role } from "chessops/types";
import { kingCastlesTo, makeSquare, parseUci, roleToChar } from "chessops/util";

/**
 * Chess, as far as Bearing needs it: following a game from its written moves, saying where
 * the pieces may go from a position, making a move, and reading a written game (PGN) with the
 * notes beside its moves.
 *
 * The rules themselves are not Bearing's: they are chessops, the library Lichess is built
 * on. This file is the small surface the rest of Bearing sees, in its own terms.
 *
 * A position is 64 characters, a8 first and h1 last, a letter for a piece (capitals are White)
 * and a dot for an empty square. A square is its place in that text: 0 for a8, 63 for h1.
 */

export interface ChessPly {
  /** The move as written: "Nf3", "exd5", "O-O", "e8=Q+". */
  san: string;
  /** The squares the move left and arrived at, 0 for a8 to 63 for h1. */
  from: number;
  to: number;
  /** The position after the move. */
  squares: string;
  /** The same position in full (FEN): whose move it is, castling, and the rest. */
  fen: string;
  /** Whether the side now to move stands in check, and whether that is mate. */
  check: boolean;
  mate: boolean;
}

export const CHESS_START = "rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR";
export const CHESS_START_FEN: string = INITIAL_FEN;

/** chessops counts squares from a1; Bearing from a8. Turning one into the other flips the rank. */
const flip = (square: number) => square ^ 56;

function squaresOf(pos: Chess): string {
  let text = "";
  for (let i = 0; i < 64; i++) {
    const piece = pos.board.get(flip(i));
    const letter = piece ? roleToChar(piece.role) : ".";
    text += piece?.color === "white" ? letter.toUpperCase() : letter;
  }
  return text;
}

function positionOf(fen?: string): Chess | undefined {
  if (!fen) return Chess.default();
  return parseFen(fen).unwrap(
    (setup) =>
      Chess.fromSetup(setup).unwrap(
        (pos) => pos,
        () => undefined,
      ),
    () => undefined,
  );
}

/** Make a move the position allows, and say what it was. */
function make(pos: Chess, move: NormalMove, written?: string): ChessPly {
  // Castling is known to chessops as the king taking its own rook; shown, the king goes two.
  const side = castlingSide(pos, move);
  const to = side ? kingCastlesTo(pos.turn, side) : move.to;
  const san = makeSanAndPlay(pos, move);
  return {
    san: written ?? san,
    from: flip(move.from),
    to: flip(to),
    squares: squaresOf(pos),
    fen: makeFen(pos.toSetup()),
    check: pos.isCheck(),
    mate: pos.isCheckmate(),
  };
}

/**
 * The position after each move of a game, as far as the moves can be followed; it stops
 * quietly at a move that cannot be made. From the usual starting position unless told.
 */
export function replayChess(moves: readonly string[], fen?: string): ChessPly[] {
  const pos = positionOf(fen);
  const plies: ChessPly[] = [];
  if (!pos) return plies;
  for (const written of moves) {
    // A record may carry an annotator's marks on its moves ("b4?!"); they are not the move.
    const san = written.replace(/[!?]+$/, "");
    const move = parseSan(pos, san);
    if (!move || !("from" in move)) break;
    plies.push(make(pos, move, san));
  }
  return plies;
}

/** Whose move it is in a position: 0 for White, 1 for Black. */
export function chessTurn(fen: string): 0 | 1 {
  return fen.split(" ")[1] === "b" ? 1 : 0;
}

/** Where each piece of the side to move may go: from a square, the squares it can reach. */
export function chessDests(fen: string): Map<number, number[]> {
  const pos = positionOf(fen);
  const out = new Map<number, number[]>();
  if (!pos) return out;
  for (const [from, squares] of pos.allDests()) {
    const reach: number[] = [];
    for (const to of squares) {
      // Castling, the way a hand does it: the king goes two squares, not onto the rook.
      const side = castlingSide(pos, { from, to });
      reach.push(flip(side ? kingCastlesTo(pos.turn, side) : to));
    }
    if (reach.length) out.set(flip(from), [...new Set(reach)]);
  }
  return out;
}

/**
 * Make a move by its squares, if the position allows it. A pawn reaching the last rank
 * becomes a queen unless another piece is named.
 */
export function chessMove(
  fen: string,
  from: number,
  to: number,
  promote: "q" | "r" | "b" | "n" = "q",
): ChessPly | undefined {
  const pos = positionOf(fen);
  if (!pos) return undefined;
  const piece = pos.board.get(flip(from));
  if (!piece) return undefined;
  const last = piece.role === "pawn" && (to < 8 || to >= 56);
  const roles: Record<string, Role> = { q: "queen", r: "rook", b: "bishop", n: "knight" };
  const move: NormalMove = {
    from: flip(from),
    to: flip(to),
    promotion: last ? roles[promote] : undefined,
  };
  return pos.isLegal(move) ? make(pos, move) : undefined;
}

/** Whether a move by its squares would bring a pawn to the last rank. */
export function chessPromotes(fen: string, from: number, to: number): boolean {
  const piece = positionOf(fen)?.board.get(flip(from));
  return piece?.role === "pawn" && (to < 8 || to >= 56);
}

/**
 * A line an engine gives ("e2e4 e7e5 g1f3") as it is written down, from a position: each
 * move in turn, as far as the line can be followed.
 */
export function chessLine(fen: string, line: readonly string[], limit = 10): ChessPly[] {
  const pos = positionOf(fen);
  const plies: ChessPly[] = [];
  if (!pos) return plies;
  for (const word of line.slice(0, limit)) {
    const move = parseUci(word);
    if (!move || !("from" in move) || !pos.isLegal(move)) break;
    plies.push(make(pos, move));
  }
  return plies;
}

/** The name of a square: "e4". */
export function chessSquare(square: number): string {
  return makeSquare(flip(square));
}

/** A written game with what is noted beside its moves. */
export interface Annotated {
  moves: string[];
  /** One for each move while the game has them; see `GameResult.evals`. */
  evals: number[];
  /** One for each move; -1 where the game does not say. */
  clocks: number[];
}

/** A mate is kept as a thousand less the moves to it, so that it sorts beyond any count of pawns. */
export const MATE = 1000;

/** One game of a written record, with its headers ("White", "Result", "GameURL"). */
export interface Written extends Annotated {
  headers: Map<string, string>;
}

/**
 * Every game of a written record (PGN), one after another: the moves of each with the notes
 * that follow them, the engine's judgement (`[%eval 0.17]`, `[%eval #-3]`) and the mover's
 * clock (`[%clk 1:30:10]`). Side lines are left out.
 */
export function writtenGames(pgn: string): Written[] {
  return parsePgn(pgn).map((game) => {
    const out: Written = { headers: game.headers, moves: [], evals: [], clocks: [] };
    let judged = true;
    for (const node of game.moves.mainline()) {
      out.moves.push(node.san);
      const notes = (node.comments ?? []).map(parseComment);
      const clock = notes.find((note) => note.clock !== undefined)?.clock;
      out.clocks.push(clock === undefined ? -1 : Math.round(clock));
      const judgement = notes.find((note) => note.evaluation)?.evaluation;
      // Judgements are kept only while every move has one: a list with holes says nothing.
      if (!judgement || !judged) judged = false;
      else if ("mate" in judgement)
        out.evals.push(Math.sign(judgement.mate || 1) * (MATE - Math.abs(judgement.mate)));
      else out.evals.push(judgement.pawns);
    }
    return out;
  });
}

/** One written game with its notes; see `writtenGames`. */
export function annotatedPgn(pgn: string): Annotated {
  const [game] = writtenGames(pgn);
  return { moves: game?.moves ?? [], evals: game?.evals ?? [], clocks: game?.clocks ?? [] };
}

/** The moves of a written game: comments, side lines, move numbers and the result left out. */
export function movesOfPgn(pgn: string): string[] {
  return annotatedPgn(pgn).moves;
}
