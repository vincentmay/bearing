import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  competitor,
  discipline,
  follow,
  match,
  organization,
  ranking,
  stint,
  tournament,
} from "./validators";

/**
 * Bearing's own store. The screens only ever read this; sources are mapped into it.
 *
 * An entity is kept whole in `doc`, validated against the canonical model, with the few fields
 * that queries select by copied next to it.
 */
export default defineSchema({
  /** One row: where the data comes from. It changes only when the store is reloaded. */
  source: defineTable({
    kind: v.union(v.literal("sample"), v.literal("live")),
    /** When the store was last loaded. The sample's pinned instant moves forward from here. */
    loadedAt: v.number(),
    /** Raised on every reload, so that whatever was running for the old data stops itself. */
    generation: v.number(),
    /** True while a reload is under way; the world reads as empty until it is done. */
    loading: v.boolean(),
  }),
  /**
   * One row: whether anyone is looking. It changes often, so it is kept apart from everything
   * the screens read.
   */
  watch: defineTable({
    /** The sample is played forward until this moment, then rests until someone looks again. */
    until: v.number(),
    running: v.boolean(),
  }),
  disciplines: defineTable({ doc: discipline }),
  organizations: defineTable({ doc: organization }),
  rankings: defineTable({ doc: ranking }),
  stints: defineTable({ key: v.string(), doc: stint }).index("by_key", ["key"]),
  competitors: defineTable({ key: v.string(), doc: competitor }).index("by_key", ["key"]),
  tournaments: defineTable({ key: v.string(), doc: tournament }).index("by_key", ["key"]),
  matches: defineTable({
    key: v.string(),
    /** Live matches change every few seconds; the rest hardly ever. They are read apart. */
    live: v.boolean(),
    /** When it is scheduled, in milliseconds, so that a screen can ask for a window of time. */
    at: v.number(),
    doc: match,
  })
    .index("by_key", ["key"])
    .index("by_live_and_at", ["live", "at"]),
  /**
   * The written record of a game of chess: its moves, and what is noted beside them. Kept
   * apart from the match it belongs to, which is read by every list and rewritten whenever
   * anything about it changes; a record is written once, when its game is over, and read by
   * the one page that shows the game.
   */
  records: defineTable({
    key: v.string(),
    moves: v.array(v.string()),
    evals: v.optional(v.array(v.number())),
    clocks: v.optional(v.array(v.number())),
  }).index("by_key", ["key"]),
  /**
   * What a source last handed over, piece by piece, as a fingerprint. A piece that has not
   * changed since is not handed over again, so nothing is read to find that out.
   */
  digests: defineTable({ key: v.string(), hash: v.string() }).index("by_key", ["key"]),
  /**
   * Every series two teams have played against each other, as far back as a source has them.
   * Kept apart from the matches: it is asked for by pair, and reaches back years.
   */
  meetings: defineTable({
    /** The two competitors' ids in a fixed order, joined by a bar. */
    key: v.string(),
    checkedAt: v.number(),
    games: v.array(
      v.object({
        id: v.string(),
        at: v.string(),
        event: v.string(),
        score: v.array(v.number()),
        winner: v.optional(v.number()),
      }),
    ),
  }).index("by_key", ["key"]),
  /**
   * A team's latest finished series, as far back as a hundred of them: more than the weeks of
   * matches the store itself keeps. Asked for when the team is about to play.
   */
  histories: defineTable({
    /** The team's id. */
    key: v.string(),
    checkedAt: v.number(),
    games: v.array(
      v.object({
        id: v.string(),
        at: v.string(),
        event: v.string(),
        /** The other side: its id as the store would name it, its name, its mark. */
        opponentId: v.string(),
        opponent: v.string(),
        image: v.optional(v.string()),
        /** Series score: the team's own, then the other side's. */
        score: v.array(v.number()),
        won: v.optional(v.boolean()),
      }),
    ),
  }).index("by_key", ["key"]),
  /** What a signed-in viewer follows. An account holds this and nothing else. */
  follows: defineTable({
    /** The identity's token identifier, as issued by the sign-in provider. */
    user: v.string(),
    kind: follow.fields.kind,
    target: v.string(),
  })
    .index("by_user", ["user"])
    .index("by_user_and_kind_and_target", ["user", "kind", "target"]),
});
