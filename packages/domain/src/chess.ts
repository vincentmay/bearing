/**
 * Enough chess to follow a game: given its moves as they are written down (1. e4 e5 2. Nf3 …),
 * the position after each one. It does not judge moves or look for mates; it reads a record of
 * a game that was played, and stops quietly at a move it cannot make sense of.
 *
 * A position is 64 characters, a8 first and h1 last, a letter for a piece (capitals are White)
 * and a dot for an empty square.
 */

export interface ChessPly {
  /** The move as written: "Nf3", "exd5", "O-O", "e8=Q+". */
  san: string;
  /** The squares the move left and arrived at, 0 for a8 to 63 for h1. */
  from: number;
  to: number;
  /** The position after the move. */
  squares: string;
}

export const CHESS_START = "rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR";

interface State {
  board: string[];
  white: boolean;
  /** Which castling is still allowed: any of K, Q, k, q. */
  castle: string;
  /** The square a pawn may be taken on in passing, or -1. */
  passing: number;
}

const file = (sq: number) => sq % 8;
const rank = (sq: number) => sq >> 3;
const isWhite = (piece: string) => piece !== "." && piece === piece.toUpperCase();

function clear(board: string[], from: number, to: number): boolean {
  const df = Math.sign(file(to) - file(from));
  const dr = Math.sign(rank(to) - rank(from));
  for (let sq = from + df + dr * 8; sq !== to; sq += df + dr * 8) {
    if (board[sq] !== ".") return false;
  }
  return true;
}

/** Whether the piece on `from` could move to `to`, leaving aside whether its king is then safe. */
function reaches(state: State, from: number, to: number, capture: boolean): boolean {
  const { board } = state;
  const piece = board[from]!;
  const df = file(to) - file(from);
  const dr = rank(to) - rank(from);
  const adf = Math.abs(df);
  const adr = Math.abs(dr);
  switch (piece.toUpperCase()) {
    case "N":
      return (adf === 1 && adr === 2) || (adf === 2 && adr === 1);
    case "K":
      return adf <= 1 && adr <= 1 && adf + adr > 0;
    case "B":
      return adf === adr && adf > 0 && clear(board, from, to);
    case "R":
      return (adf === 0) !== (adr === 0) && clear(board, from, to);
    case "Q":
      return (adf === adr || adf === 0 || adr === 0) && adf + adr > 0 && clear(board, from, to);
    case "P": {
      const forward = isWhite(piece) ? -1 : 1;
      if (capture) return adf === 1 && dr === forward;
      if (df !== 0) return false;
      if (dr === forward) return board[to] === ".";
      const home = isWhite(piece) ? 6 : 1;
      return (
        dr === 2 * forward &&
        rank(from) === home &&
        board[to] === "." &&
        board[from + forward * 8] === "."
      );
    }
    default:
      return false;
  }
}

function attacked(state: State, square: number, byWhite: boolean): boolean {
  for (let sq = 0; sq < 64; sq++) {
    const piece = state.board[sq]!;
    if (piece === "." || isWhite(piece) !== byWhite) continue;
    if (reaches(state, sq, square, true)) return true;
  }
  return false;
}

function apply(state: State, from: number, to: number, promote?: string): State {
  const board = [...state.board];
  const piece = board[from]!;
  const white = isWhite(piece);
  let castle = state.castle;
  let passing = -1;
  board[from] = ".";
  if (piece.toUpperCase() === "P") {
    // Taking in passing removes a pawn that is not on the square arrived at.
    if (to === state.passing) board[to + (white ? 8 : -8)] = ".";
    if (Math.abs(to - from) === 16) passing = (from + to) / 2;
  }
  if (piece.toUpperCase() === "K") {
    castle = castle.replace(white ? /[KQ]/g : /[kq]/g, "");
    // Castling: the rook goes to the other side of the king.
    if (Math.abs(file(to) - file(from)) === 2) {
      const short = file(to) === 6;
      const row = rank(from) * 8;
      board[row + (short ? 5 : 3)] = board[row + (short ? 7 : 0)]!;
      board[row + (short ? 7 : 0)] = ".";
    }
  }
  // A rook that moves, or is taken, ends castling on its side.
  for (const [corner, right] of [
    [63, "K"],
    [56, "Q"],
    [7, "k"],
    [0, "q"],
  ] as const) {
    if (from === corner || to === corner) castle = castle.replace(right, "");
  }
  board[to] = promote ? (white ? promote.toUpperCase() : promote.toLowerCase()) : piece;
  return { board, white: !state.white, castle, passing };
}

function safe(state: State, from: number, to: number): boolean {
  const after = apply(state, from, to);
  const king = after.board.indexOf(state.white ? "K" : "k");
  return king < 0 || !attacked(after, king, !state.white);
}

const SAN = /^([KQRBN])?([a-h])?([1-8])?(x)?([a-h])([1-8])(?:=?([QRBN]))?$/;

function read(
  state: State,
  written: string,
): { from: number; to: number; promote?: string } | undefined {
  const san = written.replace(/[+#!?]+$/g, "").replace(/0/g, "O");
  const row = state.white ? 56 : 0;
  if (san === "O-O") return { from: row + 4, to: row + 6 };
  if (san === "O-O-O") return { from: row + 4, to: row + 2 };
  const m = SAN.exec(san);
  if (!m) return undefined;
  const [, letter, fromFile, fromRank, takes, toFile, toRank, promote] = m;
  const kind = letter ?? "P";
  const to = (8 - Number(toRank)) * 8 + (toFile!.charCodeAt(0) - 97);
  const capture = !!takes || (kind === "P" && state.board[to] !== ".");
  for (let from = 0; from < 64; from++) {
    const piece = state.board[from]!;
    if (piece === "." || isWhite(piece) !== state.white || piece.toUpperCase() !== kind) continue;
    if (fromFile && file(from) !== fromFile.charCodeAt(0) - 97) continue;
    if (fromRank && rank(from) !== 8 - Number(fromRank)) continue;
    if (!reaches(state, from, to, capture)) continue;
    if (!safe(state, from, to)) continue;
    return { from, to, promote };
  }
  return undefined;
}

/** The position after each move of a game, as far as the moves can be followed. */
export function replayChess(moves: readonly string[]): ChessPly[] {
  let state: State = { board: CHESS_START.split(""), white: true, castle: "KQkq", passing: -1 };
  const plies: ChessPly[] = [];
  for (const san of moves) {
    const move = read(state, san);
    if (!move) break;
    state = apply(state, move.from, move.to, move.promote);
    plies.push({ san, from: move.from, to: move.to, squares: state.board.join("") });
  }
  return plies;
}

/**
 * The moves of a game out of its written record (PGN): comments, side lines, move numbers,
 * marks and the result are left out.
 */
export function movesOfPgn(pgn: string): string[] {
  const text = pgn
    .replace(/^\s*\[[^\n]*\]\s*$/gm, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/;[^\n]*/g, " ");
  // Side lines can sit inside each other; take them out from the inside.
  let plain = text;
  for (let before = ""; before !== plain;) {
    before = plain;
    plain = plain.replace(/\([^()]*\)/g, " ");
  }
  return plain
    .split(/\s+/)
    .map((word) => word.replace(/^\d+\.+/, ""))
    .filter((word) => word && !/^(\$\d+|1-0|0-1|1\/2-1\/2|\*|\d+\.*)$/.test(word));
}
