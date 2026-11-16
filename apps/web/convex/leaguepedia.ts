import {
  type LpGame,
  type LpPlayer,
  championKeys,
  type LpPlace,
  findGames,
  gamesUrl,
  placePage,
  placesOfUrl,
  placesUrl,
  playersUrl,
  readGame,
  readPlaces,
  rowsOf,
} from "@bearing/domain/leaguepedia";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { game, tournament } from "./validators";

/**
 * The draft and every player's line of a League of Legends game, added to matches the store
 * already has. Read from Leaguepedia (lol.fandom.com), a wiki kept by volunteers under
 * CC BY-SA 3.0 with an open query interface; see `packages/domain/src/sources/leaguepedia.ts`.
 * It asks for no key.
 *
 * A game is there once someone has entered it, so this looks once an hour at the finished games
 * of the last days that still lack their lines. The pictures of the champions come from the
 * game's own public files (Data Dragon); only the name they are filed under is kept.
 */

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
/** Series looked at in one run; the run carries on further back while it finds something. */
const SERIES_PER_RUN = 12;
/** Leaguepedia is asked one question at a time, with a breath between. */
const BREATH = 3000;
const AGENT = { "User-Agent": "Bearing (esports schedule viewer)" };

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The rows of an answer; null when the wiki failed, which ends the run. The wiki allows a
 * visitor without an account only a few questions in a row: told to wait, this waits and asks
 * again, longer each time.
 */
async function ask<T>(url: string): Promise<T[] | null> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await fetch(url, { headers: AGENT }).catch(() => null);
    if (!response?.ok) return null;
    const body = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
    if (!body) return null;
    if (!body.error) return rowsOf<T>(body);
    if (body.error.code !== "ratelimited") return null;
    await pause(attempt * 6000);
  }
  return null;
}

/** Finished League series that still lack their lines, the latest first. */
export const targets = internalQuery({
  args: { from: v.number(), to: v.number() },
  returns: v.array(
    v.object({
      key: v.string(),
      at: v.number(),
      scheduledAt: v.string(),
      sides: v.array(
        v.object({
          name: v.string(),
          short: v.string(),
          players: v.array(v.object({ id: v.string(), handle: v.string() })),
        }),
      ),
      games: v.array(
        v.object({ status: v.string(), winner: v.optional(v.number()), known: v.boolean() }),
      ),
    }),
  ),
  handler: async (ctx, { from, to }) => {
    const tournaments = await ctx.db.query("tournaments").take(1000);
    const league = new Set(tournaments.filter((t) => t.doc.discipline === "lol").map((t) => t.key));
    const rows = await ctx.db
      .query("matches")
      .withIndex("by_live_and_at", (q) => q.eq("live", false).gte("at", from).lte("at", to))
      .order("desc")
      .take(1500);
    const wanted = rows
      .filter(
        (row) =>
          league.has(row.doc.tournamentId) &&
          row.doc.sides.length === 2 &&
          row.doc.sides.every((s) => s.competitorId) &&
          row.doc.games.some((g) => g.status === "finished" && !g.lines),
      )
      .slice(0, SERIES_PER_RUN);
    if (!wanted.length) return [];

    const [competitors, stints] = await Promise.all([
      ctx.db.query("competitors").take(8000),
      ctx.db.query("stints").take(8000),
    ]);
    const byId = new Map(competitors.map((c) => [c.key, c.doc]));
    return wanted.map((row) => ({
      key: row.key,
      at: row.at,
      scheduledAt: row.doc.scheduledAt,
      sides: row.doc.sides.map((side) => {
        const team = byId.get(side.competitorId ?? "");
        return {
          name: team?.kind === "team" ? team.name : "",
          short: team?.kind === "team" ? team.short : "",
          // Everyone who is or was in the team: a line may be a player who has since left.
          players: stints
            .filter((s) => s.doc.teamId === side.competitorId)
            .flatMap((s) => {
              const player = byId.get(s.doc.playerId);
              return player?.kind === "player" ? [{ id: player.id, handle: player.handle }] : [];
            }),
        };
      }),
      games: row.doc.games.map((g) => ({
        status: g.status,
        winner: typeof g.winner === "number" ? g.winner : undefined,
        known: !!g.lines,
      })),
    }));
  },
});

interface Target {
  key: string;
  at: number;
  scheduledAt: string;
  sides: { name: string; short: string; players: { id: string; handle: string }[] }[];
  games: { status: string; winner?: number; known: boolean }[];
}

const numbers = v.array(v.number());

/** Write what the wiki says of a series' games into the match. What is already known stays. */
export const apply = internalMutation({
  args: {
    key: v.string(),
    games: v.array(
      v.object({
        index: v.number(),
        firstSide: v.number(),
        draft: game.fields.draft,
        lines: game.fields.lines,
        scores: v.optional(numbers),
        objectives: game.fields.objectives,
        clock: v.optional(v.number()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("matches")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (!row) return null;
    const games = row.doc.games.map((g, i) => {
      const read = args.games.find((x) => x.index === i);
      if (!read || g.status !== "finished") return g;
      return {
        ...g,
        firstSide: g.firstSide ?? read.firstSide,
        draft: read.draft ?? g.draft,
        lines: read.lines ?? g.lines,
        // The feed of the game itself, where it was read, is the finer record of these.
        scores: g.scores ?? read.scores,
        objectives: g.objectives ?? read.objectives,
        clock: g.clock ?? read.clock,
      };
    });
    await ctx.db.patch("matches", row._id, { doc: { ...row.doc, games } });
    return null;
  },
});

export const enrich = internalAction({
  args: {
    /** How far back to look, in days. A longer look is asked for by hand, to fill in the past. */
    days: v.optional(v.number()),
    /** Only series scheduled before this moment: how a run carries on where the last one ended. */
    before: v.optional(v.number()),
    /** How often a run of this chain was cut short by the wiki; after a few it gives up. */
    stumbles: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!(await ctx.runQuery(internal.ingest.enabled, {}))) return null;
    const now = Date.now();
    const days = Math.min(Math.max(args.days ?? 4, 1), 120);
    const to = args.before ?? now;
    const wanted: Target[] = await ctx.runQuery(internal.leaguepedia.targets, {
      from: now - days * DAY,
      to,
    });
    if (!wanted.length) return null;

    // The games of each day that has a series waiting, asked for once per day.
    const asked = new Map<number, LpGame[]>();
    const gamesOn = async (at: number): Promise<LpGame[] | null> => {
      const day = Math.floor(at / DAY);
      const known = asked.get(day);
      if (known) return known;
      await pause(BREATH);
      const rows = await ask<LpGame>(gamesUrl(day * DAY - 6 * HOUR, (day + 1) * DAY + 12 * HOUR));
      if (rows) asked.set(day, rows);
      return rows;
    };

    // A run has minutes, not hours: past this moment it writes what it has and hands over.
    const until = now + 4 * 60_000;
    let stumbled = false;
    /** The oldest series this run got to; the next run carries on behind it. */
    let reached: number | undefined;
    const found: { match: Target; games: LpGame[] }[] = [];
    for (const match of wanted) {
      if (Date.now() > until) break;
      const rows = await gamesOn(match.at);
      if (!rows) {
        stumbled = true;
        break;
      }
      reached = match.at;
      const games = findGames(rows, match.sides, match.scheduledAt);
      if (games.length) found.push({ match, games });
    }

    if (found.length) {
      // Where the champions' pictures are filed, by the game's current version.
      const versions = (await fetch("https://ddragon.leagueoflegends.com/api/versions.json")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)) as string[] | null;
      const patch = Array.isArray(versions) ? versions[0] : undefined;
      const list: unknown = patch
        ? await fetch(`https://ddragon.leagueoflegends.com/cdn/${patch}/data/en_US/champion.json`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        : null;
      const art = patch && list ? { patch, keys: championKeys(list) } : undefined;

      const ids = found.flatMap((f) => f.games.map((g) => g.id));
      const players: LpPlayer[] = [];
      for (let i = 0; i < ids.length; i += 25) {
        await pause(BREATH);
        const rows = await ask<LpPlayer>(playersUrl(ids.slice(i, i + 25)));
        // The games whose lines did not arrive are simply still waiting next time.
        if (!rows) {
          stumbled = true;
          break;
        }
        players.push(...rows);
      }

      for (const { match, games } of found) {
        const sides = match.sides.map((s) => ({ name: s.name, short: s.short }));
        const rosters = match.sides.map((s) => s.players);
        const read = games.flatMap((g) => {
          const index = Number(g.n) - 1;
          const ours = match.games[index];
          const game = readGame(g, players, sides, rosters, art);
          if (!ours || ours.status !== "finished" || ours.known || !game?.lines) return [];
          return [{ index, game }];
        });
        // A series whose winners do not agree with what the store has is some other series.
        if (read.some(({ index, game }) => match.games[index]?.winner !== game.winner)) continue;
        if (!read.length) continue;
        await ctx.runMutation(internal.leaguepedia.apply, {
          key: match.key,
          games: read.map(({ index, game }) => ({
            index,
            firstSide: game.firstSide ?? 0,
            draft: game.draft,
            lines: game.lines,
            scores: game.scores,
            objectives: game.objectives,
            clock: game.clock,
          })),
        });
      }
    }

    // There may be more behind: carry on from the oldest series this run got to. A run the
    // wiki cut short waits a while first, and after three of those the chain ends.
    const stumbles = (args.stumbles ?? 0) + (stumbled ? 1 : 0);
    const more = wanted.length >= SERIES_PER_RUN || reached !== wanted.at(-1)!.at;
    if (more && stumbles <= 3 && (reached ?? to) > now - days * DAY)
      await ctx.scheduler.runAfter(stumbled ? 90_000 : 5000, internal.leaguepedia.enrich, {
        days,
        before: reached === undefined ? to : reached - 1,
        stumbles,
      });
    return null;
  },
});

/**
 * Who finished where, and what each place paid, for League events that are over: from the
 * wiki's table of final places. An event is asked about once, a day or more after it ended.
 */
export const unplaced = internalQuery({
  args: { now: v.number() },
  returns: v.array(
    v.object({
      key: v.string(),
      end: v.string(),
      currency: v.optional(v.string()),
      winner: v.optional(v.string()),
      teams: v.array(v.object({ id: v.string(), name: v.string(), short: v.string() })),
    }),
  ),
  handler: async (ctx, { now }) => {
    const asked = await ctx.db
      .query("digests")
      .withIndex("by_key", (q) => q.gte("key", "placed:").lt("key", "placed:\uffff"))
      .take(1000);
    const done = new Set(asked.map((row) => row.key.slice("placed:".length)));
    const today = new Date(now - DAY).toISOString().slice(0, 10);
    const events = (await ctx.db.query("tournaments").take(1000)).filter(
      (row) => row.doc.discipline === "lol" && row.doc.end < today && !done.has(row.key),
    );
    const out = [];
    for (const row of events.slice(0, 6)) {
      const teams = [];
      for (const id of row.doc.participantIds.slice(0, 64)) {
        const team = await ctx.db
          .query("competitors")
          .withIndex("by_key", (q) => q.eq("key", id))
          .first();
        if (team?.doc.kind === "team")
          teams.push({ id, name: team.doc.name, short: team.doc.short });
      }
      out.push({
        key: row.key,
        end: row.doc.end,
        currency: row.doc.prize?.currency,
        winner: row.doc.placements?.find((p) => p.rank === 1)?.competitorIds[0],
        teams,
      });
    }
    return out;
  },
});

export const setPlaces = internalMutation({
  args: {
    key: v.string(),
    placements: v.optional(tournament.fields.placements),
    prize: tournament.fields.prize,
  },
  returns: v.null(),
  handler: async (ctx, { key, placements, prize }) => {
    await ctx.db.insert("digests", { key: `placed:${key}`, hash: placements ? "found" : "none" });
    const row = await ctx.db
      .query("tournaments")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (row && placements)
      await ctx.db.patch("tournaments", row._id, {
        doc: { ...row.doc, placements, prize: row.doc.prize ?? prize },
      });
    return null;
  },
});

export const places = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (!(await ctx.runQuery(internal.ingest.enabled, {}))) return null;
    const events: {
      key: string;
      end: string;
      currency?: string;
      winner?: string;
      teams: { id: string; name: string; short: string }[];
    }[] = await ctx.runQuery(internal.leaguepedia.unplaced, { now: Date.now() });
    for (const event of events) {
      await pause(BREATH);
      const end = Date.parse(`${event.end}T12:00:00Z`);
      // First which of the wiki's pages is this event, from the places decided on its last
      // days; then every place on that page, since a team that went out early has an early date.
      const last = await ask<LpPlace>(placesUrl(end - 3 * DAY, end + 3 * DAY));
      // The wiki did not answer: leave the rest for another day.
      if (!last) return null;
      const page = placePage(last, event.teams, event.winner);
      let rows: LpPlace[] = [];
      if (page) {
        await pause(BREATH);
        const all = await ask<LpPlace>(placesOfUrl(page));
        if (!all) return null;
        rows = all;
      }
      const read = readPlaces(rows, event.teams, event.currency, event.winner);
      await ctx.runMutation(internal.leaguepedia.setPlaces, {
        key: event.key,
        placements: read?.placements,
        prize: read?.total,
      });
    }
    return null;
  },
});
