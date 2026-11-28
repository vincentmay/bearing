import { useSyncExternalStore } from "react";

/**
 * What the viewer has chosen for this device: appearance and how times are written. It stays in
 * this browser and is never sent anywhere; an account holds follows and nothing else.
 */
export interface Prefs {
  theme: "system" | "light" | "dark";
  /** "auto" follows the viewer's locale. */
  hours: "auto" | "12" | "24";
  /** An IANA time zone, or null for the device's own. */
  zone: string | null;
  /** How the chess board looks, and which pieces stand on it. */
  board: BoardStyle;
  pieces: PieceSet;
  /** Whether an engine judges the chess positions shown, and draws the move it would make. */
  engine: boolean;
  hint: boolean;
}

export const BOARDS = ["indigo", "ink", "slate", "green", "walnut"] as const;
export type BoardStyle = (typeof BOARDS)[number];
export const PIECES = ["mpchess", "cburnett", "merida"] as const;
export type PieceSet = (typeof PIECES)[number];

const KEY = "bearing.prefs.v1";
const DEFAULTS: Prefs = {
  theme: "system",
  hours: "auto",
  zone: null,
  board: "indigo",
  pieces: "mpchess",
  engine: true,
  hint: false,
};
const listeners = new Set<() => void>();
let current: Prefs | null = null;

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const kept = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
      // A choice that is no longer offered falls back to the first that is.
      if (!BOARDS.includes(kept.board)) kept.board = DEFAULTS.board;
      if (!PIECES.includes(kept.pieces)) kept.pieces = DEFAULTS.pieces;
      return kept;
    }
  } catch {
    // Storage unavailable: the defaults apply.
  }
  return DEFAULTS;
}

export function usePrefs(): Prefs {
  current ??= load();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current!,
    () => current!,
  );
}

export function setPrefs(change: Partial<Prefs>) {
  current = { ...(current ?? load()), ...change };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Not remembered; still applies for this visit.
  }
  for (const l of listeners) l();
}
