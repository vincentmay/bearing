import type { World } from "@bearing/domain";
import { SAMPLE_NOW, advance, buildSampleWorld, rng } from "@bearing/domain/sample";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { type MutationCtx, internalAction, internalMutation, mutation } from "./_generated/server";
import {
  competitor,
  discipline,
  match,
  organization,
  ranking,
  stint,
  tournament,
} from "./validators";

/**
 * The sample world, kept in the database and played forward on the server, so every open screen
 * sees the same match at the same moment.
 *
 * It only runs while someone is looking. A screen that is open calls `wake` now and then; the
 * loop keeps going for a short while after the last call and then rests. A sample that has
 * grown old is loaded afresh, so there is always something live to see.
 *
 * Loading is done in small batches from an action, because one transaction may not run for
 * longer than a second. While it lasts the world reads as empty and not ready.
 */

const BEAT = 7200;
/** Steps of play in one beat: the sample moves on as fast as before, written a third as often. */
const STEPS = 3;
/** Every so many beats the whole sample is looked at, in case something was missed between. */
const WHOLE_EVERY = 40;
const HOUR = 60 * 60 * 1000;
/** How long the loop keeps going after the last screen asked for it. */
const WATCH = 90_000;
/** After this long the sample has played itself out and starts again. */
const STALE = 3 * 60 * 60 * 1000;
/** A load that has not finished after this long is taken to have failed, and is started again. */
const STUCK = 2 * 60 * 1000;
const BATCH = 100;

const TABLES = [
  "disciplines",
  "organizations",
  "rankings",
  "stints",
  "competitors",
  "tournaments",
  "matches",
  "digests",
] as const;

const kind = v.union(v.literal("sample"), v.literal("live"));

/** Drop `undefined` fields, which the sample builder leaves behind and the database has no word for. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Mark the store as being reloaded and start the reload. Whatever ran before stops itself. */
async function begin(ctx: MutationCtx, to: "sample" | "live", now: number) {
  const source = await ctx.db.query("source").first();
  const generation = (source?.generation ?? 0) + 1;
  const state = { kind: to, loadedAt: now, generation, loading: true };
  if (source) await ctx.db.replace("source", source._id, state);
  else await ctx.db.insert("source", state);
  await ctx.scheduler.runAfter(0, internal.sample.reload, { generation, kind: to });
}

/**
 * Called by an open screen. Loads the sample if there is none or it has grown old, and makes
 * sure it is being played forward.
 */
export const wake = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const source = await ctx.db.query("source").first();
    if (source?.kind === "live" && !source.loading) return null;
    const age = source ? now - source.loadedAt : Infinity;
    if (!source || (source.loading ? age > STUCK : age > STALE)) {
      await begin(ctx, source?.kind ?? "sample", now);
      return null;
    }
    if (source.loading) return null;
    const watch = await ctx.db.query("watch").first();
    const state = { until: now + WATCH, running: true };
    if (watch) await ctx.db.patch("watch", watch._id, state);
    else await ctx.db.insert("watch", state);
    if (!watch?.running) {
      await ctx.scheduler.runAfter(BEAT, internal.sample.beat, { generation: source.generation });
    }
    return null;
  },
});

/** Empty the store and fill it again: with the sample world, or with only the list of games. */
export const reload = internalAction({
  args: { generation: v.number(), kind },
  handler: async (ctx, args) => {
    for (const table of TABLES) {
      while (await ctx.runMutation(internal.sample.clear, { table })) {
        // Keep going until the table is empty.
      }
    }
    const world = plain(buildSampleWorld());
    const { generation } = args;
    const send = async (part: Parameters<typeof ctx.runMutation<typeof internal.sample.fill>>[1]) =>
      ctx.runMutation(internal.sample.fill, part);
    // The games themselves are not sample data: every source maps into the same five.
    await send({ generation, disciplines: world.disciplines });
    if (args.kind === "sample") {
      await send({ generation, organizations: world.organizations, rankings: world.rankings });
      for (let i = 0; i < world.stints.length; i += BATCH)
        await send({ generation, stints: world.stints.slice(i, i + BATCH) });
      for (let i = 0; i < world.competitors.length; i += BATCH)
        await send({ generation, competitors: world.competitors.slice(i, i + BATCH) });
      await send({ generation, tournaments: world.tournaments });
      for (let i = 0; i < world.matches.length; i += BATCH / 2)
        await send({ generation, matches: world.matches.slice(i, i + BATCH / 2) });
    }
    await ctx.runMutation(internal.sample.ready, { generation });
  },
});

export const clear = internalMutation({
  args: { table: v.union(...TABLES.map((t) => v.literal(t))) },
  handler: async (ctx, { table }): Promise<boolean> => {
    const rows = await ctx.db.query(table).take(BATCH * 2);
    for (const row of rows) await ctx.db.delete(table, row._id);
    return rows.length === BATCH * 2;
  },
});

export const fill = internalMutation({
  args: {
    generation: v.number(),
    disciplines: v.optional(v.array(discipline)),
    organizations: v.optional(v.array(organization)),
    rankings: v.optional(v.array(ranking)),
    stints: v.optional(v.array(stint)),
    competitors: v.optional(v.array(competitor)),
    tournaments: v.optional(v.array(tournament)),
    matches: v.optional(v.array(match)),
  },
  handler: async (ctx, args) => {
    // A newer reload has begun: this one's rows are no longer wanted.
    const source = await ctx.db.query("source").first();
    if (source?.generation !== args.generation) return;
    for (const doc of args.disciplines ?? []) await ctx.db.insert("disciplines", { doc });
    for (const doc of args.organizations ?? []) await ctx.db.insert("organizations", { doc });
    for (const doc of args.rankings ?? []) await ctx.db.insert("rankings", { doc });
    for (const doc of args.stints ?? []) await ctx.db.insert("stints", { key: doc.id, doc });
    for (const doc of args.competitors ?? [])
      await ctx.db.insert("competitors", { key: doc.id, doc });
    for (const doc of args.tournaments ?? [])
      await ctx.db.insert("tournaments", { key: doc.id, doc });
    for (const doc of args.matches ?? [])
      await ctx.db.insert("matches", {
        key: doc.id,
        live: doc.status === "live",
        at: Date.parse(doc.scheduledAt),
        doc,
      });
  },
});

/** The reload is complete: the world can be read again, and its sources may start. */
export const ready = internalMutation({
  args: { generation: v.number() },
  handler: async (ctx, { generation }) => {
    const source = await ctx.db.query("source").first();
    if (!source || source.generation !== generation) return;
    const now = Date.now();
    await ctx.db.patch("source", source._id, { loading: false, loadedAt: now });
    const watch = await ctx.db.query("watch").first();
    const running = source.kind === "sample";
    const state = { until: now + WATCH, running };
    if (watch) await ctx.db.patch("watch", watch._id, state);
    else await ctx.db.insert("watch", state);
    if (running) await ctx.scheduler.runAfter(BEAT, internal.sample.beat, { generation });
    else {
      // On real data: read every source once now; after that the cron jobs take over.
      await ctx.scheduler.runAfter(0, internal.lichess.sync, {});
      await ctx.scheduler.runAfter(0, internal.pandascore.syncAll, {});
    }
  },
});

/**
 * One beat: every live match moves on a little. Then the next beat is booked.
 *
 * What a function reads is what the plan counts, so a beat reads only the matches being played
 * and those now due. The rest of the sample is read when it is needed: when a match has ended,
 * since its winner moves on and its event may have places to give out, and every few minutes.
 */
export const beat = internalMutation({
  args: { generation: v.number(), n: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { generation, n = 0 }) => {
    const source = await ctx.db.query("source").first();
    const watch = await ctx.db.query("watch").first();
    if (!source || !watch || source.loading) return null;
    if (source.kind !== "sample" || source.generation !== generation) return null;
    const now = Date.now();
    if (now > watch.until) {
      await ctx.db.patch("watch", watch._id, { running: false });
      return null;
    }
    const sampleNow = Date.parse(SAMPLE_NOW) + (now - source.loadedAt);
    const r = rng(Math.floor(Math.random() * 2 ** 32));
    type Rows<T extends "matches" | "tournaments"> = Doc<T>[];
    const play = (matches: Rows<"matches">, tournaments: Rows<"tournaments">) => {
      const world: World = {
        now: SAMPLE_NOW,
        disciplines: [],
        organizations: [],
        competitors: [],
        stints: [],
        follows: [],
        rankings: [],
        tournaments: tournaments.map((t) => t.doc),
        matches: matches.map((m) => m.doc),
      };
      let next = world;
      for (let step = 0; step < STEPS; step++) next = advance(next, r, sampleNow);
      return { world, next };
    };
    const write = async (
      matches: Rows<"matches">,
      tournaments: Rows<"tournaments">,
      next: World,
    ) => {
      for (const [i, row] of matches.entries()) {
        const doc = next.matches[i];
        if (doc && doc !== row.doc) {
          await ctx.db.patch("matches", row._id, { live: doc.status === "live", doc: plain(doc) });
        }
      }
      for (const [i, row] of tournaments.entries()) {
        const doc = next.tournaments[i];
        if (doc && doc !== row.doc) await ctx.db.patch("tournaments", row._id, { doc: plain(doc) });
      }
    };

    let settled = false;
    if (n % WHOLE_EVERY !== 0) {
      const live = await ctx.db
        .query("matches")
        .withIndex("by_live_and_at", (q) => q.eq("live", true))
        .take(200);
      const due = await ctx.db
        .query("matches")
        .withIndex("by_live_and_at", (q) =>
          q
            .eq("live", false)
            .gte("at", sampleNow - 2 * HOUR)
            .lte("at", sampleNow),
        )
        .take(200);
      const matches = [...live, ...due.filter((row) => row.doc.status === "scheduled")];
      const tournaments: Rows<"tournaments"> = [];
      for (const key of new Set(matches.map((row) => row.doc.tournamentId))) {
        const row = await ctx.db
          .query("tournaments")
          .withIndex("by_key", (q) => q.eq("key", key))
          .first();
        if (row) tournaments.push(row);
      }
      const { world, next } = play(matches, tournaments);
      // A match that ended needs the matches around it; that is left to the whole look below.
      const ended = next.matches.some(
        (m, i) => m.status === "finished" && world.matches[i]?.status !== "finished",
      );
      if (!ended) {
        if (next !== world) await write(matches, tournaments, next);
        settled = true;
      }
    }
    if (!settled) {
      // The sample is a few hundred rows, and the ceilings say so.
      const matches = await ctx.db.query("matches").take(2000);
      const tournaments = await ctx.db.query("tournaments").take(200);
      const { world, next } = play(matches, tournaments);
      if (next !== world) await write(matches, tournaments, next);
    }
    await ctx.scheduler.runAfter(BEAT, internal.sample.beat, { generation, n: n + 1 });
    return null;
  },
});

/**
 * Start the sample again from its first moment:
 *
 *     npx convex run sample:reset
 */
export const reset = internalMutation({
  args: {},
  handler: async (ctx) => begin(ctx, "sample", Date.now()),
});

/**
 * Empty the store, keep only the list of games, and let the real sources fill it.
 *
 *     npx convex run sample:useLive
 */
export const useLive = internalMutation({
  args: {},
  handler: async (ctx) => begin(ctx, "live", Date.now()),
});
