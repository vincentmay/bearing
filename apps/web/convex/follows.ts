import type { Follow } from "@bearing/domain";
import { ConvexError, v } from "convex/values";
import { type MutationCtx, type QueryCtx, mutation, query } from "./_generated/server";
import { follow } from "./validators";

/**
 * What a signed-in viewer follows. This is all an account holds here: no profile, no history.
 * Every function works on the caller's own rows and nobody else's.
 */

/** More than anyone follows by hand; a ceiling so that an account cannot be used as storage. */
const LIMIT = 500;

async function caller(ctx: QueryCtx | MutationCtx): Promise<string | null> {
  return (await ctx.auth.getUserIdentity())?.tokenIdentifier ?? null;
}

async function signedIn(ctx: MutationCtx): Promise<string> {
  const user = await caller(ctx);
  if (!user) throw new ConvexError("Sign in to keep what you follow on every device.");
  return user;
}

async function rowsOf(ctx: QueryCtx | MutationCtx, user: string) {
  return ctx.db
    .query("follows")
    .withIndex("by_user", (q) => q.eq("user", user))
    .take(LIMIT);
}

/** The caller's follows, or null when nobody is signed in. */
export const list = query({
  args: {},
  handler: async (ctx): Promise<Follow[] | null> => {
    const user = await caller(ctx);
    if (!user) return null;
    return (await rowsOf(ctx, user)).map((r) => ({ kind: r.kind, id: r.target }));
  },
});

/** Follow something, or stop following it. */
export const toggle = mutation({
  args: { follow },
  handler: async (ctx, args) => {
    const user = await signedIn(ctx);
    const { kind, id } = args.follow;
    if (id.length > 200) throw new ConvexError("That is not something that can be followed.");
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_user_and_kind_and_target", (q) =>
        q.eq("user", user).eq("kind", kind).eq("target", id),
      )
      .first();
    if (existing) {
      await ctx.db.delete("follows", existing._id);
      return;
    }
    if ((await rowsOf(ctx, user)).length >= LIMIT) {
      throw new ConvexError(`An account can follow up to ${LIMIT} things.`);
    }
    await ctx.db.insert("follows", { user, kind, target: id });
  },
});

/**
 * Carry follows made on a device into the account. Called once after signing in: what the
 * device had is added to what the account has, and nothing is taken away.
 */
export const merge = mutation({
  args: { follows: v.array(follow) },
  handler: async (ctx, args) => {
    const user = await signedIn(ctx);
    const rows = await rowsOf(ctx, user);
    const have = new Set(rows.map((r) => `${r.kind}:${r.target}`));
    let room = LIMIT - rows.length;
    for (const f of args.follows) {
      const key = `${f.kind}:${f.id}`;
      if (room <= 0 || have.has(key) || f.id.length > 200) continue;
      await ctx.db.insert("follows", { user, kind: f.kind, target: f.id });
      have.add(key);
      room--;
    }
  },
});

/** Remove everything this account holds here. */
export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await signedIn(ctx);
    for (const row of await rowsOf(ctx, user)) await ctx.db.delete("follows", row._id);
  },
});
