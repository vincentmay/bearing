import type { DisciplineId, Match } from "@bearing/domain";
import {
  PANDA_GAMES,
  type PandaEdition,
  type PandaLeague,
  type PandaMatch,
  type PandaSerie,
  type PandaStage,
  mapLiveMatch,
  mapSerie,
  seriesToFollow,
} from "@bearing/domain/pandascore";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { type ActionCtx, internalAction } from "./_generated/server";

/**
 * Counter-Strike 2, League of Legends and Rocket League from PandaScore.
 *
 * It runs only on real data, and only when the deployment has a token:
 *
 *     npx convex env set PANDASCORE_TOKEN <token>
 *
 * Every hour, for each game, the editions with matches around now are read whole: stages,
 * matches, brackets, rosters. Between those runs `ingest.tick` asks for the matches under way.
 * The free plan allows 1,000 requests an hour; this uses about 300 on a busy one.
 */

const BASE = "https://api.pandascore.co";
/** The tiers that are followed: "s" is the top of the game, "d" the bottom. */
const TIERS = ["s", "a", "b"] as const;
/** Editions followed at once, per game. */
const SERIES = 10;
const CHUNK = 60;

/** Drop `undefined` fields, which the database has no word for. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function token(): string | undefined {
  return process.env.PANDASCORE_TOKEN || undefined;
}

async function get<T>(path: string, key: string): Promise<T | null> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (response.status === 429) throw new Error("PandaScore's hourly allowance is used up (429).");
  if (!response.ok) return null;
  return (await response.json()) as T;
}

type Listed = PandaMatch & {
  serie_id?: number;
  tournament?: { tier?: string | null };
  videogame?: { slug?: string };
};

async function store(ctx: ActionCtx, source: PandaSerie, discipline: DisciplineId) {
  const mapped = plain(mapSerie(source, discipline, Date.now()));
  for (let i = 0; i < mapped.competitors.length; i += CHUNK)
    await ctx.runMutation(internal.ingest.put, {
      competitors: mapped.competitors.slice(i, i + CHUNK),
    });
  for (let i = 0; i < mapped.stints.length; i += CHUNK)
    await ctx.runMutation(internal.ingest.put, { stints: mapped.stints.slice(i, i + CHUNK) });
  for (let i = 0; i < mapped.matches.length; i += CHUNK / 2)
    await ctx.runMutation(internal.ingest.put, { matches: mapped.matches.slice(i, i + CHUNK / 2) });
  await ctx.runMutation(internal.ingest.put, { tournament: mapped.tournament });
}

/** One game: find the editions worth following and read each of them whole. */
export const sync = internalAction({
  args: { game: v.string() },
  handler: async (ctx, { game }) => {
    const key = token();
    const entry = PANDA_GAMES.find((g) => g.slug === game);
    if (!key || !entry || !(await ctx.runQuery(internal.ingest.enabled, {}))) return;
    const lists = await Promise.all(
      ["running", "upcoming", "past"].map((kind) =>
        get<Listed[]>(`/${game}/matches/${kind}?per_page=100`, key),
      ),
    );
    const ids = seriesToFollow(
      lists.flatMap((l) => l ?? []),
      TIERS,
      SERIES,
    );
    for (const id of ids) {
      const stages = await get<(PandaStage & { league?: PandaLeague; serie?: PandaEdition })[]>(
        `/series/${id}/tournaments?per_page=50`,
        key,
      );
      const first = stages?.[0];
      if (!stages || !first?.league || !first.serie) continue;
      const matches: PandaMatch[] = [];
      for (let page = 1; page <= 5; page++) {
        const batch = await get<PandaMatch[]>(
          `/series/${id}/matches?per_page=100&page=${page}&sort=begin_at`,
          key,
        );
        matches.push(...(batch ?? []));
        if (!batch || batch.length < 100) break;
      }
      const brackets: PandaSerie["brackets"] = {};
      const rosters: PandaSerie["rosters"] = {};
      for (const stage of stages) {
        if (stage.has_bracket) {
          const bracket = await get<PandaMatch[]>(
            `/tournaments/${stage.id}/brackets?per_page=100`,
            key,
          );
          if (bracket) brackets[stage.id] = bracket;
        }
        const roster = await get<PandaSerie["rosters"][string]>(
          `/tournaments/${stage.id}/rosters`,
          key,
        );
        if (roster) rosters[stage.id] = roster;
      }
      await store(
        ctx,
        {
          league: first.league,
          serie: first.serie,
          tournaments: stages,
          matches,
          brackets,
          rosters,
        },
        entry.discipline,
      );
    }
  },
});

/** Every hour: each game in turn, a little apart, so that the requests are spread out. */
export const syncAll = internalAction({
  args: {},
  handler: async (ctx) => {
    if (!token() || !(await ctx.runQuery(internal.ingest.enabled, {}))) return;
    for (const [i, game] of PANDA_GAMES.entries())
      await ctx.scheduler.runAfter(i * 20_000, internal.pandascore.sync, { game: game.slug });
  },
});

/** The matches under way, and those the store still thinks are under way but are not. */
export const refresh = internalAction({
  args: {},
  handler: async (ctx) => {
    const key = token();
    if (!key || !(await ctx.runQuery(internal.ingest.enabled, {}))) return;
    const running = (await get<Listed[]>("/matches/running?per_page=100", key)) ?? [];
    const fresh: Match[] = [];
    const seen = new Set<string>();
    const take = (m: Listed) => {
      const game = PANDA_GAMES.find((g) => g.videogame === m.videogame?.slug);
      const mapped = game ? mapLiveMatch(m, game.discipline) : null;
      if (!mapped) return;
      fresh.push(mapped);
      seen.add(mapped.id);
    };
    for (const m of running) take(m);
    // A match that has dropped out of the running list has ended: read its result.
    const before = await ctx.runQuery(internal.ingest.liveKeys, { prefix: "ps-match-" });
    for (const id of before.filter((k) => !seen.has(k)).slice(0, 20)) {
      const m = await get<Listed>(`/matches/${id.slice("ps-match-".length)}`, key);
      if (m) take(m);
    }
    if (fresh.length)
      await ctx.runMutation(internal.ingest.refreshMatches, { matches: plain(fresh) });
  },
});
