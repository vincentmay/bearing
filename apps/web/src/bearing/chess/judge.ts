import { MATE } from "@bearing/domain";

/**
 * How likely White is to win a position an engine judges at so many pawns, from -1 (lost) to
 * 1 (won): the curve chess sites use, under which a pawn early counts for much and the tenth
 * pawn for nothing.
 */
export function chances(pawns: number): number {
  if (Math.abs(pawns) > MATE - 200) return Math.sign(pawns);
  return 2 / (1 + Math.exp(-0.368208 * pawns)) - 1;
}

/** A judgement as it is written: "+0.4", "−1.7", "M3", and "#" for a mate on the board. */
export function written(pawns: number): string {
  if (Math.abs(pawns) >= MATE) return "#";
  if (Math.abs(pawns) > MATE - 200) return `M${MATE - Math.abs(pawns)}`;
  const text = Math.abs(pawns).toFixed(1);
  return text === "0.0" ? "0.0" : `${pawns > 0 ? "+" : "−"}${text}`;
}

/** A judgement in words, for whoever reads the figure beside it: "Level", "Black is better". */
export function said(pawns: number): string {
  const side = pawns > 0 ? "White" : "Black";
  if (Math.abs(pawns) >= MATE) return "Checkmate";
  if (Math.abs(pawns) > MATE - 200) return `${side} mates`;
  const lead = Math.abs(chances(pawns));
  if (lead < 0.08) return "Level";
  if (lead < 0.25) return `${side} is a little better`;
  if (lead < 0.55) return `${side} is better`;
  return `${side} is winning`;
}

/** Seconds as a clock shows them: "1:30:10", "4:05", "0:38". */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export type Mark = "?!" | "?" | "??";

/**
 * The mark a move earns by what it gave away, in the mover's chances of winning: an
 * inaccuracy, a mistake, a blunder. The thresholds are the ones Lichess marks games by.
 */
export function markOf(before: number, after: number, white: boolean): Mark | undefined {
  const lost = (white ? 1 : -1) * (chances(before) - chances(after));
  if (lost >= 0.3) return "??";
  if (lost >= 0.2) return "?";
  if (lost >= 0.1) return "?!";
  return undefined;
}

export const MARKS: Record<Mark, string> = {
  "?!": "Inaccuracy",
  "?": "Mistake",
  "??": "Blunder",
};
