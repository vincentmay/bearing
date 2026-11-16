import { Atlas, type Follow, type Match, type World } from "@bearing/domain";
import { SAMPLE_FOLLOWS, SAMPLE_NOW, buildSampleWorld } from "@bearing/domain/sample";
import { convexQuery } from "@convex-dev/react-query";
import { type QueryClient, queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useSyncExternalStore } from "react";
import { api } from "../../convex/_generated/api";
import { useAccountFollows, useToggleFollow } from "./account";
import { convex } from "./backend";
import { isFollowing, useFollows } from "./follows";

/**
 * The world every screen reads. It comes through TanStack Query from one of two places: the
 * sample world built in the browser, or Bearing's own store in Convex, which pushes every change
 * as it happens. The screens cannot tell which.
 */
export const worldQuery = queryOptions({
  queryKey: ["world", "sample"],
  queryFn: async (): Promise<World> => {
    // In development, ?world=slow and ?world=fail show the waiting and the failed state.
    const mode = import.meta.env.DEV ? new URLSearchParams(location.search).get("world") : null;
    if (mode === "slow") await new Promise((done) => setTimeout(done, 6000));
    if (mode === "fail") throw new Error("The sample world was asked to fail.");
    return buildSampleWorld();
  },
  staleTime: Infinity,
  retry: false,
});

const frameQuery = convexQuery(api.world.frame, {});
const settledQuery = convexQuery(api.world.settled, {});
const liveQuery = convexQuery(api.world.live, {});

const TIMEOUT = 20_000;

/** Make sure the world is there before a screen is drawn. */
export async function loadWorld(client: QueryClient): Promise<void> {
  if (!convex) {
    await client.ensureQueryData(worldQuery);
    return;
  }
  // The sample is loaded into the store, and kept moving, by asking for it.
  const backend = convex;
  const ready = (async () => {
    await backend.mutation(api.sample.wake, {});
    // A store that is being loaded for the first time, or afresh, takes a few seconds.
    while (!(await backend.query(api.world.ready, {}))) {
      await new Promise((done) => setTimeout(done, 400));
    }
    await Promise.all([
      client.ensureQueryData(frameQuery),
      client.ensureQueryData(settledQuery),
      client.ensureQueryData(liveQuery),
    ]);
  })();
  // A backend that cannot be reached would otherwise keep the page waiting for ever.
  const late = new Promise<never>((_, fail) =>
    setTimeout(() => fail(new Error("The backend did not answer in time.")), TIMEOUT),
  );
  await Promise.race([ready, late]);
}

function useLocalWorld(): World {
  return useSuspenseQuery(worldQuery).data;
}

function useStoredWorld(): World {
  const frame = useSuspenseQuery(frameQuery).data;
  const settled = useSuspenseQuery(settledQuery).data;
  const live = useSuspenseQuery(liveQuery).data;
  return useMemo(() => {
    const { clock, ...rest } = frame;
    setClock(clock);
    return {
      ...rest,
      now: clock ? clock.pinned : new Date().toISOString(),
      matches: [...settled, ...live],
      // The sample comes with a few follows so that a first look shows a personal page.
      follows: clock ? SAMPLE_FOLLOWS : [],
    };
  }, [frame, settled, live]);
}

export const useWorld: () => World = convex ? useStoredWorld : useLocalWorld;

/** What the viewer follows: their account's list when signed in, this device's otherwise. */
function useMine(world: World): Follow[] {
  const device = useFollows(world.follows);
  return useAccountFollows() ?? device;
}

/** The indexed world, with the viewer's own follows applied. */
export function useAtlas(): Atlas {
  const world = useWorld();
  const follows = useMine(world);
  return useMemo(() => new Atlas({ ...world, follows }), [world, follows]);
}

export function useFollow(f: Follow): [boolean, () => void] {
  const world = useWorld();
  const follows = useMine(world);
  const toggle = useToggleFollow();
  return [isFollowing(follows, f), () => toggle(f)];
}

// ---- Clock ----
// Sample data is pinned to a fixed instant, and the clock moves on from there in real time so
// that countdowns tick naturally. Real data lives in real time.

let clock: { pinned: number; since: number } | null = {
  pinned: Date.parse(SAMPLE_NOW),
  since: Date.now(),
};
const listeners = new Set<() => void>();
let current = nowMs();
let timer: ReturnType<typeof setInterval> | undefined;

function setClock(next: { pinned: string; since: number } | null) {
  clock = next ? { pinned: Date.parse(next.pinned), since: next.since } : null;
}

/** The current instant of the world, without subscribing to it. */
export function nowMs(): number {
  return clock ? clock.pinned + (Date.now() - clock.since) : Date.now();
}

function tick() {
  current = nowMs();
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

/** Typical length of a series, for telling which matches may overlap. */
export function estimatedMinutes(match: Match, discipline: string): number {
  if (discipline === "chess") return 300;
  if (discipline === "trackmania") return 30;
  const perGame = discipline === "lol" ? 40 : discipline === "rocket-league" ? 12 : 55;
  const games = Math.ceil(match.bestOf / 2) + Math.floor(match.bestOf / 4);
  return Math.max(60, perGame * games + 15 * (games - 1));
}
