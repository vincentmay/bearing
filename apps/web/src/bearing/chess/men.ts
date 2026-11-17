import { CHESS_START, type ChessPly } from "@bearing/domain";

/**
 * The pieces as things that last. A position says what stands on each square; it does not say
 * that the knight on f3 is the one that stood on g1 a move ago. The board needs to know that,
 * so that a piece is seen to travel and is not taken off one square and set down on another.
 * Each piece keeps a number from the first position to the last, through every move.
 */
export interface Man {
  id: number;
  /** A letter as in a position: "N" is a white knight, "q" a black queen. */
  piece: string;
  square: number;
  /** Taken: it stays where it fell, unseen, so that stepping back brings it out again. */
  gone: boolean;
}

export function setUp(squares: string = CHESS_START): Man[] {
  const men: Man[] = [];
  for (let square = 0; square < 64; square++) {
    const piece = squares[square]!;
    if (piece !== ".") men.push({ id: men.length, piece, square, gone: false });
  }
  return men;
}

/** The pieces after a move, from the pieces and the position before it. */
function advance(men: Man[], before: string, ply: ChessPly): Man[] {
  const after = ply.squares;
  const next = men.map((man) => ({ ...man }));
  const on = (square: number) => next.find((man) => !man.gone && man.square === square);
  const mover = on(ply.from);
  const taken = on(ply.to);
  if (taken) taken.gone = true;
  if (mover) {
    mover.square = ply.to;
    // A pawn that reached the last rank is another piece from here on.
    mover.piece = after[ply.to] ?? mover.piece;
  }
  // Whatever else changed: a rook that castled, a pawn taken in passing.
  for (let square = 0; square < 64; square++) {
    if (square === ply.from || square === ply.to) continue;
    if (before[square] === "." || after[square] !== ".") continue;
    const left = on(square);
    if (!left) continue;
    let went = -1;
    for (let to = 0; to < 64 && went < 0; to++) {
      if (to !== ply.to && before[to] === "." && after[to] === before[square]) went = to;
    }
    if (went >= 0) left.square = went;
    else left.gone = true;
  }
  return next;
}

/**
 * The pieces at every point of a line of play: the first entry is where it starts, each one
 * after it stands after one more move.
 */
export function follow(
  plies: readonly ChessPly[],
  start: Man[] = setUp(),
  squares: string = CHESS_START,
): Man[][] {
  const tracks = [start];
  let before = squares;
  for (const ply of plies) {
    tracks.push(advance(tracks.at(-1)!, before, ply));
    before = ply.squares;
  }
  return tracks;
}

const WORTH: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const FULL: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };

/**
 * What each side has taken, least first, and how many pawns' worth of pieces White is ahead
 * by (negative when Black is). The first list is the black pieces White has taken.
 */
export function taken(squares: string): { white: string[]; black: string[]; lead: number } {
  const count: Record<string, number> = {};
  for (const piece of squares) if (piece !== ".") count[piece] = (count[piece] ?? 0) + 1;
  const missing = (white: boolean) =>
    Object.keys(FULL).flatMap((kind) => {
      const piece = white ? kind.toUpperCase() : kind;
      return Array.from<string>({ length: Math.max(0, FULL[kind]! - (count[piece] ?? 0)) }).fill(
        piece,
      );
    });
  const sum = (white: boolean) =>
    Object.keys(WORTH).reduce(
      (total, kind) => total + WORTH[kind]! * (count[white ? kind.toUpperCase() : kind] ?? 0),
      0,
    );
  return { white: missing(false), black: missing(true), lead: sum(true) - sum(false) };
}
