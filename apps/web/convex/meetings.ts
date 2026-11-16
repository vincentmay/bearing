import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";

/**
 * How two teams have done against each other before: every series between them that PandaScore
 * has on record, which reaches back years. It is asked for a pair when they are about to meet,
 * are playing, or have just played, and then kept; the store's own matches only go back weeks.
 *
 * One pair costs up to three requests to PandaScore, a breath apart.
 */

const BASE = "https://api.pandascore.co";
const DAY = 24 * 60 * 60 * 1000;
/** Pairs looked up in one run. */
const PAIRS_PER_RUN = 8;
/** A pair's history is asked for again after this long, so that a new meeting gets in. */
const FRESH = 3 * DAY;
/** How far back one team's matches are read: a hundred a page. */
const PAGES = 3;

const meeting = v.object({
  /** The match as the store would name it, so that one it has can be linked. */
  id: v.string(),
  at: v.string(),
  event: v.string(),
  /** Series score, in the order of the pair's two ids. */
  score: v.array(v.number()),
  /** Which of the two won: 0 or 1; absent for a draw or an unknown end. */
  winner: v.optional(v.number()),
});

const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** The two ids in a fixed order, so that a pair has one name whoever is named first. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** What is on record between two competitors, the latest first, as `a` and `b` were given. */
export const between = query({
  args: { a: v.string(), b: v.string() },
  returns: v.union(v.null(), v.array(meeting)),
  handler: async (ctx, { a, b }) => {
    const row = await ctx.db
      .query("meetings")
      .withIndex("by_key", (q) => q.eq("key", pairKey(a, b)))
      .first();
    if (!row) return null;
    const turned = a > b;
    return row.games.map((g) =>
      turned
        ? {
            ...g,
            score: [...g.score].reverse(),
            winner: g.winner === undefined ? undefined : 1 - g.winner,
          }
        : g,
    );
  },
});

/** Pairs of teams that meet around now and whose history is missing or has gone stale. */
export const wanted = internalQuery({
  args: { now: v.number() },
  returns: v.array(v.object({ a: v.string(), b: v.string() })),
  handler: async (ctx, { now }) => {
    const live = await ctx.db
      .query("matches")
      .withIndex("by_live_and_at", (q) => q.eq("live", true))
      .take(200);
    const near = await ctx.db
      .query("matches")
      .withIndex("by_live_and_at", (q) =>
        q
          .eq("live", false)
          .gte("at", now - 2 * DAY)
          .lte("at", now + 4 * DAY),
      )
      .take(600);
    const out: { a: string; b: string }[] = [];
    const seen = new Set<string>();
    for (const row of [...live, ...near]) {
      const [x, y] = row.doc.sides.map((s) => s.competitorId);
      if (row.doc.sides.length !== 2 || !x || !y) continue;
      if (!x.startsWith("ps-team-") || !y.startsWith("ps-team-")) continue;
      const key = pairKey(x, y);
      if (seen.has(key)) continue;
      seen.add(key);
      const held = await ctx.db
        .query("meetings")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
      if (held && now - held.checkedAt < FRESH) continue;
      const [a, b] = key.split("|") as [string, string];
      out.push({ a, b });
      if (out.length >= PAIRS_PER_RUN) break;
    }
    return out;
  },
});

export const put = internalMutation({
  args: { a: v.string(), b: v.string(), games: v.array(meeting) },
  returns: v.null(),
  handler: async (ctx, { a, b, games }) => {
    const key = pairKey(a, b);
    const row = await ctx.db
      .query("meetings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    const doc = { key, checkedAt: Date.now(), games };
    if (row) await ctx.db.replace("meetings", row._id, doc);
    else await ctx.db.insert("meetings", doc);
    return null;
  },
});

interface Listed {
  id: number;
  begin_at?: string | null;
  scheduled_at?: string | null;
  league?: { name?: string };
  serie?: { full_name?: string; name?: string | null };
  opponents?: { opponent?: { id?: number } }[];
  results?: { team_id?: number; score?: number }[];
  winner_id?: number | null;
}

export const sync = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const token = process.env.PANDASCORE_TOKEN;
    if (!token || !(await ctx.runQuery(internal.ingest.enabled, {}))) return null;
    const pairs: { a: string; b: string }[] = await ctx.runQuery(internal.meetings.wanted, {
      now: Date.now(),
    });
    for (const { a, b } of pairs) {
      const [idA, idB] = [a, b].map((id) => Number(id.slice("ps-team-".length))) as [
        number,
        number,
      ];
      const games = [];
      for (let page = 1; page <= PAGES; page++) {
        await pause(700);
        const response = await fetch(
          `${BASE}/teams/${idA}/matches?filter[status]=finished&sort=-begin_at&per_page=100&page=${page}`,
          { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
        ).catch(() => null);
        // The hour's allowance is used up, or no answer: stop, and carry on next time.
        if (!response || response.status === 429) return null;
        const list = response.ok ? ((await response.json().catch(() => [])) as Listed[]) : [];
        for (const m of list) {
          if (!m.opponents?.some((o) => o.opponent?.id === idB)) continue;
          const at = m.begin_at ?? m.scheduled_at;
          if (!at) continue;
          const score = [idA, idB].map(
            (id) => m.results?.find((r) => r.team_id === id)?.score ?? 0,
          );
          games.push({
            id: `ps-match-${m.id}`,
            at,
            event: [m.league?.name, m.serie?.full_name ?? m.serie?.name].filter(Boolean).join(" "),
            score,
            winner: m.winner_id === idA ? 0 : m.winner_id === idB ? 1 : undefined,
          });
        }
        if (list.length < 100) break;
      }
      await ctx.runMutation(internal.meetings.put, { a, b, games });
    }
    return null;
  },
});
