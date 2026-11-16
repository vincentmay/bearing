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
