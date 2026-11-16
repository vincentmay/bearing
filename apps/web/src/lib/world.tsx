import { Atlas, type Follow, type Match, type World } from "@bearing/domain";
import { SAMPLE_FOLLOWS, SAMPLE_NOW } from "@bearing/domain/sample/follows";
import { convexQuery } from "@convex-dev/react-query";
import { type QueryClient, queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { api } from "../../convex/_generated/api";
import { useAccountFollows, useToggleFollow } from "./account";
import { reader, storeName } from "./backend";
import { type Snapshot, readSnapshot, writeSnapshot } from "./snapshot";
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
    // The sample is a good part of a megabyte of names and games; only this path needs it.
    const { buildSampleWorld } = await import("@bearing/domain/sample");
    return buildSampleWorld();
  },
  staleTime: Infinity,
  retry: false,
});

const frameQuery = convexQuery(api.world.frame, {});
const DAY = 24 * 60 * 60 * 1000;
/** How far back the settled matches reach. */
const WINDOW = 45 * DAY;

/** Matches from the start of the day, some weeks before `now`: the same request all day long. */
function settledQuery(now: number) {
  return convexQuery(api.world.settled, { since: Math.floor(now / DAY) * DAY - WINDOW });
}

type Clock = { pinned: string; since: number } | null;

/** What time it is in a world with this clock: the sample's pinned instant moved on, or now. */
function timeOf(clock: Clock): number {
  return clock ? Date.parse(clock.pinned) + (Date.now() - clock.since) : Date.now();
}
const liveQuery = convexQuery(api.world.live, {});

const TIMEOUT = 20_000;

type Frame = Awaited<ReturnType<NonNullable<(typeof frameQuery)["queryFn"]>>>;
type Kept = Snapshot<Frame, Match>;

/**
 * Draw from the last visit, if there was one lately. The three parts of the world are put
 * where the screens look for them; the store then replaces each as it answers.
 */
async function restore(client: QueryClient): Promise<boolean> {
  // Never worth waiting long for: a slow disk is no better than the network.
  const kept = await Promise.race([
    readSnapshot<Frame, Match>(storeName),
    new Promise<null>((done) => setTimeout(() => done(null), 250)),
  ]);
  if (!kept?.frame.ready) return false;
  setClock(kept.frame.clock);
  client.setQueryData(frameQuery.queryKey, kept.frame);
  client.setQueryData(settledQuery(timeOf(kept.frame.clock)).queryKey, kept.settled);
  client.setQueryData(liveQuery.queryKey, kept.live);
  return true;
}

let saving: ReturnType<typeof setTimeout> | undefined;

/** Keep the world as it is now for the next visit; a little after it last changed. */
function keep(snapshot: Kept) {
  clearTimeout(saving);
  saving = setTimeout(() => void writeSnapshot(storeName, snapshot), 1500);
}

/**
 * Make sure the world is there before a screen is drawn.
 *
 * A visit that follows another draws from what the browser kept and does not wait at all. A
 * first visit asks for all three parts of the world at once: one trip to the store, where
 * there used to be four in a row.
 */
export function loadWorld(client: QueryClient): Promise<void> {
  // Once for the life of the page. Going from one page to another asks for nothing: the world
  // is already here and the store keeps it current. A load that failed may be tried again.
  loaded ??= load(client).catch((error: unknown) => {
    loaded = undefined;
    throw error;
  });
  return loaded;
}

let loaded: Promise<void> | undefined;

async function load(client: QueryClient): Promise<void> {
  if (!reader) {
    await client.ensureQueryData(worldQuery);
    return;
  }
  const backend = reader;
  // The sample is loaded into the store, and kept moving, by asking for it. Nothing waits for
  // the answer: on real data it does nothing.
  void backend.mutation(api.sample.wake, {}).catch(() => undefined);
  if (await restore(client)) return;

  const ready = (async () => {
    // Which matches count as settled depends on the world's clock, which only the sample has.
    // Real time is the guess, and on real data the guess is right.
    const guess = settledQuery(Date.now());
    let [frame] = await Promise.all([
      client.ensureQueryData(frameQuery),
      client.prefetchQuery(guess),
      client.prefetchQuery(liveQuery),
    ]);
    // A store that is being loaded for the first time, or afresh, takes a few seconds.
    while (!frame.ready) {
      await new Promise((done) => setTimeout(done, 400));
      frame = await client.fetchQuery({ ...frameQuery, staleTime: 0 });
    }
    // The clock is set here, and not by whichever page first reads the world: a page that
    // reads none of it (the settings) would otherwise tell the sample's time on real data.
    setClock(frame.clock);
    await Promise.all([
      client.ensureQueryData(settledQuery(timeOf(frame.clock))),
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
  const settled = useSuspenseQuery(settledQuery(timeOf(frame.clock))).data;
  const live = useSuspenseQuery(liveQuery).data;
  useEffect(() => {
    if (frame.ready) keep({ frame, settled, live });
  }, [frame, settled, live]);
  return useMemo(() => {
    const { clock, ready: _ready, ...rest } = frame;
    setClock(clock);
    // A game nothing is known about is not offered: on real data Trackmania has no source.
    const played = new Set(rest.tournaments.map((t) => t.discipline));
    return {
      ...rest,
      disciplines: rest.disciplines.filter((d) => played.has(d.id)),
      now: clock ? clock.pinned : new Date().toISOString(),
      matches: [...settled, ...live],
      // The sample comes with a few follows so that a first look shows a personal page.
      follows: clock ? SAMPLE_FOLLOWS : [],
    };
  }, [frame, settled, live]);
}

export const useWorld: () => World = reader ? useStoredWorld : useLocalWorld;

/**
 * The same world with some of its matches whole. A list carries a match without the inside
 * of its games; a page about one match, or about one team's games, asks for those here. Until
 * they arrive the page stands on what the list has, and nothing waits.
 */
export function useDetailed(atlas: Atlas, ids: string[]): { atlas: Atlas; loading: boolean } {
  const wanted = useMemo(() => [...new Set(ids)].sort().slice(0, 200), [ids]);
  const on = !!reader && wanted.length > 0;
  const { data, isPending } = useQuery({
    ...convexQuery(api.world.detail, { ids: wanted }),
    enabled: on,
  });
  const detailed = useMemo(() => {
    if (!data?.length) return atlas;
    const whole = new Map(data.map((m) => [m.id, m as Match]));
    const had = new Set(atlas.world.matches.map((m) => m.id));
    return new Atlas({
      ...atlas.world,
      matches: [
        ...atlas.world.matches.map((m) => whole.get(m.id) ?? m),
        // A match from before the weeks a list reaches back is known only by being asked for.
        ...[...whole.values()].filter((m) => !had.has(m.id)),
      ],
    });
  }, [atlas, data]);
  return { atlas: detailed, loading: on && isPending };
}

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

/** Whether the world is the sample, pinned to its instant, and not real time. */
export function pinned(): boolean {
  return clock !== null;
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
