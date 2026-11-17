import { MATE, chessTurn } from "@bearing/domain";
import { useEffect, useMemo, useSyncExternalStore } from "react";

/**
 * How a chess engine judges a position.
 *
 * Two places are asked, in this order. Lichess keeps the judgements its users' engines have
 * already worked out, often far deeper than a browser gets in a few seconds; where it has the
 * position, that is the answer. Where it has not, Stockfish works it out here, in the
 * browser: the engine chess.com runs in its own pages (stockfish.js, the small single-threaded
 * build, under two megabytes), in a worker of its own so that the page never waits on it. It
 * is fetched the first time a position needs it and not before.
 *
 * Besides the position being looked at, every other position of the game is judged quickly
 * and shallowly while the engine has nothing else to do, so that the whole game has its curve
 * and its moves their marks without a server having analysed it.
 */

const ENGINE = "/stockfish/stockfish-19-lite-single.js";
/** The position looked at: this deep, or this long, whichever comes first. */
const DEEP = { depth: 24, ms: 6000 };
/** Every other position of the game: a glance. */
const GLANCE = 13;

export interface Judgement {
  /** In pawns from White's side; a forced mate is `MATE` less the moves to it. */
  pawns: number;
  depth: number;
  /** The line the engine expects, as it writes moves: "e2e4", "e7e5". */
  line: string[];
  by: "Lichess" | "Stockfish";
  /** Still being worked out: the figures may yet change. */
  thinking: boolean;
}

const known = new Map<string, Judgement>();
const listeners = new Set<() => void>();
let version = 0;
let told: ReturnType<typeof setTimeout> | undefined;

/** Tell the screens, a few times a second at most: the engine speaks far more often. */
function tell(now = false) {
  if (now) {
    clearTimeout(told);
    told = undefined;
    version++;
    for (const listener of listeners) listener();
    return;
  }
  told ??= setTimeout(() => tell(true), 120);
}

function note(fen: string, next: Judgement) {
  const before = known.get(fen);
  // A deeper judgement is never replaced by a shallower one.
  if (before && !before.thinking && before.depth >= next.depth) return;
  known.set(fen, next);
  tell(!next.thinking);
}

// ---- Lichess's stored judgements ----

let cloudQuietUntil = 0;
const asked = new Set<string>();

async function askLichess(fen: string): Promise<boolean> {
  if (asked.has(fen) || Date.now() < cloudQuietUntil) return false;
  asked.add(fen);
  const response = await fetch(
    `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=1`,
  ).catch(() => null);
  // Asked to slow down: nothing more is asked of it for a few minutes.
  if (response?.status === 429) cloudQuietUntil = Date.now() + 5 * 60_000;
  if (!response?.ok) return false;
  const body = (await response.json().catch(() => null)) as {
    depth?: number;
    pvs?: { moves?: string; cp?: number; mate?: number }[];
  } | null;
  const best = body?.pvs?.[0];
  if (!best || (best.cp === undefined && best.mate === undefined)) return false;
  note(fen, {
    pawns:
      best.mate !== undefined
        ? Math.sign(best.mate || 1) * (MATE - Math.abs(best.mate))
        : (best.cp ?? 0) / 100,
    depth: body?.depth ?? 0,
    line: best.moves?.split(" ") ?? [],
    by: "Lichess",
    thinking: false,
  });
  return true;
}

// ---- Stockfish, here ----

interface Job {
  fen: string;
  deep: boolean;
}

let worker: Worker | undefined;
let ready = false;
let failed = false;
let running: Job | undefined;
/** The position being looked at, wanted deep. */
let wanted: string | undefined;
/** The other positions of the game, wanted at a glance. */
let queue: string[] = [];

function done(fen: string, deep: boolean): boolean {
  const have = known.get(fen);
  if (!have || have.thinking) return false;
  return deep ? have.by === "Lichess" || have.depth >= DEEP.depth - 4 : true;
}

function pump() {
  if (!worker || !ready || running) return;
  let job: Job | undefined;
  if (wanted && !done(wanted, true)) job = { fen: wanted, deep: true };
  else {
    while (queue.length && !job) {
      const fen = queue.shift()!;
      if (!known.has(fen)) job = { fen, deep: false };
    }
  }
  if (!job) return;
  running = job;
  worker.postMessage(`position fen ${job.fen}`);
  worker.postMessage(
    job.deep ? `go depth ${DEEP.depth} movetime ${DEEP.ms}` : `go depth ${GLANCE}`,
  );
}

function hear(line: string) {
  if (line === "uciok") {
    worker?.postMessage("setoption name Hash value 32");
    worker?.postMessage("isready");
    return;
  }
  if (line === "readyok") {
    ready = true;
    pump();
    return;
  }
  const job = running;
  if (!job) return;
  if (line.startsWith("bestmove")) {
    const last = known.get(job.fen);
    if (last?.thinking) known.set(job.fen, { ...last, thinking: false });
    running = undefined;
    tell(true);
    pump();
    return;
  }
  // "info depth 18 seldepth 24 multipv 1 score cp 31 nodes … pv e2e4 e7e5 …"
  if (!line.startsWith("info") || / (upper|lower)bound /.test(line)) return;
  const depth = Number(/ depth (\d+)/.exec(line)?.[1]);
  const score = / score (cp|mate) (-?\d+)/.exec(line);
  const pv = / pv (.+)$/.exec(line)?.[1];
  if (!depth || !score || !pv) return;
  // The engine speaks for whoever is to move; Bearing writes every judgement from White's side.
  const sign = chessTurn(job.fen) === 0 ? 1 : -1;
  const value = Number(score[2]);
  const pawns =
    score[1] === "mate"
      ? sign * Math.sign(value || 1) * (MATE - Math.abs(value))
      : (sign * value) / 100;
  // A glance is only worth showing once it is finished; the position looked at shows its way.
  if (!job.deep && depth < GLANCE) return;
  if (job.deep && depth < 8) return;
  note(job.fen, { pawns, depth, line: pv.split(" "), by: "Stockfish", thinking: job.deep });
}

function start() {
  if (worker || failed) return;
  try {
    worker = new Worker(ENGINE);
  } catch {
    failed = true;
    return;
  }
  worker.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (typeof event.data === "string") hear(event.data);
  });
  // An engine that cannot be had (an old browser, a blocked file) is done without.
  worker.addEventListener("error", () => {
    failed = true;
    worker?.terminate();
    worker = undefined;
    ready = false;
    running = undefined;
  });
  worker.postMessage("uci");
}

let users = 0;
let rest: ReturnType<typeof setTimeout> | undefined;

/** Let the engine go a while after the last board has left the page. */
function leave() {
  users--;
  clearTimeout(rest);
  rest = setTimeout(() => {
    if (users > 0 || !worker) return;
    worker.terminate();
    worker = undefined;
    ready = false;
    running = undefined;
    queue = [];
    wanted = undefined;
  }, 30_000);
}

async function want(fen: string) {
  wanted = fen;
  if (done(fen, true)) return;
  if (await askLichess(fen)) return;
  if (wanted !== fen) return;
  start();
  // Something else is being worked on: it is told to stop, and this is next.
  if (running && running.fen !== fen && running.deep) worker?.postMessage("stop");
  pump();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** How the engine judges this position; undefined until something is known, or when off. */
export function useJudgement(fen: string | undefined, on: boolean): Judgement | undefined {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  useEffect(() => {
    if (!on) return;
    users++;
    return leave;
  }, [on]);
  useEffect(() => {
    if (!on || !fen) return;
    // Stepping quickly through a game asks for the position rested on, not for each passed.
    const timer = setTimeout(() => void want(fen), 140);
    return () => clearTimeout(timer);
  }, [fen, on]);
  return on && fen ? known.get(fen) : undefined;
}

/**
 * The judgement of every position of a game, in pawns from White's side, as far as known. The
 * ones not yet known are looked at quickly, in order, whenever the engine is free.
 */
export function useGameJudgements(fens: readonly string[], on: boolean): (number | undefined)[] {
  const seen = useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  useEffect(() => {
    if (!on || !fens.length) return;
    queue = fens.filter((fen) => !known.has(fen));
    if (!queue.length) return;
    // After the position being looked at has had its turn.
    const timer = setTimeout(() => {
      start();
      pump();
    }, 600);
    return () => {
      clearTimeout(timer);
      queue = [];
    };
  }, [fens, on]);
  // `seen` changes whenever anything new is known; the list is read afresh then.
  return useMemo(
    () => (on && seen >= 0 ? fens.map((fen) => known.get(fen)?.pawns) : []),
    [fens, on, seen],
  );
}
