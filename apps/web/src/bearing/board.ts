import type { Atlas, Match } from "@bearing/domain";
import { useCallback, useSyncExternalStore } from "react";
import { useAtlas, useMinute } from "../lib/world";
import { type MatchView, summarize } from "./model";
import { type Times, useTimes } from "./time";

export interface Board {
  atlas: Atlas;
  /** The current instant, to the minute. */
  now: number;
  times: Times;
  view(match: Match): MatchView;
}

/**
 * What every screen starts from: the world, the time, and how to read a match. A page about one
 * team or player names it as the subject, so that matches are drawn from its point of view.
 */
export function useBoard(subject?: string): Board {
  const atlas = useAtlas();
  const now = useMinute();
  const times = useTimes();
  const view = useCallback(
    (match: Match) => summarize(atlas, match, now, times, subject),
    [atlas, now, times, subject],
  );
  return { atlas, now, times, view };
}

const WIDE = "(min-width: 900px)";

/** True when there is room for the wide layout. */
export function useWide(): boolean {
  return useSyncExternalStore(
    (listener) => {
      const query = window.matchMedia(WIDE);
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
}
