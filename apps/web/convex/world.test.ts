/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vite-plus/test";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const DAY = 24 * 60 * 60 * 1000;

describe("the world in the store", () => {
  test("an empty store is not ready and reads as an empty world", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.world.ready, {})).toBe(false);
    expect(await t.query(api.world.live, {})).toEqual([]);
    expect((await t.query(api.world.frame, {})).tournaments).toEqual([]);
  });

  test("asking for it loads the sample, with a live match in every game", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await t.mutation(api.sample.wake, {});
    // The load runs as a scheduled action; the first beats follow it.
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1000));
    expect(await t.query(api.world.ready, {})).toBe(true);
    const frame = await t.query(api.world.frame, {});
    expect(frame.clock).not.toBeNull();
    expect(frame.disciplines).toHaveLength(5);
    expect(frame.tournaments.length).toBeGreaterThan(5);
    const settled = await t.query(api.world.settled, { since: 0 });
    expect(settled.length).toBeGreaterThan(50);
    expect(settled.every((m) => m.status !== "live")).toBe(true);
    vi.useRealTimers();
  });

  test("it is played forward only while someone is looking, then rests", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await t.mutation(api.sample.wake, {});
    // Nobody asks again: after a minute and a half the loop stops by itself, which is why
    // waiting for every scheduled function comes to an end at all.
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(2400));
    const watch = await t.run((ctx) => ctx.db.query("watch").first());
    expect(watch?.running).toBe(false);
    // In that time matches moved on: some that were live are over.
    const settled = await t.query(api.world.settled, { since: 0 });
    const live = await t.query(api.world.live, {});
    expect(settled.length + live.length).toBeGreaterThan(80);
    expect(live.length).toBeLessThan(7);
    vi.useRealTimers();
  });

  test("settled matches are read as a window of time", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await t.mutation(internal.sample.reset, {});
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(2400));
    const all = await t.query(api.world.settled, { since: 0 });
    const from = Date.UTC(2026, 10, 15);
    const recent = await t.query(api.world.settled, { since: from });
    expect(recent.length).toBeGreaterThan(0);
    expect(recent.length).toBeLessThan(all.length);
    expect(recent.every((m) => Date.parse(m.scheduledAt) >= from)).toBe(true);
    expect(await t.query(api.world.settled, { since: from + 400 * DAY })).toEqual([]);
    vi.useRealTimers();
  });
});
