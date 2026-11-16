import type { GameResult, Match, Provenance, Veto } from "../model.ts";

/**
 * The sample world is pinned to a fixed instant so the design exploration always shows
 * something live: Sunday 15 November 2026, 19:40 in Central Europe.
 */
export const SAMPLE_NOW = "2026-11-15T18:40:00Z";

export const SAMPLE_PROVENANCE: Provenance = {
  source: "Slate design sample",
  checkedAt: SAMPLE_NOW,
  note: "Real names, fictional events and generated results. Not live data.",
};

/** Deterministic PRNG so every reload shows the same sample. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rand = ReturnType<typeof rng>;

export function pick<T>(r: Rand, list: readonly T[]): T {
  return list[Math.floor(r() * list.length)]!;
}

export function shuffle<T>(r: Rand, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Central European Time in November is UTC+1. */
export function cet(date: string, time: string): string {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCHours(h - 1, m, 0, 0);
  return d.toISOString().replace(".000", "");
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString().replace(".000", "");
}

export function statusAt(start: string, durationMinutes: number): Match["status"] {
  const now = Date.parse(SAMPLE_NOW);
  const s = Date.parse(start);
  if (now < s) return "scheduled";
  if (now < s + durationMinutes * 60_000) return "live";
  return "finished";
}

/** Probability that a beats b given strengths in [0, 1]. */
export function winChance(a: number, b: number): number {
  return 1 / (1 + Math.exp(-(a - b) * 6));
}

interface SeriesOptions {
  bestOf: number;
  strengths: [number, number];
  labels: (
    r: Rand,
    count: number,
  ) => { games: string[]; veto?: Veto[]; picks?: (number | undefined)[] };
  score: (r: Rand, winner: number) => { scores: number[]; detail?: string };
  /** Stop after this many finished games and leave the next one live. */
  liveAfter?: number;
  liveScore?: number[];
}

/** Simulate a best-of series map by map. */
export function series(
  r: Rand,
  o: SeriesOptions,
): { games: GameResult[]; veto?: Veto[]; status: Match["status"] } {
  const need = Math.ceil(o.bestOf / 2);
  const { games: labels, veto, picks } = o.labels(r, o.bestOf);
  const wins = [0, 0];
  const games: GameResult[] = [];
  for (let i = 0; i < o.bestOf; i++) {
    const label = labels[i] ?? `Game ${i + 1}`;
    if (wins[0] === need || wins[1] === need) break;
    if (o.liveAfter !== undefined && i === o.liveAfter) {
      games.push({ label, status: "live", scores: o.liveScore, pickedBy: picks?.[i] });
      for (let j = i + 1; j < o.bestOf; j++) {
        games.push({
          label: labels[j] ?? `Game ${j + 1}`,
          status: "scheduled",
          pickedBy: picks?.[j],
        });
      }
      return { games, veto, status: "live" };
    }
    const w = r() < winChance(o.strengths[0], o.strengths[1]) ? 0 : 1;
    wins[w]!++;
    const { scores, detail } = o.score(r, w);
    games.push({ label, status: "finished", scores, winner: w, pickedBy: picks?.[i], detail });
  }
  return { games, veto, status: "finished" };
}

export function scheduled(bestOf: number, label: (i: number) => string): GameResult[] {
  return Array.from({ length: bestOf }, (_, i) => ({
    label: label(i),
    status: "scheduled" as const,
  }));
}
