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
import {
  type ActionCtx,
  type MutationCtx,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { fingerprint } from "./ingest";
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

/** Lichess has said: not now. */
class Refused extends Error {
  constructor() {
    super("Lichess asked for a pause (429).");
  }
}

/** Set when a request for written games was turned away, which does not end a run. */
let turnedAway = false;

/**
 * Lichess asks whoever it turns away to wait a full minute before asking anything again. All
 * of Bearing's chess jobs keep to that together: a refusal in one of them quiets every one of
 * them for a few minutes, where before each simply tried again half a minute later and was
 * turned away again.
 */
async function politely(ctx: ActionCtx, job: () => Promise<unknown>): Promise<void> {
  const held: Record<string, string> = await ctx.runQuery(internal.ingest.digests, {
    scope: "quiet",
  });
  if (Number(held["quiet:lichess"] ?? 0) > Date.now()) return;
  turnedAway = false;
  try {
    await job();
  } catch (error) {
    if (!(error instanceof Refused)) throw error;
    turnedAway = true;
  }
  if (turnedAway)
    await ctx.runMutation(internal.ingest.put, {
      digest: { key: "quiet:lichess", hash: String(Date.now() + 3 * 60_000) },
    });
}

async function get<T>(path: string): Promise<T | null> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json", "User-Agent": "Bearing (esports schedule viewer)" },
  });
  if (response.status === 429) throw new Refused();
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
  if (response?.status === 429) turnedAway = true;
  if (!response || response.status === 429) return null;
  return response.ok ? response.text() : "";
}

interface Top {
  active?: { tour: LichessTour }[];
  upcoming?: { tour: LichessTour }[];
}

/** A broadcast with the rounds that matter now; `whole` asks for every round it has. */
async function fetchBroadcast(
  tourId: string,
  whole = false,
  /** Rounds that are over and already in the store, as `round:<id>`; they are not read again. */
  have?: Record<string, string>,
): Promise<(LichessBroadcast & { over: string[] }) | null> {
  const detail = await get<{
    tour: LichessTour;
    rounds: LichessRound[];
    group?: LichessBroadcast["group"];
  }>(`/${tourId}`);
  if (!detail) return null;
  // Besides the rounds that matter now, a few earlier ones the store has not seen yet: a round
  // that is over never changes, so each is read once and the event fills in backwards.
  const earlier = have
    ? detail.rounds.filter((r) => r.finished && !have[`round2:${r.id}`]).slice(-EARLIER_PER_RUN)
    : [];
  const wanted = whole
    ? detail.rounds.slice(0, 24)
    : [...new Set([...roundsToFetch(detail.rounds), ...earlier])];
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
  const over = wanted.filter((r) => r.finished && games[r.id]).map((r) => r.id);
  return { tour: detail.tour, rounds: detail.rounds, games, group: detail.group, over };
}

/**
 * Hand a broadcast over to the store, and only what is new of it. What a function reads is
 * what the plan counts: comparing every game of a round with the store every thirty seconds
 * read far more than it ever wrote. So each game, the list of players and the event carry a
 * fingerprint of what was last handed over, and a piece that matches its fingerprint stays
 * where it is. The time of checking is renewed at most every half hour.
 */
async function hand(ctx: ActionCtx, broadcast: LichessBroadcast) {
  const mapped = plain(mapBroadcast(broadcast, Date.now()));
  const scope = `lichess-${broadcast.tour.id}`;
  const held: Record<string, string> = await ctx.runQuery(internal.ingest.digests, { scope });
  const fresh: { key: string; hash: string }[] = [];
  const changed = (key: string, value: unknown) => {
    const hash = fingerprint(value);
    if (held[`${scope}:${key}`] === hash) return false;
    fresh.push({ key: `${scope}:${key}`, hash });
    return true;
  };
  const matches = mapped.matches.filter((m) => changed(`m:${m.id}`, m));
  const people = changed("players", mapped.competitors);
  const event = changed("event", { ...mapped.tournament, provenance: null });
  const halfHour = String(Math.floor(Date.now() / (30 * 60_000)));
  if (!matches.length && !people && !event) {
    if (held[`${scope}:seen`] === halfHour) return;
    await ctx.runMutation(internal.lichess.checked, {
      key: mapped.tournament.id,
      at: mapped.tournament.provenance.checkedAt,
      note: { key: `${scope}:seen`, hash: halfHour },
    });
    return;
  }
  fresh.push({ key: `${scope}:seen`, hash: halfHour });
  await ctx.runMutation(internal.lichess.store, {
    tournament: mapped.tournament,
    competitors: people ? mapped.competitors : [],
    matches,
    notes: fresh,
  });
}

/** Every hour: the leading broadcasts, their rounds and the games of the rounds that matter now. */
export const sync = internalAction({
  args: {},
  handler: async (ctx) => {
    await politely(ctx, async () => {
      if (!(await ctx.runQuery(internal.ingest.enabled, {}))) return;
      const top = await get<Top>("/top?page=1");
      const tours = [...(top?.active ?? []), ...(top?.upcoming ?? [])]
        .map((entry) => entry.tour)
        .filter((tour) => (tour.tier ?? 0) >= 4)
        // The top of the game first; the tier below it only fills what room is left.
        .sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0))
        .slice(0, TOURS);
      const parts = new Map<string, string>();
      const have: Record<string, string> = await ctx.runQuery(internal.ingest.digests, {
        scope: "round2",
      });
      for (const tour of tours) {
        const broadcast = await fetchBroadcast(tour.id, false, have);
        if (!broadcast) continue;
        await hand(ctx, broadcast);
        if (broadcast.over.length)
          await ctx.runMutation(internal.lichess.noteRounds, { ids: broadcast.over });
        for (const part of broadcast.group?.tours ?? []) parts.set(part.id, tour.id);
      }
      // An event is often several broadcasts: its group stage, its semifinals, its final. The
      // parts that are not among the leading broadcasts are read whole, a few a run, and one
      // that is over is read once.
      const chosen = new Set(tours.map((tour) => tour.id));
      const known: Record<string, string> = await ctx.runQuery(internal.ingest.digests, {
        scope: "tour",
      });
      let read = 0;
      for (const id of parts.keys()) {
        if (chosen.has(id) || known[`tour:${id}`] === "whole" || read >= PARTS_PER_RUN) continue;
        read++;
        const broadcast = await fetchBroadcast(id, true);
        if (!broadcast) continue;
        await hand(ctx, broadcast);
        if (broadcast.rounds.length && broadcast.rounds.every((round) => round.finished))
          await ctx.runMutation(internal.ingest.put, {
            digest: { key: `tour:${id}`, hash: "whole" },
          });
      }
    });
  },
});

/** Every thirty seconds while something is being played: only the rounds in progress. */
export const refresh = internalAction({
  args: {},
  handler: async (ctx) => {
    await politely(ctx, async () => {
      if (!(await ctx.runQuery(internal.ingest.enabled, {}))) return;
      const liveTours = await ctx.runQuery(internal.lichess.liveTours, {});
      for (const tourId of liveTours) {
        const broadcast = await fetchBroadcast(tourId);
        if (!broadcast) continue;
        await hand(ctx, broadcast);
      }
    });
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
    /** The fingerprints of what is handed over here, kept for the next time. */
    notes: v.optional(v.array(v.object({ key: v.string(), hash: v.string() }))),
  },
  handler: async (ctx, args) => {
    for (const note of args.notes ?? []) await remember(ctx, note);
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
    // The time of checking differs on every run. Alone it is a reason to write only every
    // half hour: the event is read by every open screen, and each write sends it to all of them.
    const settled =
      before && same({ ...before.doc, provenance: null }, { ...doc, provenance: null });
    const recent =
      before &&
      Date.parse(doc.provenance.checkedAt) - Date.parse(before.doc.provenance.checkedAt) <
        30 * 60_000;
    if (!before) await ctx.db.insert("tournaments", { key: doc.id, doc });
    else if (!(settled && recent)) await ctx.db.patch("tournaments", before._id, { doc });

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
          return {
            ...game,
            moves: old.moves,
            evals: old.evals,
            clocks: old.clocks,
            detail: game.detail ?? old.detail,
          };
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
async function remember(ctx: MutationCtx, note: { key: string; hash: string }) {
  const row = await ctx.db
    .query("digests")
    .withIndex("by_key", (q) => q.eq("key", note.key))
    .first();
  if (!row) await ctx.db.insert("digests", note);
  else if (row.hash !== note.hash) await ctx.db.patch("digests", row._id, { hash: note.hash });
}

/** Nothing new, but looked at: the event says when its facts were last confirmed. */
export const checked = internalMutation({
  args: {
    key: v.string(),
    at: v.string(),
    note: v.object({ key: v.string(), hash: v.string() }),
  },
  returns: v.null(),
  handler: async (ctx, { key, at, note }) => {
    await remember(ctx, note);
    const row = await ctx.db
      .query("tournaments")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (row)
      await ctx.db.patch("tournaments", row._id, {
        doc: { ...row.doc, provenance: { ...row.doc.provenance, checkedAt: at } },
      });
    return null;
  },
});

/** Remember rounds that are over and stored, so that they are not asked for again. */
export const noteRounds = internalMutation({
  args: { ids: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { ids }) => {
    for (const id of ids) {
      const key = `round2:${id}`;
      const row = await ctx.db
        .query("digests")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
      if (!row) await ctx.db.insert("digests", { key, hash: "over" });
    }
    return null;
  },
});

const FACES_PER_RUN = 40;
/** Earlier rounds of a running event read in one run. */
const EARLIER_PER_RUN = 3;
/** Parts of an event read whole in one run. */
const PARTS_PER_RUN = 3;

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
    await politely(ctx, async () => {
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
        if (response?.status === 429) throw new Refused();
        if (!response) return null;
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
    });
    return null;
  },
});
