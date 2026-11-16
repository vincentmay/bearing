import {
  type LichessBroadcast,
  type LichessGame,
  type LichessRound,
  type LichessTour,
  gamesOfPgn,
  mapBroadcast,
  roundsToFetch,
} from "@bearing/domain/lichess";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { competitor, match, tournament } from "./validators";

/**
 * The first real source: chess broadcasts from Lichess, which are open and free to use.
 *
 * It runs only when the deployment has been switched to live data (`sample:useLive`). Schedules
 * are refreshed every hour by a cron job. While a round is being played, `ingest.tick` has the
 * rounds in progress fetched again every thirty seconds.
 * Requests go out one at a time, and a "too many requests" answer stops the run until the next
 * hour, as Lichess asks of its API's users.
 */

const BASE = "https://lichess.org/api/broadcast";
/** How many broadcasts are followed at once: the top of the game, not every club night. */
const TOURS = 5;

async function get<T>(path: string): Promise<T | null> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json", "User-Agent": "Bearing (esports schedule viewer)" },
  });
  if (response.status === 429) throw new Error("Lichess asked for a pause (429).");
  if (!response.ok) return null;
  return (await response.json()) as T;
}

const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

/**
 * The written games of a round. They are an extra: a board to replay is good to have, but a
 * schedule must not fail for want of one. So a refusal here is not an error; the caller stops
 * asking for the rest of its run, and the moves already in the store are kept.
 */
async function written(roundId: string): Promise<string | null> {
  await pause(300);
  const response = await fetch(`${BASE}/round/${roundId}.pgn`, {
    headers: { "User-Agent": "Bearing (esports schedule viewer)" },
  }).catch(() => null);
  if (!response || response.status === 429) return null;
  return response.ok ? response.text() : "";
}

interface Top {
  active?: { tour: LichessTour }[];
  upcoming?: { tour: LichessTour }[];
}

async function fetchBroadcast(tourId: string): Promise<LichessBroadcast | null> {
  const detail = await get<{ tour: LichessTour; rounds: LichessRound[] }>(`/${tourId}`);
  if (!detail) return null;
  const wanted = roundsToFetch(detail.rounds);
  const games: Record<string, LichessGame[]> = {};
  let refused = false;
  for (const round of wanted) {
    await pause(300);
    const answer = await get<{ games?: LichessGame[] }>(`/-/-/${round.id}`);
    if (!answer?.games) continue;
    // The moves are in the round's written games, which is a second address. Once it asks for
    // a pause, the rest of this run goes without.
    const pgn = refused ? null : await written(round.id);
    if (pgn === null) refused = true;
    const moves = gamesOfPgn(pgn ?? "");
    games[round.id] = answer.games.map((game) => ({ ...game, ...moves[game.id] }));
  }
  return { tour: detail.tour, rounds: detail.rounds, games };
}

/** Every hour: the leading broadcasts, their rounds and the games of the rounds that matter now. */
export const sync = internalAction({
  args: {},
  handler: async (ctx) => {
    if (!(await ctx.runQuery(internal.ingest.enabled, {}))) return;
    const top = await get<Top>("/top?page=1");
    const tours = [...(top?.active ?? []), ...(top?.upcoming ?? [])]
      .map((entry) => entry.tour)
      .filter((tour) => (tour.tier ?? 0) >= 4)
      // The top of the game first; the tier below it only fills what room is left.
      .sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0))
      .slice(0, TOURS);
    for (const tour of tours) {
      const broadcast = await fetchBroadcast(tour.id);
      if (!broadcast) continue;
      await ctx.runMutation(internal.lichess.store, plain(mapBroadcast(broadcast, Date.now())));
    }
  },
});

/** Every thirty seconds while something is being played: only the rounds in progress. */
export const refresh = internalAction({
  args: {},
  handler: async (ctx) => {
    if (!(await ctx.runQuery(internal.ingest.enabled, {}))) return;
    const liveTours = await ctx.runQuery(internal.lichess.liveTours, {});
    for (const tourId of liveTours) {
      const broadcast = await fetchBroadcast(tourId);
      if (!broadcast) continue;
      await ctx.runMutation(internal.lichess.store, plain(mapBroadcast(broadcast, Date.now())));
    }
  },
});

/** The Lichess broadcasts that have a game in progress, by their Lichess id. */
export const liveTours = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("matches")
      .withIndex("by_live_and_at", (q) => q.eq("live", true))
      .take(500);
    const ids = new Set(
      rows
        .map((r) => r.doc.tournamentId)
        .filter((id) => id.startsWith("lichess-"))
        .map((id) => id.slice("lichess-".length)),
    );
    return [...ids];
  },
});

/** Drop `undefined` fields, which the database has no word for. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Write one mapped broadcast into the store. */
export const store = internalMutation({
  args: {
    tournament,
    competitors: v.array(competitor),
    matches: v.array(match),
  },
  handler: async (ctx, args) => {
    // Rewriting a row that has not changed would wake every screen for nothing.
    for (const doc of args.competitors) {
      const row = await ctx.db
        .query("competitors")
        .withIndex("by_key", (q) => q.eq("key", doc.id))
        .first();
      if (!row) {
        await ctx.db.insert("competitors", { key: doc.id, doc });
        continue;
      }
      // A broadcast knows nothing of a player's picture; the one found for them is kept.
      const kept =
        row.doc.kind === "player" && doc.kind === "player"
          ? { ...doc, image: row.doc.image, imageCredit: row.doc.imageCredit }
          : doc;
      if (!same(row.doc, kept)) await ctx.db.patch("competitors", row._id, { doc: kept });
    }
    // Pairings of rounds fetched earlier are kept: this run may have fetched other rounds.
    const before = await ctx.db
      .query("tournaments")
      .withIndex("by_key", (q) => q.eq("key", args.tournament.id))
      .first();
    const known = new Map(
      (before?.doc.stages[0]?.rounds ?? []).map((r) => [r.id, r.matchIds] as const),
    );
    const doc = {
      ...args.tournament,
      participantIds: [
        ...new Set([...(before?.doc.participantIds ?? []), ...args.tournament.participantIds]),
      ],
      stages: args.tournament.stages.map((stage) => ({
        ...stage,
        rounds: stage.rounds.map((r) =>
          r.matchIds.length ? r : { ...r, matchIds: known.get(r.id) ?? [] },
        ),
      })),
    };
    if (!before) await ctx.db.insert("tournaments", { key: doc.id, doc });
    else if (!same(before.doc, doc)) await ctx.db.patch("tournaments", before._id, { doc });

    for (const m of args.matches) {
      const row = await ctx.db
        .query("matches")
        .withIndex("by_key", (q) => q.eq("key", m.id))
        .first();
      const live = m.status === "live";
      const at = Date.parse(m.scheduledAt);
      if (!row) {
        await ctx.db.insert("matches", { key: m.id, live, at, doc: m });
        continue;
      }
      // A run that could not read the moves does not take away the ones already here.
      const doc = {
        ...m,
        games: m.games.map((game, i) => {
          const old = row.doc.games[i];
          if (game.moves || !old?.moves) return game;
          return { ...game, moves: old.moves, detail: game.detail ?? old.detail };
        }),
      };
      if (!same(row.doc, doc)) await ctx.db.patch("matches", row._id, { live, at, doc });
    }
  },
});

/**
 * Pictures of chess players. Lichess keeps a page for every player FIDE lists, and for the
 * better known a photograph with the name of who took it and its licence. Each player is asked
 * about once; the strongest first, a few dozen a run, one request at a time.
 */
const FACES_PER_RUN = 40;

export const faceless = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const asked = await ctx.db
      .query("digests")
      .withIndex("by_key", (q) => q.gte("key", "face:").lt("key", "face:\uffff"))
      .take(8000);
    const done = new Set(asked.map((row) => row.key.slice("face:".length)));
    const players = await ctx.db.query("competitors").take(8000);
    return players
      .flatMap((row) =>
        row.doc.kind === "player" &&
        row.doc.discipline === "chess" &&
        row.key.startsWith("fide-") &&
        !row.doc.image &&
        !done.has(row.key)
          ? [{ key: row.key, rating: row.doc.rating?.value ?? 0 }]
          : [],
      )
      .sort((x, y) => y.rating - x.rating)
      .slice(0, FACES_PER_RUN)
      .map((p) => p.key);
  },
});

export const setFace = internalMutation({
  args: { key: v.string(), image: v.optional(v.string()), credit: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { key, image, credit }) => {
    await ctx.db.insert("digests", { key: `face:${key}`, hash: image ? "found" : "none" });
    if (!image) return null;
    const row = await ctx.db
      .query("competitors")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (row?.doc.kind === "player")
      await ctx.db.patch("competitors", row._id, {
        doc: { ...row.doc, image, imageCredit: credit },
      });
    return null;
  },
});

export const faces = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (!(await ctx.runQuery(internal.ingest.enabled, {}))) return null;
    const wanted: string[] = await ctx.runQuery(internal.lichess.faceless, {});
    for (const key of wanted) {
      await pause(1000);
      const response = await fetch(
        `https://lichess.org/api/fide/player/${key.slice("fide-".length)}`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "Bearing (esports schedule viewer)",
          },
        },
      ).catch(() => null);
      // Told to slow down, or not answered: stop, and carry on another day.
      if (!response || response.status === 429) return null;
      const body = response.ok
        ? ((await response.json().catch(() => null)) as {
            photo?: { small?: string; credit?: string };
          } | null)
        : null;
      await ctx.runMutation(internal.lichess.setFace, {
        key,
        image: body?.photo?.small,
        credit: body?.photo?.credit,
      });
    }
    // More may be waiting; a full run books the next.
    if (wanted.length >= FACES_PER_RUN)
      await ctx.scheduler.runAfter(30_000, internal.lichess.faces, {});
    return null;
  },
});
