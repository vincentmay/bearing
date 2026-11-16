import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { competitor, match, stint, tournament } from "./validators";

/**
 * Where every real source writes. A source maps its answers into the canonical model and hands
 * them over here in pieces small enough for one transaction each.
 *
 * A row that has not changed is not rewritten, because every write wakes the screens that read it.
 */

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

type Doc = Infer<typeof match>;

/**
 * One source knows who won a game; another knows what happened in it. When a match is written
 * again, what the store already knows about the inside of each game is kept unless the new
 * copy says it too.
 */
function keepDetail(before: Doc | undefined, fresh: Doc): Doc {
  if (!before) return fresh;
  return {
    ...fresh,
    games: fresh.games.map((game, i) => {
      const old = before.games[i];
      if (!old) return game;
      return {
        ...game,
        startedAt: game.startedAt ?? old.startedAt,
        firstSide: game.firstSide ?? old.firstSide,
        clock: game.clock ?? old.clock,
        scores: game.scores ?? old.scores,
        objectives: game.objectives ?? old.objectives,
        events: game.events ?? old.events,
        rounds: game.rounds ?? old.rounds,
        lines: game.lines ?? old.lines,
        draft: game.draft ?? old.draft,
      };
    }),
  };
}

/** True when the deployment is on real data and not in the middle of being reloaded. */
export const enabled = internalQuery({
  args: {},
  handler: async (ctx) => {
    const source = await ctx.db.query("source").first();
    return source?.kind === "live" && !source.loading;
  },
});

/** The fingerprints of what one event's source last handed over, by piece. */
export const digests = internalQuery({
  args: { scope: v.string() },
  returns: v.record(v.string(), v.string()),
  handler: async (ctx, { scope }) => {
    const rows = await ctx.db
      .query("digests")
      .withIndex("by_key", (q) => q.gte("key", `${scope}:`).lt("key", `${scope}:\uffff`))
      .take(500);
    return Object.fromEntries(rows.map((r) => [r.key, r.hash]));
  },
});

/** A fingerprint of a piece of data: equal pieces have equal ones, others all but never. */
export function fingerprint(value: unknown): string {
  const text = JSON.stringify(value);
  let a = 0x811c9dc5;
  let b = 0x1b873593;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul((b << 5) ^ (b >>> 27) ^ code, 0x85ebca6b);
  }
  return `${text.length.toString(36)}.${(a >>> 0).toString(36)}.${(b >>> 0).toString(36)}`;
}

export const put = internalMutation({
  args: {
    tournament: v.optional(tournament),
    competitors: v.optional(v.array(competitor)),
    stints: v.optional(v.array(stint)),
    matches: v.optional(v.array(match)),
    /** The fingerprint of this piece, kept so that the same piece need not be sent again. */
    digest: v.optional(v.object({ key: v.string(), hash: v.string() })),
  },
  handler: async (ctx, args) => {
    if (args.digest) {
      const { key, hash } = args.digest;
      const row = await ctx.db
        .query("digests")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
      if (!row) await ctx.db.insert("digests", { key, hash });
      else if (row.hash !== hash) await ctx.db.patch("digests", row._id, { hash });
    }
    for (const doc of args.competitors ?? []) {
      const row = await ctx.db
        .query("competitors")
        .withIndex("by_key", (q) => q.eq("key", doc.id))
        .first();
      if (!row) await ctx.db.insert("competitors", { key: doc.id, doc });
      else if (!same(row.doc, doc)) await ctx.db.patch("competitors", row._id, { doc });
    }
    for (const doc of args.stints ?? []) {
      const row = await ctx.db
        .query("stints")
        .withIndex("by_key", (q) => q.eq("key", doc.id))
        .first();
      if (!row) await ctx.db.insert("stints", { key: doc.id, doc });
      else if (!same(row.doc, doc)) await ctx.db.patch("stints", row._id, { doc });
    }
    for (const fresh of args.matches ?? []) {
      const row = await ctx.db
        .query("matches")
        .withIndex("by_key", (q) => q.eq("key", fresh.id))
        .first();
      const doc = keepDetail(row?.doc, fresh);
      const live = doc.status === "live";
      const at = Date.parse(doc.scheduledAt);
      if (!row) await ctx.db.insert("matches", { key: doc.id, live, at, doc });
      else if (!same(row.doc, doc)) await ctx.db.patch("matches", row._id, { live, at, doc });
    }
    const doc = args.tournament;
    if (doc) {
      const row = await ctx.db
        .query("tournaments")
        .withIndex("by_key", (q) => q.eq("key", doc.id))
        .first();
      // The time of checking differs on every run; alone it is no reason to write.
      const unchanged = row && same({ ...row.doc, provenance: null }, { ...doc, provenance: null });
      // Unchanged, but checked: the time of checking is written at most every half hour, so the
      // page can say when its facts were last confirmed without waking every screen each run.
      const stale =
        row &&
        Date.parse(doc.provenance.checkedAt) - Date.parse(row.doc.provenance.checkedAt) >
          30 * 60_000;
      if (!row) await ctx.db.insert("tournaments", { key: doc.id, doc });
      else if (!unchanged || stale) await ctx.db.patch("tournaments", row._id, { doc });
    }
  },
});

/**
 * A fresh look at matches that are under way or have just ended. What the store already knows
 * about where a match sits (its stage, its round, what it feeds) is kept; what is being played
 * is replaced. A match the store has never seen is left for the next full run.
 */
export const refreshMatches = internalMutation({
  args: { matches: v.array(match) },
  handler: async (ctx, args) => {
    for (const fresh of args.matches) {
      const row = await ctx.db
        .query("matches")
        .withIndex("by_key", (q) => q.eq("key", fresh.id))
        .first();
      if (!row) continue;
      const doc = {
        ...keepDetail(row.doc, fresh),
        tournamentId: row.doc.tournamentId,
        stageId: row.doc.stageId,
        roundId: row.doc.roundId,
        next: row.doc.next,
        // A side that was open may now be known; a known side never becomes unknown again.
        sides: fresh.sides.map((s, i) => (s.competitorId ? s : (row.doc.sides[i] ?? s))),
      };
      if (same(row.doc, doc)) continue;
      await ctx.db.patch("matches", row._id, {
        live: doc.status === "live",
        at: Date.parse(doc.scheduledAt),
        doc,
      });
    }
  },
});

/** The matches being played according to the store, for one source, by the source's own id. */
export const liveKeys = internalQuery({
  args: { prefix: v.string() },
  handler: async (ctx, { prefix }) => {
    const rows = await ctx.db
      .query("matches")
      .withIndex("by_live_and_at", (q) => q.eq("live", true))
      .take(500);
    return rows.filter((r) => r.key.startsWith(prefix)).map((r) => r.key);
  },
});

const MINUTE = 60_000;

/**
 * Once a minute: is anything being played, or about to be? Only then are the sources asked
 * again, now and half a minute from now, so a live match is never more than thirty seconds
 * behind. When nothing is on this is one cheap read and nothing else.
 */
export const tick = internalMutation({
  args: {},
  handler: async (ctx) => {
    const source = await ctx.db.query("source").first();
    if (source?.kind !== "live" || source.loading) return;
    const now = Date.now();
    const live = await ctx.db
      .query("matches")
      .withIndex("by_live_and_at", (q) => q.eq("live", true))
      .first();
    // Not yet marked live, but due: scheduled to have begun within the last few hours.
    const due = live
      ? null
      : (
          await ctx.db
            .query("matches")
            .withIndex("by_live_and_at", (q) =>
              q
                .eq("live", false)
                .gte("at", now - 240 * MINUTE)
                .lte("at", now + MINUTE),
            )
            .take(200)
        ).find((r) => r.doc.status === "scheduled");
    if (!live && !due) return;
    for (const delay of [0, 30_000]) {
      await ctx.scheduler.runAfter(delay, internal.pandascore.refresh, {});
      await ctx.scheduler.runAfter(delay, internal.lichess.refresh, {});
      // After the scores, what is happening inside the League games under way.
      await ctx.scheduler.runAfter(delay + 5_000, internal.lolesports.enrich, { live: true });
    }
  },
});
