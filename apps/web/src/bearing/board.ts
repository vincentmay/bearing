import type { Atlas, Match } from "@bearing/domain";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useAtlas, useDetailed, useMinute } from "../lib/world";
import { type MatchView, summarize } from "./model";
import { type Times, useTimes } from "./time";

export interface Board {
  atlas: Atlas;
  /** The current instant, to the minute. */
  now: number;
  times: Times;
  view(match: Match): MatchView;
  /** What the page asked to have whole is still on its way. */
  loading: boolean;
}

/**
 * What every screen starts from: the world, the time, and how to read a match. A page about one
 * team or player names it as the subject, so that matches are drawn from its point of view.
 */
export function useBoard(
  subject?: string,
  /** What this page needs whole: one match, or the matches of one team or player. */
  whole?: { match?: string; side?: string },
): Board {
  const light = useAtlas();
  const { match, side } = whole ?? {};
  const ids = useMemo(() => {
    if (match) return [match];
    if (!side) return [];
    // A player's games are their team's: the lines of both are wanted.
    const team = light.world.stints.find((s) => s.playerId === side && !s.to)?.teamId;
    return [side, ...(team ? [team] : [])]
      .flatMap((id) => light.matchesFor(id))
      .filter((m) => m.status === "finished")
      .sort((x, y) => y.scheduledAt.localeCompare(x.scheduledAt))
      .map((m) => m.id);
  }, [light, match, side]);
  const { atlas, loading } = useDetailed(light, ids);
  const now = useMinute();
  const times = useTimes();
  const view = useCallback(
    (match: Match) => summarize(atlas, match, now, times, subject),
    [atlas, now, times, subject],
  );
  return { atlas, now, times, view, loading };
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
