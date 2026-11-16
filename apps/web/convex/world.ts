import { SAMPLE_NOW } from "@bearing/domain/sample";
import { type Infer, v } from "convex/values";
import { type QueryCtx, query } from "./_generated/server";
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
  returns: v.boolean(),
  handler: async (ctx) => (await usable(ctx)) !== null,
});

/** Everything but the matches: games, organisations, teams and players, events, rankings. */
export const frame = query({
  args: {},
  returns: v.object({
    /** False while the store is being loaded: there is nothing to show yet, ask again. */
    ready: v.boolean(),
    clock: v.union(v.null(), v.object({ pinned: v.string(), since: v.number() })),
    disciplines: v.array(discipline),
    organizations: v.array(organization),
    rankings: v.array(ranking),
    stints: v.array(stint),
    competitors: v.array(competitor),
    tournaments: v.array(tournament),
  }),
  handler: async (ctx) => {
    const source = await usable(ctx);
    if (!source) {
      return {
        ready: false,
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
      ready: true,
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
  returns: v.array(match),
  handler: async (ctx, { since }) => {
    if (!(await usable(ctx))) return [];
    const rows = await ctx.db
      .query("matches")
      .withIndex("by_live_and_at", (q) => q.eq("live", false).gte("at", since))
      .take(4000);
    return rows.map((r) => light(r.doc));
  },
});

type Doc = Infer<typeof match>;

/**
 * A match as a list needs it: who, when, the score of every game. What happened inside a game
 * (rounds, the players' lines, the draft, the moves) is most of a match's weight and is wanted
 * by one page at a time, so it is left out here and asked for with `detail`.
 */
const INSIDE = ["rounds", "lines", "events", "draft", "lead", "moves", "objectives"] as const;

function light(doc: Doc): Doc {
  return {
    ...doc,
    games: doc.games.map((game) => {
      const rest = { ...game };
      for (const part of INSIDE) delete rest[part];
      return rest;
    }),
  };
}

/** Matches whole, with everything known of the inside of their games. At most eighty at once. */
export const detail = query({
  args: { ids: v.array(v.string()) },
  returns: v.array(match),
  handler: async (ctx, { ids }) => {
    if (!(await usable(ctx))) return [];
    const out: Doc[] = [];
    for (const id of ids.slice(0, 80)) {
      const row = await ctx.db
        .query("matches")
        .withIndex("by_key", (q) => q.eq("key", id))
        .first();
      if (row) out.push(row.doc);
    }
    return out;
  },
});

/** Matches being played right now. */
export const live = query({
  args: {},
  returns: v.array(match),
  handler: async (ctx) => {
    if (!(await usable(ctx))) return [];
    const rows = await ctx.db
      .query("matches")
      .withIndex("by_live_and_at", (q) => q.eq("live", true))
      .take(500);
    return rows.map((r) => r.doc);
  },
});
