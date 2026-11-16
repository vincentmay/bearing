import { movesOfPgn } from "../chess.ts";
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
  opening?: string;
}

/**
 * The games of a round out of its written record (one PGN after another), by game id: the moves
 * of each and the name of its opening where Lichess has worked one out.
 */
export function gamesOfPgn(pgn: string): Record<string, { moves: string[]; opening?: string }> {
  const games: Record<string, { moves: string[]; opening?: string }> = {};
  for (const one of pgn.split(/\n\s*\n(?=\[Event )/)) {
    const tag = (name: string) => new RegExp(`\\[${name} "([^"]*)"\\]`).exec(one)?.[1];
    const id = (tag("GameURL") ?? tag("Site"))?.split("/").at(-1);
    if (!id) continue;
    const opening = tag("Opening");
    games[id] = {
      moves: movesOfPgn(one),
      opening: opening && opening !== "?" ? opening : undefined,
    };
  }
  return games;
}

export interface LichessBroadcast {
  tour: LichessTour;
  rounds: LichessRound[];
  /** The games of each round that was fetched, by round id. A round left out is not guessed at. */
  games: Record<string, LichessGame[]>;
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

function toMatch(
  game: LichessGame,
  board: number,
  round: LichessRound,
  tournamentId: string,
  now: number,
): Match | null {
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
  return {
    id: `lichess-${game.id}`,
    tournamentId,
    stageId: "rounds",
    roundId: `lichess-${round.id}`,
    scheduledAt: instant(round.startsAt ?? now),
    bestOf: 1,
    status,
    sides: [{ competitorId: a }, { competitorId: b }],
    games: [state],
    stream: { label: "Lichess", url: round.url },
  };
}

/** One broadcast as a tournament with its players and the games of the rounds that were fetched. */
export function mapBroadcast(source: LichessBroadcast, now: number): Mapped {
  const { tour, rounds } = source;
  const id = `lichess-${tour.id}`;
  const competitors = new Map<string, Player>();
  const matches: Match[] = [];
  const stageRounds: Stage["rounds"] = rounds.map((round, index) => {
    const ids: string[] = [];
    (source.games[round.id] ?? []).forEach((game, board) => {
      const match = toMatch(game, board, round, id, now);
      if (!match) return;
      for (const [i, p] of (game.players ?? []).entries()) {
        const pid = match.sides[i]?.competitorId;
        if (pid && !competitors.has(pid)) competitors.set(pid, toPlayer(p, pid));
      }
      matches.push(match);
      ids.push(match.id);
    });
    return { id: `lichess-${round.id}`, name: round.name, short: `R${index + 1}`, matchIds: ids };
  });

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
    tier: tour.tier === 5 ? "S" : tour.tier === 4 ? "A" : "B",
    organizer: "",
    location: city ? { city, country: country ?? "" } : null,
    start: day(start),
    end: day(end),
    colors: { primary: "#000000", secondary: "#ffffff" },
    participantIds: [...competitors.keys()],
    stages: [
      {
        id: "rounds",
        name: format === "round-robin" ? "Round robin" : "Rounds",
        format,
        start: day(start),
        end: day(end),
        // The broadcast's own words, not a description made up for it.
        explainer: [tour.info?.format, tour.info?.tc].filter(Boolean).join(". "),
        rounds: stageRounds,
      },
    ],
    provenance: { source: "Lichess broadcasts", checkedAt: instant(now), note: tour.url },
  };
  return { tournament, competitors: [...competitors.values()], matches };
}

/** Which rounds are worth fetching: those being played, the latest finished and the next to come. */
export function roundsToFetch(rounds: LichessRound[], limit = 4): LichessRound[] {
  const ongoing = rounds.filter((r) => r.ongoing);
  const finished = rounds.filter((r) => r.finished).slice(-2);
  const next = rounds.find((r) => !r.ongoing && !r.finished);
  return [...new Set([...ongoing, ...finished, ...(next ? [next] : [])])].slice(0, limit);
}
