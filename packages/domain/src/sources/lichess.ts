import { writtenGames } from "../chess.ts";
import type { GameResult, Match, Player, Stage, StageFormat, Tournament } from "../model.ts";

/**
 * Lichess broadcasts, mapped into the canonical model. This is the whole of what Bearing knows
 * about Lichess: the shapes it answers with, and what each field becomes. Nothing here fetches
 * anything, so it can be tested against saved answers.
 *
 * API: https://lichess.org/api#tag/Broadcasts. What a broadcast does not say stays unsaid: no
 * organiser, no prize, and no stage format unless its description names one.
 */

/** FIDE's federation codes for the federations met most often, as two-letter country codes. */
const FEDERATIONS: Record<string, string> = {
  OMA: "OM",
  PLE: "PS",
  NEP: "NP",
  LBN: "LB",
  SYR: "SY",
  HKG: "HK",
  BRN: "BH",
  PAK: "PK",
  ALB: "AL",
  ALG: "DZ",
  ARG: "AR",
  ARM: "AM",
  AUS: "AU",
  AUT: "AT",
  AZE: "AZ",
  BAN: "BD",
  BEL: "BE",
  BIH: "BA",
  BLR: "BY",
  BRA: "BR",
  BUL: "BG",
  CAN: "CA",
  CHI: "CL",
  CHN: "CN",
  COL: "CO",
  CRO: "HR",
  CUB: "CU",
  CZE: "CZ",
  DEN: "DK",
  ECU: "EC",
  EGY: "EG",
  ESP: "ES",
  EST: "EE",
  FIN: "FI",
  FRA: "FR",
  GEO: "GE",
  GER: "DE",
  GRE: "GR",
  HUN: "HU",
  INA: "ID",
  IND: "IN",
  IRI: "IR",
  IRL: "IE",
  ISL: "IS",
  ISR: "IL",
  ITA: "IT",
  JPN: "JP",
  KAZ: "KZ",
  KGZ: "KG",
  KOR: "KR",
  KSA: "SA",
  LAT: "LV",
  LTU: "LT",
  LUX: "LU",
  MAS: "MY",
  MDA: "MD",
  MEX: "MX",
  MGL: "MN",
  MKD: "MK",
  MNE: "ME",
  NED: "NL",
  NOR: "NO",
  NZL: "NZ",
  PAR: "PY",
  PER: "PE",
  PHI: "PH",
  POL: "PL",
  POR: "PT",
  QAT: "QA",
  ROU: "RO",
  RSA: "ZA",
  RUS: "RU",
  SGP: "SG",
  SLO: "SI",
  SRB: "RS",
  SRI: "LK",
  SUI: "CH",
  SVK: "SK",
  SWE: "SE",
  TJK: "TJ",
  TKM: "TM",
  TUR: "TR",
  UAE: "AE",
  UKR: "UA",
  URU: "UY",
  USA: "US",
  UZB: "UZ",
  VEN: "VE",
  VIE: "VN",
};

export interface LichessTour {
  id: string;
  name: string;
  url: string;
  /** 3 to 5; 5 is the top of the game. */
  tier?: number;
  /** Start and, when known, end, in milliseconds. */
  dates?: number[];
  info?: { format?: string; tc?: string; location?: string; players?: string };
}

export interface LichessRound {
  id: string;
  name: string;
  url: string;
  startsAt?: number;
  ongoing?: boolean;
  finished?: boolean;
  /** When it ended, in milliseconds. */
  finishedAt?: number;
  /** What a win and a draw count for with each colour, where that is not one and a half. */
  customScoring?: {
    white: { win: number; draw: number };
    black: { win: number; draw: number };
  };
}

export interface LichessPlayer {
  name?: string;
  title?: string;
  rating?: number;
  fideId?: number;
  fed?: string;
  /** Centiseconds left on the clock. */
  clock?: number;
}

export interface LichessGame {
  id: string;
  name?: string;
  fen?: string;
  players?: LichessPlayer[];
  lastMove?: string;
  /** "1-0", "0-1", "½-½", or "*" while it is not over. */
  status?: string;
  /** From the round's written games, where they were fetched: the moves, and the opening's name. */
  moves?: string[];
  evals?: number[];
  clocks?: number[];
  opening?: string;
}

/** One game out of a round's written record. */
export interface WrittenGame {
  moves: string[];
  evals?: number[];
  clocks?: number[];
  opening?: string;
  /** "1-0", "0-1", "1/2-1/2", or "*" while it is not over. */
  result?: string;
}

/**
 * The games of a round out of its written record (one PGN after another), by game id: the moves
 * of each and the name of its opening where Lichess has worked one out.
 */
export function gamesOfPgn(pgn: string): Record<string, WrittenGame> {
  const games: Record<string, WrittenGame> = {};
  for (const game of writtenGames(pgn)) {
    const tag = (name: string) => game.headers.get(name);
    const id = (tag("GameURL") ?? tag("Site"))?.split("/").at(-1);
    if (!id || id === "?") continue;
    const opening = tag("Opening");
    const eco = tag("ECO");
    games[id] = {
      moves: game.moves,
      evals: game.evals.length ? game.evals : undefined,
      clocks: game.clocks.some((c) => c >= 0) ? game.clocks : undefined,
      // The opening by its name, led by its code where the game gives one: "E05 Catalan Opening".
      opening:
        opening && opening !== "?"
          ? [eco && eco !== "?" ? eco : undefined, opening].filter(Boolean).join(" ")
          : undefined,
      result: tag("Result"),
    };
  }
  return games;
}

export interface LichessBroadcast {
  tour: LichessTour;
  rounds: LichessRound[];
  /** The games of each round that was fetched, by round id. A round left out is not guessed at. */
  games: Record<string, LichessGame[]>;
  /** The larger event this broadcast is one part of, with all its parts. */
  group?: { name: string; tours: { id: string; name: string }[] };
}

export interface Mapped {
  tournament: Tournament;
  competitors: Player[];
  matches: Match[];
}

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const instant = (ms: number) => new Date(ms).toISOString().replace(".000", "");

function slug(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

/** A player is known by their FIDE number where there is one, and by name otherwise. */
export function playerId(p: LichessPlayer): string | null {
  if (p.fideId) return `fide-${p.fideId}`;
  return p.name ? `lichess-${slug(p.name)}` : null;
}

/** "Bai, Jinshi" is "Jinshi Bai", known as "Bai". */
function names(raw: string): { handle: string; name: string } {
  const [family, given] = raw.split(",").map((s) => s.trim());
  if (!family || !given) return { handle: raw.trim(), name: raw.trim() };
  return { handle: family, name: `${given} ${family}` };
}

/**
 * The country of a chess federation. Federations use three letters of their own; the ones
 * that are countries become the two-letter code, the rest are given back as they are.
 */
export function countryOfFederation(fed: string | undefined): string {
  return (fed && FEDERATIONS[fed]) ?? fed ?? "";
}

function toPlayer(p: LichessPlayer, id: string): Player {
  const { handle, name } = names(p.name ?? id);
  return {
    kind: "player",
    id,
    discipline: "chess",
    handle,
    name,
    // Chess federations use three letters of their own; the common ones are turned into the
    // two-letter country code, the rest are shown as they are.
    country: (p.fed && FEDERATIONS[p.fed]) ?? p.fed ?? "",
    title: p.title,
    rating: p.rating ? { system: "FIDE", value: p.rating } : undefined,
  };
}

function clockText(centis: number): string {
  const s = Math.max(0, Math.floor(centis / 100));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** The format, only where the broadcast's own description names one Bearing can draw. */
function formatOf(text: string | undefined): StageFormat {
  if (text && /round.robin/i.test(text)) return "round-robin";
  return "rounds";
}

/** One game as Bearing keeps it, with who had White and who Black. */
function toGame(
  game: LichessGame,
  board: number,
  round: LichessRound,
  now: number,
): { state: GameResult; white: string; black: string } | null {
  const [white, black] = game.players ?? [];
  const a = white ? playerId(white) : null;
  const b = black ? playerId(black) : null;
  if (!a || !b) return null;
  const result = game.status ?? "*";
  const over = result !== "*";
  const begun = round.ongoing || round.finished || (round.startsAt ?? Infinity) <= now;
  const status = over ? "finished" : begun && !round.finished ? "live" : "scheduled";
  const winner = result === "1-0" ? 0 : result === "0-1" ? 1 : over ? ("draw" as const) : undefined;
  // The last field of a FEN is the number of the move being played.
  const move = Number(game.fen?.trim().split(/\s+/)[5]);
  const clocks = [white?.clock, black?.clock];
  const played = game.moves?.length ? Math.ceil(game.moves.length / 2) : undefined;
  const length = played ? (over ? `${played} moves` : `move ${played}`) : undefined;
  const state: GameResult = {
    label: `Board ${board + 1}`,
    status,
    firstSide: 0,
    winner,
    detail: [game.opening, length].filter(Boolean).join(" · ") || undefined,
    moves: game.moves?.length ? game.moves : undefined,
    evals: game.moves?.length && game.evals?.length ? game.evals : undefined,
    clocks: game.moves?.length && game.clocks?.length ? game.clocks : undefined,
    scores:
      winner === undefined
        ? undefined
        : winner === "draw"
          ? [0.5, 0.5]
          : winner === 0
            ? [1, 0]
            : [0, 1],
    chess: game.fen
      ? {
          fen: game.fen,
          move: Number.isFinite(move) ? move : 1,
          clocks:
            clocks[0] !== undefined && clocks[1] !== undefined
              ? [clockText(clocks[0]), clockText(clocks[1])]
              : undefined,
          lastMove: game.lastMove,
        }
      : undefined,
  };
  return { state, white: a, black: b };
}

function toMatch(
  game: LichessGame,
  board: number,
  round: LichessRound,
  tournamentId: string,
  now: number,
): Match | null {
  const made = toGame(game, board, round, now);
  if (!made) return null;
  return {
    id: `lichess-${game.id}`,
    tournamentId,
    stageId: "rounds",
    roundId: `lichess-${round.id}`,
    scheduledAt: instant(round.startsAt ?? now),
    bestOf: 1,
    status: made.state.status,
    sides: [{ competitorId: made.white }, { competitorId: made.black }],
    games: [made.state],
    stream: { label: "Lichess", url: round.url },
  };
}

/**
 * How the games of a broadcast hang together. Most are a tournament of rounds, each player
 * meeting someone new every round ("games"). Some are matches: the same two players sit
 * down again and again, game after game ("matches"), and in some of those the pairings
 * never change from the first round to the last ("fixed").
 */
export type LichessPlay = "games" | "matches" | "fixed";

const pairOf = (game: LichessGame): string | null => {
  const ids = (game.players ?? []).map(playerId);
  return ids.length === 2 && ids[0] && ids[1] ? [ids[0], ids[1]].sort().join("|") : null;
};

/**
 * What the rounds that were fetched say about how the broadcast is played: undefined where
 * they cannot tell (it takes two rounds next to each other, both with games).
 */
export function playOf(source: LichessBroadcast): LichessPlay | undefined {
  let compared = 0;
  let again = 0;
  let same = true;
  for (let i = 1; i < source.rounds.length; i++) {
    const before = (source.games[source.rounds[i - 1]!.id] ?? []).map(pairOf);
    const after = (source.games[source.rounds[i]!.id] ?? []).map(pairOf);
    if (!before.length || !after.length) continue;
    const earlier = new Set(before);
    for (const pair of after) {
      compared++;
      if (pair && earlier.has(pair)) again++;
      else same = false;
    }
    if (before.length !== after.length) same = false;
  }
  if (!compared) return undefined;
  if (again / compared < 0.5) return "games";
  return same ? "fixed" : "matches";
}

/** A round that settles a tie, which is played only where there is one. */
const TIEBREAK = /armageddon|tie.?break|play.?off|sudden death/i;
const MINUTE = 60_000;

/**
 * Matches, where a broadcast is played as matches: one for each two players who meet, with
 * their games in it in the order they are played. A game counts for what the organiser says
 * it counts (a rapid win may be worth four, a blitz win one), and is known by the round and
 * the name Lichess gives it, so that a page can listen to it being played.
 *
 * Only the rounds that were fetched are in a match here; the store keeps the ones it already
 * has. So what is said about the match as a whole rests on the rounds, which are all known:
 * whether more games are to come, and when the next one begins.
 */
function toSeries(
  source: LichessBroadcast,
  tournamentId: string,
  play: LichessPlay,
  now: number,
): Match[] {
  const { rounds, tour } = source;
  const pairs = new Map<
    string,
    { ids: [string, string]; games: GameResult[]; rounds: Set<string> }
  >();
  for (const round of rounds) {
    (source.games[round.id] ?? []).forEach((game, board) => {
      const made = toGame(game, board, round, now);
      const key = pairOf(game);
      if (!made || !key) return;
      const ids = key.split("|") as [string, string];
      const pair = pairs.get(key) ?? { ids, games: [], rounds: new Set<string>() };
      pairs.set(key, pair);
      pair.rounds.add(round.id);
      // The sides of the match stand in a fixed order; who has White changes from game to game.
      const first = made.white === ids[0] ? 0 : 1;
      const { state } = made;
      const winner =
        typeof state.winner === "number" ? (state.winner === 0 ? first : 1 - first) : state.winner;
      const worth = round.customScoring;
      const points = [0, 0];
      if (state.winner === "draw") {
        points[first] = worth?.white.draw ?? 0.5;
        points[1 - first] = worth?.black.draw ?? 0.5;
      } else if (state.winner === 0) points[first] = worth?.white.win ?? 1;
      else if (state.winner === 1) points[1 - first] = worth?.black.win ?? 1;
      pair.games.push({
        ...state,
        label: round.name,
        firstSide: first,
        winner,
        scores: undefined,
        points: state.winner === undefined ? undefined : points,
        ref: `${round.id}/${game.id}`,
        startedAt: round.startsAt ? instant(round.startsAt) : undefined,
      });
    });
  }
  // The rounds that count towards every match, where the pairings never change.
  const regular = rounds.filter((r) => !TIEBREAK.test(r.name));
  const out: Match[] = [];
  for (const pair of pairs.values()) {
    const live = pair.games.some((g) => g.status === "live");
    const waiting = pair.games.find((g) => g.status === "scheduled");
    // With fixed pairings, a round still to be played is a game still to come for this match.
    const coming =
      play === "fixed" ? regular.find((r) => !r.finished && !pair.rounds.has(r.id)) : undefined;
    const nextAt = waiting?.startedAt ? Date.parse(waiting.startedAt) : coming?.startsAt;
    // Between two games of an afternoon the match is being played; overnight it is not.
    const soon = nextAt !== undefined && nextAt - now < 90 * MINUTE;
    const status = live ? "live" : waiting || coming ? (soon ? "live" : "scheduled") : "finished";
    const starts = pair.games.flatMap((g) => (g.startedAt ? [g.startedAt] : [])).sort();
    out.push({
      id: `${tournamentId}-${pair.ids.map((id) => id.replace(/^(fide|lichess)-/, "")).join("-")}`,
      tournamentId,
      stageId: "matches",
      roundId: `${tournamentId}-matches`,
      scheduledAt: status === "scheduled" && nextAt ? instant(nextAt) : (starts[0] ?? instant(now)),
      bestOf: play === "fixed" ? Math.max(regular.length, pair.games.length) : pair.games.length,
      status,
      sides: [{ competitorId: pair.ids[0] }, { competitorId: pair.ids[1] }],
      games: pair.games,
      stream: { label: "Lichess", url: tour.url },
    });
  }
  return out;
}

/**
 * One broadcast as a tournament with its players and the games of the rounds that were
 * fetched. `play` is what earlier looks found out about how it is played; what this look
 * finds out is given back, to be kept for the next.
 */
export function mapBroadcast(
  source: LichessBroadcast,
  now: number,
  play?: LichessPlay,
): Mapped & { play: LichessPlay } {
  const { tour, rounds } = source;
  const id = `lichess-${tour.id}`;
  const seen = playOf(source);
  // Once matches, always matches; pairings that changed once are not fixed again.
  const how: LichessPlay =
    seen === undefined
      ? (play ?? "games")
      : seen === "games"
        ? play && play !== "games"
          ? "matches"
          : "games"
        : play === "matches"
          ? "matches"
          : seen;
  const competitors = new Map<string, Player>();
  const matches: Match[] = [];
  for (const round of rounds) {
    for (const game of source.games[round.id] ?? []) {
      for (const p of game.players ?? []) {
        const pid = playerId(p);
        if (pid && !competitors.has(pid)) competitors.set(pid, toPlayer(p, pid));
      }
    }
  }
  let stageRounds: Stage["rounds"];
  if (how === "games") {
    stageRounds = rounds.map((round, index) => {
      const ids: string[] = [];
      (source.games[round.id] ?? []).forEach((game, board) => {
        const match = toMatch(game, board, round, id, now);
        if (!match) return;
        matches.push(match);
        ids.push(match.id);
      });
      return { id: `lichess-${round.id}`, name: round.name, short: `R${index + 1}`, matchIds: ids };
    });
  } else {
    matches.push(...toSeries(source, id, how, now));
    stageRounds = [
      { id: `${id}-matches`, name: "Matches", short: "M", matchIds: matches.map((m) => m.id) },
    ];
  }

  const starts = rounds.flatMap((r) => (r.startsAt ? [r.startsAt] : []));
  const start = tour.dates?.[0] ?? Math.min(...starts, now);
  const end = tour.dates?.[1] ?? Math.max(...starts, start);
  const [city, country] = (tour.info?.location ?? "").split(",").map((s) => s.trim());
  const format = formatOf(tour.info?.format);
  const tournament: Tournament = {
    id,
    discipline: "chess",
    name: tour.name.replaceAll(" | ", ": "),
    short: (tour.name.split(" | ")[0] ?? tour.name).trim(),
    series: source.group?.name,
    tier: tour.tier === 5 ? "S" : tour.tier === 4 ? "A" : "B",
    organizer: "",
    location: city ? { city, country: country ?? "" } : null,
    start: day(start),
    end: day(end),
    colors: { primary: "#000000", secondary: "#ffffff" },
    participantIds: [...competitors.keys()],
    stages: [
      how === "games"
        ? {
            id: "rounds",
            name: format === "round-robin" ? "Round robin" : "Rounds",
            format,
            start: day(start),
            end: day(end),
            // The broadcast's own words, not a description made up for it.
            explainer: [tour.info?.format, tour.info?.tc].filter(Boolean).join(". "),
            rounds: stageRounds,
          }
        : {
            id: "matches",
            name: "Matches",
            format: "rounds",
            start: day(start),
            end: day(end),
            explainer: [tour.info?.format, tour.info?.tc].filter(Boolean).join(". "),
            rounds: stageRounds,
          },
    ],
    provenance: { source: "Lichess broadcasts", checkedAt: instant(now), note: tour.url },
  };
  return { tournament, competitors: [...competitors.values()], matches, play: how };
}

/** Which rounds are worth fetching: those being played, the latest finished and the next to come. */
export function roundsToFetch(rounds: LichessRound[], limit = 4): LichessRound[] {
  const ongoing = rounds.filter((r) => r.ongoing);
  const finished = rounds.filter((r) => r.finished).slice(-2);
  const next = rounds.find((r) => !r.ongoing && !r.finished);
  return [...new Set([...ongoing, ...finished, ...(next ? [next] : [])])].slice(0, limit);
}

/**
 * Which rounds a look at what is being played needs: those under way or due within the last
 * half day, and one that ended minutes ago, so that its last results are taken down.
 */
export function roundsInPlay(rounds: LichessRound[], now: number, limit = 3): LichessRound[] {
  const MINUTE = 60_000;
  return rounds
    .filter((r) =>
      r.finished
        ? now - (r.finishedAt ?? 0) < 10 * MINUTE
        : r.ongoing || ((r.startsAt ?? Infinity) <= now && now - (r.startsAt ?? 0) < 720 * MINUTE),
    )
    .slice(-limit);
}

/**
 * When a broadcast should next be looked at, in milliseconds, or 0 for not at all: when its
 * next round is due to begin. A round that gives no time (many begin "when the last one is
 * over") is looked for every few minutes while the event is under way.
 */
export function nextLook(rounds: LichessRound[], now: number): number {
  const open = rounds.filter((r) => !r.finished);
  if (!open.length) return 0;
  // Being played, or due: the look that follows the games is the next one.
  if (open.some((r) => r.ongoing || (r.startsAt ?? Infinity) <= now)) return now;
  const begun = rounds.some((r) => r.finished);
  const times = open.flatMap((r) => (r.startsAt ? [r.startsAt] : []));
  // The next round in order has no time of its own: it follows the one before.
  if (begun && !open[0]?.startsAt) return now + 5 * 60_000;
  return times.length ? Math.min(...times) : begun ? now + 5 * 60_000 : 0;
}
