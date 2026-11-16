import { SAMPLE_NOW } from "@bearing/domain/sample";
import { v } from "convex/values";
import { type QueryCtx, query } from "./_generated/server";

/**
 * The world is read in three parts so that what changes often is small. A goal in a live match
 * re-sends the live matches only; the frame and the settled matches stay as they are.
 *
 * None of the three reads anything that changes on a timer, so a screen is sent new data only
 * when the world itself has changed. Every read has a ceiling: what is kept is trimmed by
 * `retention.ts`, and the ceilings are what holds if that ever falls behind.
 */

/** The store can be read: it has been loaded, and is not in the middle of being reloaded. */
async function usable(ctx: QueryCtx) {
  const source = await ctx.db.query("source").first();
  return source && !source.loading ? source : null;
}

export const ready = query({
  args: {},
  handler: async (ctx) => (await usable(ctx)) !== null,
});

/** Everything but the matches: games, organisations, teams and players, events, rankings. */
export const frame = query({
  args: {},
  handler: async (ctx) => {
    const source = await usable(ctx);
    if (!source) {
      return {
        clock: null,
        disciplines: [],
        organizations: [],
        rankings: [],
        stints: [],
        competitors: [],
        tournaments: [],
      };
    }
    const [disciplines, organizations, rankings, stints, competitors, tournaments] =
      await Promise.all([
        ctx.db.query("disciplines").take(50),
        ctx.db.query("organizations").take(2000),
        ctx.db.query("rankings").take(100),
        ctx.db.query("stints").take(8000),
        ctx.db.query("competitors").take(8000),
        ctx.db.query("tournaments").take(1000),
      ]);
    return {
      // Sample data has a pinned instant that moves on from the moment it was loaded. Real data
      // lives in real time and has no clock of its own.
      clock: source.kind === "sample" ? { pinned: SAMPLE_NOW, since: source.loadedAt } : null,
      disciplines: disciplines.map((d) => d.doc),
      organizations: organizations.map((d) => d.doc),
      rankings: rankings.map((d) => d.doc),
      stints: stints.map((d) => d.doc),
      competitors: competitors.map((d) => d.doc),
      tournaments: tournaments.map((d) => d.doc),
    };
  },
});

/**
 * Matches that are over or have not begun, from `since` on. The screen passes the start of a
 * day some weeks back, so the window is the same for everyone and only moves once a day.
 */
export const settled = query({
  args: { since: v.number() },
  handler: async (ctx, { since }) => {
    if (!(await usable(ctx))) return [];
    const rows = await ctx.db
      .query("matches")
      .withIndex("by_live_and_at", (q) => q.eq("live", false).gte("at", since))
      .take(4000);
    return rows.map((r) => r.doc);
  },
});

/** Matches being played right now. */
export const live = query({
  args: {},
  handler: async (ctx) => {
    if (!(await usable(ctx))) return [];
    const rows = await ctx.db
      .query("matches")
      .withIndex("by_live_and_at", (q) => q.eq("live", true))
      .take(500);
    return rows.map((r) => r.doc);
  },
});
