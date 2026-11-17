import type { GameResult, Match } from "@bearing/domain";
import { type WrittenGame, gamesOfPgn } from "@bearing/domain/lichess";
import { useSyncExternalStore } from "react";

/**
 * Chess as it is being played, straight from Lichess.
 *
 * Bearing's store looks at a round under way twice a minute, which is right for a list and
 * too slow for a board. Lichess offers a stream for exactly this: it sends every game of a
 * round once, and from then on each game again the moment a move is made in it. The browser
 * listens to that stream for the round it is showing, and lays what it hears over what the
 * store has. Lichess asks for this in place of asking again and again: nothing is polled.
 *
 * https://lichess.org/api#tag/Broadcasts/operation/broadcastStreamRoundPgn
 */

const API = "https://lichess.org/api";

/** One game as the stream last sent it, and when its latest move was made (0: not known). */
export interface LiveGame extends WrittenGame {
  movedAt: number;
}

type Games = Record<string, LiveGame>;

interface Round {
  games: Games;
  listeners: Set<() => void>;
  stop?: () => void;
}

const rounds = new Map<string, Round>();
const EMPTY: Games = {};

/** Take games in: a game is replaced only by a longer record of itself, or by its result. */
function take(round: Round, pgn: string, heard: number | undefined) {
  const read = gamesOfPgn(pgn);
  let changed = false;
  const games = { ...round.games };
  for (const [id, game] of Object.entries(read)) {
    const before = games[id];
    if (
      before &&
      before.moves.length === game.moves.length &&
      before.result === game.result &&
      (before.evals?.length ?? 0) === (game.evals?.length ?? 0)
    )
      continue;
    // A move heard as it happens is timed from now; one that was already there is not.
    const movedAt =
      before && before.moves.length === game.moves.length
        ? before.movedAt
        : before && heard
          ? heard
          : 0;
    games[id] = { ...game, movedAt };
    changed = true;
  }
  if (!changed) return;
  round.games = games;
  for (const listener of round.listeners) listener();
}

/**
 * How long ago the latest move of each game was made, which the stream does not say for the
 * moves that were already there on arriving. Asked once, so that the clocks start from the
 * right second.
 */
async function timeLatest(id: string, round: Round, signal: AbortSignal) {
  const response = await fetch(`${API}/broadcast/-/-/${id}`, { signal }).catch(() => null);
  if (!response?.ok) return;
  const body = (await response.json().catch(() => null)) as {
    games?: { id: string; thinkTime?: number; status?: string }[];
  } | null;
  const now = Date.now();
  const games = { ...round.games };
  let changed = false;
  for (const game of body?.games ?? []) {
    const known = games[game.id];
    if (!known || known.movedAt || game.thinkTime === undefined || game.status !== "*") continue;
    games[game.id] = { ...known, movedAt: now - game.thinkTime * 1000 };
    changed = true;
  }
  if (!changed) return;
  round.games = games;
  for (const listener of round.listeners) listener();
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((done) => {
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      done();
    });
  });

/** Listen to a round until told to stop, coming back after a break in the line. */
async function listen(id: string, round: Round, signal: AbortSignal) {
  let pause = 2000;
  while (!signal.aborted) {
    try {
      const response = await fetch(`${API}/stream/broadcast/round/${id}.pgn`, { signal });
      // No such round (any more): nothing to come back for.
      if (response.status === 404) return;
      // Turned away: Lichess allows an address two lines at a time, and this is a third (a
      // third window, most likely). For a minute the round is read whole every few seconds,
      // which its own network keeps ready, and then the line is tried again.
      if (response.status === 429) {
        for (let i = 0; i < 5 && !signal.aborted; i++) {
          await readOnce(id, round, signal, Date.now());
          await wait(12_000, signal);
        }
        continue;
      }
      if (response.ok && response.body) {
        pause = 2000;
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let text = "";
        let first = true;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          text += value;
          // A game ends with two empty lines; what follows the last of them is still arriving.
          const end = text.lastIndexOf("\n\n\n");
          if (end < 0) continue;
          take(round, text.slice(0, end), first ? undefined : Date.now());
          text = text.slice(end + 3);
          if (first) {
            first = false;
            void timeLatest(id, round, signal);
          }
        }
      }
    } catch {
      // A line that broke, or a browser that went offline: tried again below.
    }
    await wait(pause, signal);
    pause = Math.min(pause * 2, 30_000);
  }
}

/** The games of a round that is over, read once. */
async function readOnce(id: string, round: Round, signal: AbortSignal, heard?: number) {
  const response = await fetch(`${API}/broadcast/round/${id}.pgn`, { signal }).catch(() => null);
  if (response?.ok) take(round, await response.text(), heard);
}

function open(key: string, id: string, live: boolean): Round {
  const round: Round = { games: EMPTY, listeners: new Set() };
  let abort: AbortController | undefined;
  const start = () => {
    if (abort || document.visibilityState === "hidden") return;
    abort = new AbortController();
    void (live ? listen(id, round, abort.signal) : readOnce(id, round, abort.signal));
  };
  const halt = () => {
    abort?.abort();
    abort = undefined;
  };
  // A page nobody is looking at does not hold a line open; it picks up again when looked at,
  // and the stream then says everything anew.
  const seen = () => {
    if (!live) return;
    if (document.visibilityState === "hidden") halt();
    else start();
  };
  document.addEventListener("visibilitychange", seen);
  round.stop = () => {
    document.removeEventListener("visibilitychange", seen);
    halt();
    rounds.delete(key);
  };
  start();
  return round;
}

/**
 * The games of a Lichess round by their Lichess ids: `live` listens for as long as something
 * on the page asks, `once` reads a round that is over. Several askers share one line.
 */
export function useRoundGames(id: string | undefined, how: "live" | "once" | undefined): Games {
  const key = id && how ? `${how}:${id}` : undefined;
  return useSyncExternalStore(
    (listener) => {
      if (!key || !id) return () => undefined;
      const round = rounds.get(key) ?? open(key, id, how === "live");
      rounds.set(key, round);
      round.listeners.add(listener);
      return () => {
        round.listeners.delete(listener);
        // Let go a moment later, so that moving from one game of a round to another keeps
        // the line that is already open.
        setTimeout(() => {
          if (!round.listeners.size && rounds.get(key) === round) round.stop?.();
        }, 4000);
      };
    },
    () => (key ? (rounds.get(key)?.games ?? EMPTY) : EMPTY),
    () => EMPTY,
  );
}

/** One game with what Lichess says of it laid over what the store has. */
function overlay(game: GameResult, heard: LiveGame, inMatch: boolean): GameResult {
  const over = !!heard.result && heard.result !== "*";
  // The store may be ahead for a moment, while a broken line is being picked up again.
  if (!over && heard.moves.length < (game.moves?.length ?? 0)) return game;
  if (!heard.moves.length && !over) return game;
  const first = game.firstSide ?? 0;
  const winner =
    heard.result === "1-0"
      ? first
      : heard.result === "0-1"
        ? 1 - first
        : over
          ? ("draw" as const)
          : undefined;
  // In a match of several games the store says when a game is over: what the game counts
  // for is the organiser's to say, and only the store knows that.
  const finished = game.status === "finished" || (over && !inMatch);
  const status = finished ? "finished" : "live";
  const played = Math.ceil(heard.moves.length / 2);
  const length = played ? (finished ? `${played} moves` : `move ${played}`) : "";
  return {
    ...game,
    status,
    winner: finished ? (game.winner ?? winner) : undefined,
    scores:
      inMatch || winner === undefined || !finished
        ? game.scores
        : winner === "draw"
          ? [0.5, 0.5]
          : winner === 0
            ? [1, 0]
            : [0, 1],
    moves: heard.moves,
    evals: heard.evals ?? game.evals,
    clocks: heard.clocks ?? game.clocks,
    detail: [heard.opening, length].filter(Boolean).join(" · ") || game.detail,
    chess: {
      ...game.chess,
      fen: game.chess?.fen ?? "",
      move: Math.floor(heard.moves.length / 2) + 1,
      movedAt: status === "live" && !over && heard.movedAt ? heard.movedAt : undefined,
    },
  };
}

/**
 * A match with what Lichess says of its games laid over what the store has. A game is known
 * by the name Lichess gives it: a match that is one game carries it in its own name, a match
 * of several games notes it on each.
 */
export function withLive(match: Match, heard: Record<string, LiveGame>): Match {
  const own = lichessId(match.id);
  let changed = false;
  const games = match.games.map((game) => {
    const id = game.ref ? game.ref.split("/").at(-1) : match.games.length === 1 ? own : undefined;
    const said = id ? heard[id] : undefined;
    if (!said) return game;
    const next = overlay(game, said, !!game.ref);
    if (next !== game) changed = true;
    return next;
  });
  if (!changed) return match;
  return match.games[0]?.ref ? { ...match, games } : { ...match, status: games[0]!.status, games };
}

/** The Lichess round a game of a match is played in, from the name noted on the game. */
export function roundOf(game: GameResult | undefined): string | undefined {
  return game?.ref?.split("/")[0];
}

/** The Lichess id in one of Bearing's ids for a Lichess round, game or event. */
export function lichessId(id: string | undefined): string | undefined {
  return id?.startsWith("lichess-") ? id.slice("lichess-".length) : undefined;
}
