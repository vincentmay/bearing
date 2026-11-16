import { Atlas, type Follow, type Match, type World } from "@bearing/domain";
import { buildSampleWorld } from "@bearing/domain/sample";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useSyncExternalStore } from "react";
import { isFollowing, toggleFollow, useFollows } from "./follows";

/**
 * The world comes through TanStack Query so the sample source can be swapped for the API
 * without touching any screen.
 */
export const worldQuery = queryOptions({
  queryKey: ["world", "sample"],
  queryFn: async (): Promise<World> => buildSampleWorld(),
  staleTime: Infinity,
});

export function useWorld(): World {
  return useSuspenseQuery(worldQuery).data;
}

/** The indexed world, with the viewer's own follows applied. */
export function useAtlas(): Atlas {
  const world = useWorld();
  const follows = useFollows(world.follows);
  return useMemo(() => new Atlas({ ...world, follows }), [world, follows]);
}

export function useFollow(f: Follow): [boolean, () => void] {
  const world = useWorld();
  const follows = useFollows(world.follows);
  return [isFollowing(follows, f), () => toggleFollow(f)];
}

// ---- Clock ----
// The sample is pinned to a fixed instant; the clock advances from there in real time so
// countdowns tick naturally.

const loadedAt = Date.now();
const pinned = Date.parse(buildSampleWorld().now);
const listeners = new Set<() => void>();
let current = pinned;
let timer: ReturnType<typeof setInterval> | undefined;

function tick() {
  current = pinned + (Date.now() - loadedAt);
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) timer = setInterval(tick, 1000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** Current instant, ticking every second. */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
}

/** Current instant rounded to the minute, for views that shouldn't re-render every second. */
export function useMinute(): number {
  const now = useNow();
  return Math.floor(now / 60_000) * 60_000;
}

/** Typical length of a series, for timelines and "ends around" hints. */
export function estimatedMinutes(match: Match, discipline: string): number {
  if (discipline === "chess") return 300;
  if (discipline === "trackmania") return 30;
  const perGame = discipline === "lol" ? 40 : discipline === "rocket-league" ? 12 : 55;
  const games = Math.ceil(match.bestOf / 2) + Math.floor(match.bestOf / 4);
  return Math.max(60, perGame * games + 15 * (games - 1));
}
