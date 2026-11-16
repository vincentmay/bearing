import type { GameEvent } from "@bearing/domain";
import {
  type LolDetails,
  type LolEvent,
  type LolFrame,
  between,
  blueSide,
  findEvent,
  lookTimes,
  readGame,
  stateOf,
} from "@bearing/domain/lolesports";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";

/**
 * What happens inside a League of Legends game: kills, towers, dragons, barons and gold through
 * the game, added to matches the store already has from PandaScore.
 *
 * It reads the feed behind lolesports.com, which is not a documented API (see
 * `packages/domain/src/sources/lolesports.ts`). It needs the key that site sends with its own
 * requests, set on the deployment so that it can be changed or removed without a release:
 *
 *     npx convex env set LOLESPORTS_KEY <the x-api-key lolesports.com uses>
 *
 * Without it nothing here runs, and League matches show their series only.
 *
 * A game in progress is looked at every thirty seconds. A finished game that has no detail yet
 * is read once, a look a minute from start to end, and never again.
 */

const API = "https://esports-api.lolesports.com/persisted/gw";
const FEED = "https://feed.lolesports.com/livestats/v1";
const DAY = 24 * 60 * 60 * 1000;
/** Finished games are filled in for this long after they were played. */
const BACKFILL = 5 * DAY;
/** Games read whole in one run: each is about forty requests. */
const GAMES_PER_RUN = 3;
/** The feed runs a little behind the game; asking for the very last seconds returns nothing. */
const LAG = 50_000;

function key(): string | undefined {
  return process.env.LOLESPORTS_KEY || undefined;
}

async function api<T>(path: string, k: string): Promise<T | null> {
  const response = await fetch(`${API}/${path}`, { headers: { "x-api-key": k } });
  return response.ok ? ((await response.json()) as T) : null;
}

async function frames(gameId: string, startingTime?: string): Promise<LolFrame[]> {
  const query = startingTime ? `?startingTime=${startingTime}` : "";
  const response = await fetch(`${FEED}/window/${gameId}${query}`);
  if (!response.ok || response.status === 204) return [];
  const body = (await response.json().catch(() => null)) as { frames?: LolFrame[] } | null;
  return body?.frames ?? [];
}

const mark = (ms: number) =>
  new Date(Math.floor(ms / 10_000) * 10_000).toISOString().replace(".000Z", "Z");

/** League matches that are being played, or were played lately and still lack their detail. */
export const targets = internalQuery({
  args: {
    now: v.number(),
    /** Only what is being played now; the days behind it are not looked through. */
    live: v.boolean(),
  },
  handler: async (ctx, { now, live: liveOnly }) => {
    const tournaments = await ctx.db.query("tournaments").take(1000);
    const league = new Set(tournaments.filter((t) => t.doc.discipline === "lol").map((t) => t.key));
    const live = await ctx.db
      .query("matches")
      .withIndex("by_live_and_at", (q) => q.eq("live", true))
      .take(500);
    // Looking through the days behind is the costly part, and is left to the half-hourly run.
    const recent = liveOnly
      ? []
      : await ctx.db
          .query("matches")
          .withIndex("by_live_and_at", (q) =>
            q
              .eq("live", false)
              .gte("at", now - BACKFILL)
              .lte("at", now),
          )
          .take(2000);
    const wanted = [...live, ...recent].filter(
      (row) =>
        league.has(row.doc.tournamentId) &&
        row.doc.sides.length === 2 &&
        row.doc.sides.every((s) => s.competitorId) &&
        (row.doc.status === "live" ||
          row.doc.games.some((g) => g.status === "finished" && (!g.events || !g.lead))),
    );
    const out = [];
    for (const row of wanted.slice(0, 40)) {
      const sides = [];
      for (const side of row.doc.sides) {
        const team = await ctx.db
          .query("competitors")
          .withIndex("by_key", (q) => q.eq("key", side.competitorId ?? ""))
          .first();
        sides.push({
          name: team?.doc.kind === "team" ? team.doc.name : "",
          short: team?.doc.kind === "team" ? team.doc.short : "",
        });
      }
      out.push({
        key: row.key,
        scheduledAt: row.doc.scheduledAt,
        sides,
        games: row.doc.games.map((g) => ({
          status: g.status,
          startedAt: g.startedAt,
          clock: g.clock,
          // A finished game is known once its course is: what fell when, and the lead in gold.
          known: !!g.events && (g.status !== "finished" || !!g.lead),
          towers: g.objectives?.towers,
          dragons: g.objectives?.dragons,
          barons: g.objectives?.barons,
        })),
      });
    }
    return out;
  },
});

const numbers = v.array(v.number());
const event = v.object({
  at: v.number(),
  side: v.number(),
  kind: v.union(v.literal("goal"), v.literal("tower"), v.literal("dragon"), v.literal("baron")),
});

/** Write what was read of one game into its match. What PandaScore says of the game is kept. */
export const apply = internalMutation({
  args: {
    key: v.string(),
    index: v.number(),
    startedAt: v.optional(v.string()),
    firstSide: v.number(),
    clock: v.number(),
    scores: numbers,
    objectives: v.object({ towers: numbers, dragons: numbers, barons: numbers, gold: numbers }),
    /** The whole list for a game read from its start; only the new ones for a game in progress. */
    events: v.array(event),
    append: v.boolean(),
    /** The lead in gold by the minute, for a game read from its start. */
    lead: v.optional(numbers),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("matches")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    const game = row?.doc.games[args.index];
    if (!row || !game) return;
    const events: GameEvent[] = args.append
      ? [...(game.events ?? []), ...args.events]
      : args.events;
    // A game in progress gains the lead of the minute it is in; the minutes not looked at
    // take the lead before them.
    let lead = args.lead ?? game.lead;
    if (args.append) {
      const minute = Math.floor(args.clock / 60);
      const now = (args.objectives.gold[0] ?? 0) - (args.objectives.gold[1] ?? 0);
      lead = [...(game.lead ?? [])];
      while (lead.length < minute) lead.push(lead.at(-1) ?? 0);
      lead[minute] = now;
    }
    const games = row.doc.games.map((g, i) =>
      i === args.index
        ? {
            ...g,
            lead,
            startedAt: args.startedAt ?? g.startedAt,
            firstSide: args.firstSide,
            // A finished game keeps the length PandaScore gives it, which is the official one.
            clock: g.status === "finished" && g.clock ? g.clock : args.clock,
            scores: args.scores,
            objectives: args.objectives,
            events,
          }
        : g,
    );
    await ctx.db.patch("matches", row._id, { doc: { ...row.doc, games } });
  },
});

export const enrich = internalAction({
  args: {
    /** Asked for by the live tick: follow the games under way, and leave the past alone. */
    live: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const k = key();
    if (!k || !(await ctx.runQuery(internal.ingest.enabled, {}))) return;
    const now = Date.now();
    const wanted = await ctx.runQuery(internal.lolesports.targets, {
      now,
      live: args.live ?? false,
    });
    if (!wanted.length) return;

    // The schedule comes in pages around today; one page back covers the days being filled in.
    type Schedule = { data?: { schedule?: { events?: LolEvent[]; pages?: { older?: string } } } };
    const page = await api<Schedule>("getSchedule?hl=en-US", k);
    const events = [...(page?.data?.schedule?.events ?? [])];
    const older = page?.data?.schedule?.pages?.older;
    if (older) {
      const before = await api<Schedule>(`getSchedule?hl=en-US&pageToken=${older}`, k);
      events.push(...(before?.data?.schedule?.events ?? []));
    }

    let whole = 0;
    for (const match of wanted) {
      const found = findEvent(events, match.sides, match.scheduledAt);
      if (!found?.match) continue;
      const details = (
        await api<{ data?: { event?: LolDetails } }>(
          `getEventDetails?hl=en-US&id=${found.match.id}`,
          k,
        )
      )?.data?.event;
      if (!details) continue;

      for (const [index, game] of match.games.entries()) {
        const theirs = details.match.games.find((g) => g.number === index + 1);
        const blue = blueSide(details, index + 1, match.sides);
        if (!theirs || blue === undefined) continue;

        if (game.status === "live" && game.known && game.startedAt) {
          // Already being followed: one look, and whatever fell since the last one.
          const latest = (await frames(theirs.id, mark(now - LAG))).at(-1);
          if (!latest) continue;
          const state = stateOf(latest, Date.parse(game.startedAt), blue);
          const before = {
            ...state,
            clock: game.clock ?? state.clock,
            towers: game.towers ?? [0, 0],
            dragons: game.dragons ?? [0, 0],
            barons: game.barons ?? [0, 0],
          };
          await ctx.runMutation(internal.lolesports.apply, {
            key: match.key,
            index,
            firstSide: blue,
            clock: state.clock,
            scores: state.kills,
            objectives: {
              towers: state.towers,
              dragons: state.dragons,
              barons: state.barons,
              gold: state.gold,
            },
            events: between(before, state),
            append: true,
          });
          continue;
        }

        const wantsWhole =
          (game.status === "live" && !game.known) || (game.status === "finished" && !game.known);
        if (!wantsWhole || whole >= GAMES_PER_RUN) continue;
        // Not seen before: read it from its first moment, a look a minute.
        const first = await frames(theirs.id);
        if (!first.length) continue;
        whole++;
        const start = Date.parse(first[0]!.rfc460Timestamp);
        const looks: LolFrame[] = [first[0]!];
        for (const time of lookTimes(start, Math.min(now - LAG, start + 90 * 60_000))) {
          const frame = (await frames(theirs.id, time)).at(-1);
          if (!frame) break;
          looks.push(frame);
          if (frame.gameState === "finished") break;
        }
        const read = readGame(looks, blue);
        if (!read?.objectives || !read.scores) continue;
        await ctx.runMutation(internal.lolesports.apply, {
          key: match.key,
          index,
          startedAt: read.startedAt,
          firstSide: blue,
          clock: read.clock ?? 0,
          scores: read.scores,
          objectives: read.objectives,
          events: read.events ?? [],
          append: false,
          lead: read.lead,
        });
      }
    }
    // More finished games may be waiting; carry on shortly, a few at a time.
    if (whole >= GAMES_PER_RUN)
      await ctx.scheduler.runAfter(20_000, internal.lolesports.enrich, { live: args.live });
  },
});
