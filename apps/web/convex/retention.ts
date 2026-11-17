import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

/**
 * Real data only grows: every hour brings new rounds and new players. Once a day what is long
 * over is removed, so that the world a screen reads stays a few weeks wide. The sample is left
 * alone; it is reloaded whole.
 */

const DAY = 24 * 60 * 60 * 1000;
/** How long a finished match and its event are kept. */
const KEEP = 60 * DAY;
const BATCH = 200;

export const prune = internalMutation({
  args: {},
  handler: async (ctx) => {
    const source = await ctx.db.query("source").first();
    if (source?.kind !== "live" || source.loading) return;
    const before = Date.now() - KEEP;

    const old = await ctx.db
      .query("matches")
      .withIndex("by_live_and_at", (q) => q.eq("live", false).lt("at", before))
      .take(BATCH);
    for (const row of old) {
      // The written records of its games of chess go with the match.
      for (const game of row.doc.games) {
        const key = game.ref ? `lichess-${game.ref.split("/").at(-1)}` : undefined;
        const record = key
          ? await ctx.db
              .query("records")
              .withIndex("by_key", (q) => q.eq("key", key))
              .first()
          : null;
        if (record) await ctx.db.delete("records", record._id);
      }
      await ctx.db.delete("matches", row._id);
    }
    if (old.length === BATCH) {
      // More to do: carry on in a new transaction.
      await ctx.scheduler.runAfter(0, internal.retention.prune, {});
      return;
    }

    const cutoff = new Date(before).toISOString().slice(0, 10);
    const tournaments = await ctx.db.query("tournaments").take(1000);
    const kept = new Set<string>();
    for (const row of tournaments) {
      if (row.doc.end < cutoff) await ctx.db.delete("tournaments", row._id);
      else for (const id of row.doc.participantIds) kept.add(id);
    }
    for (const row of await ctx.db.query("stints").take(8000)) {
      kept.add(row.doc.playerId);
      kept.add(row.doc.teamId);
    }
    // Teams and players that no remaining event knows of.
    let removed = 0;
    for (const row of await ctx.db.query("competitors").take(8000)) {
      if (kept.has(row.key)) continue;
      await ctx.db.delete("competitors", row._id);
      if (++removed === BATCH * 5) {
        await ctx.scheduler.runAfter(0, internal.retention.prune, {});
        return;
      }
    }
  },
});
