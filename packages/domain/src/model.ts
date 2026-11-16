/**
 * Bearing's canonical model. Every source adapter (Liquipedia, PandaScore, Lichess broadcasts, …)
 * maps into these shapes; the UI never sees a provider's own format.
 *
 * Conventions
 * - Instants are ISO-8601 strings in UTC (`2026-11-15T17:30:00Z`). Display converts to the viewer's zone.
 * - Calendar dates without a time are `YYYY-MM-DD`.
 * - Unknown stays `undefined`; nothing is filled in by guessing.
 */

export type DisciplineId = "cs2" | "lol" | "trackmania" | "chess" | "rocket-league";

/** Whether a discipline's matches are contested by teams or by individual players. */
export type CompetitorKind = "team" | "player";

export interface Discipline {
  id: DisciplineId;
  name: string;
  short: string;
  competitor: CompetitorKind;
  /** What one unit of a series is called: map, game, track… */
  unit: { one: string; many: string };
  /** Identity colours, used for accents and the discipline's stage. */
  palette: { accent: string; glow: string; deep: string };
}

export interface Colors {
  primary: string;
  secondary: string;
}

/** An esports organisation that may field teams in several disciplines (Vitality in CS2 and Rocket League). */
export interface Organization {
  id: string;
  name: string;
  colors: Colors;
}

export interface Team {
  kind: "team";
  id: string;
  discipline: DisciplineId;
  orgId?: string;
  name: string;
  /** Short tag used where space is tight: VIT, T1, KC. */
  short: string;
  region: string;
  /** ISO 3166-1 alpha-2, when the team has a home country. */
  country?: string;
  /** Absent when no colours are known for the team; it is then drawn in ink. */
  colors?: Colors;
  founded?: string;
  /** The address of the team's mark, where a source has one; and one made for dark grounds. */
  image?: string;
  imageDark?: string;
}

export interface Player {
  kind: "player";
  id: string;
  discipline: DisciplineId;
  handle: string;
  name?: string;
  country: string;
  born?: string;
  role?: string;
  /** Chess titles: GM, IM… */
  title?: string;
  rating?: { system: string; value: number };
  colors?: Colors;
  /** The address of a picture of the player, where a source has one. */
  image?: string;
  /** Who took the picture and under which licence, where it has to be said. */
  imageCredit?: string;
}

export type Competitor = Team | Player;

/**
 * A player's time on a team. Open-ended when `to` is absent. `from` is absent when the source
 * says who is in the team but not since when.
 */
export interface Stint {
  id: string;
  playerId: string;
  teamId: string;
  role: string;
  from?: string;
  to?: string;
  note?: string;
}

export interface Provenance {
  source: string;
  checkedAt: string;
  note?: string;
}

/**
 * How a stage works. "rounds" is for a stage Bearing knows only as a list of rounds with their
 * pairings: it is drawn as that list, and nothing is assumed about who advances.
 */
export type StageFormat =
  | "swiss"
  | "single-elim"
  | "double-elim"
  | "round-robin"
  | "cup"
  | "rounds";

export interface Round {
  id: string;
  name: string;
  short: string;
  matchIds: string[];
}

export interface Stage {
  id: string;
  name: string;
  format: StageFormat;
  start: string;
  end: string;
  /** Plain-language explanation of how the stage works. */
  explainer: string;
  rounds: Round[];
  rules?: {
    winsToAdvance?: number;
    lossesToExit?: number;
    /** Cup matches: how many of each match's competitors advance. */
    advancePerMatch?: number;
  };
}

export interface Tournament {
  id: string;
  discipline: DisciplineId;
  name: string;
  short: string;
  series?: string;
  tier: "S" | "A" | "B";
  organizer: string;
  location: { city: string; country: string; venue?: string } | null;
  start: string;
  end: string;
  prize?: { amount: number; currency: string };
  /** Not shown anywhere: on a page the only colour belongs to a team or a player. */
  colors?: Colors;
  participantIds: string[];
  stages: Stage[];
  provenance: Provenance;
  /** Prize distribution and, as they become known, who finished where. */
  placements?: Placement[];
  /** Short line on what the event is, shown on cards and headers. */
  blurb?: string;
}

export interface Placement {
  place: string;
  /** 1-based first place this band covers, for sorting. */
  rank: number;
  prize?: number;
  competitorIds: string[];
}

export type MatchStatus = "scheduled" | "live" | "finished";

export interface Side {
  competitorId: string | null;
  /** Shown while the competitor is undecided: "Winner of SF1". */
  placeholder?: string;
}

/** One map, game or track inside a series. */
export interface GameResult {
  label: string;
  status: MatchStatus;
  /** Score per side, aligned with `Match.sides`. */
  scores?: number[];
  winner?: number | "draw";
  /** Side index that picked this map; absent for deciders. */
  pickedBy?: number;
  /** Chess: side index playing white. LoL: side index on blue. */
  firstSide?: number;
  detail?: string;
  /** CS2: every round in order. */
  rounds?: RoundRecord[];
  /** Per-player lines for this game. */
  lines?: PlayerLine[];
  /** LoL: objective counts per side. */
  objectives?: { towers: number[]; dragons: number[]; barons: number[]; gold: number[] };
  /** Chess: current or final position, clocks, engine evaluation (white's view). */
  chess?: { fen: string; move: number; clocks?: string[]; eval?: number; lastMove?: string };
  /** Chess: the moves played so far, as they are written down ("e4", "Nf3", "O-O"). */
  moves?: string[];
  /**
   * Trackmania cup: the point limit, the round being raced, who has reached the limit, and the
   * finishing order of every round raced so far (side indices, first place first).
   */
  cup?: { limit: number; round: number; finalists: number[]; rounds?: number[][] };
  /** The instant the game began, where a source says so. */
  startedAt?: string;
  /** Seconds on the game clock: played so far while live, in total once finished. */
  clock?: number;
  /** Things that happened at a known moment, in order: Rocket League goals, League objectives. */
  events?: GameEvent[];
  /** LoL: how far the first side led in gold at each minute of the game; negative when behind. */
  lead?: number[];
  /** LoL: which champions each side took and which it denied the other. */
  draft?: Draft;
}

/** A champion by name, and by the name its picture is filed under where that is known. */
export interface Champion {
  name: string;
  key?: string;
}

/** The champions of one game, per side in the order of `Match.sides`. */
export interface Draft {
  /** The version of the game the pictures are taken from. */
  patch?: string;
  picks: Champion[][];
  bans: Champion[][];
}

/** One goal or objective, with the moment it happened. */
export interface GameEvent {
  /** Seconds on the game clock, counted up from the start of the game. */
  at: number;
  side: number;
  kind: "goal" | "tower" | "dragon" | "baron";
}

export interface RoundRecord {
  winner: number;
  how: "elimination" | "bomb" | "defuse" | "time";
  /** Side index playing counter-terrorist this round. */
  ct: number;
}

export interface PlayerLine {
  /** Empty when the source names a player Bearing does not know; `handle` then says who. */
  playerId: string;
  /** The player's name as the source of the line writes it. */
  handle?: string;
  side: number;
  kills: number;
  deaths: number;
  assists: number;
  /** CS2: average damage per round and a rating where 1.00 is average. */
  adr?: number;
  rating?: number;
  /** LoL: role played and gold earned. */
  role?: string;
  gold?: number;
  /** LoL: the champion played, minions killed, and damage dealt to champions. */
  champion?: string;
  cs?: number;
  damage?: number;
}

export interface Veto {
  action: "ban" | "pick" | "decider";
  side?: number;
  label: string;
}

export interface Match {
  id: string;
  tournamentId: string;
  stageId: string;
  roundId: string;
  scheduledAt: string;
  bestOf: number;
  status: MatchStatus;
  /** Usually two; Trackmania cup matches have four. */
  sides: Side[];
  games: GameResult[];
  veto?: Veto[];
  stream?: { label: string; url: string };
  /** Where winner and loser go next, by match id. */
  next?: { winner?: string; loser?: string };
  /** Cup matches: side indices in finishing order. */
  ranking?: number[];
}

export interface Follow {
  kind: "team" | "player" | "tournament" | "discipline" | "organization";
  id: string;
}

/** A self-contained snapshot of everything Bearing knows. */
export interface World {
  now: string;
  disciplines: Discipline[];
  organizations: Organization[];
  competitors: Competitor[];
  stints: Stint[];
  tournaments: Tournament[];
  matches: Match[];
  follows: Follow[];
  rankings: Ranking[];
}

export interface Ranking {
  discipline: DisciplineId;
  title: string;
  /**
   * In order. `competitorId` is empty for a team Bearing does not have; `name` then says who.
   * `rank` is the place the source gives, which the position in this list need not be.
   */
  entries: { competitorId: string; points: number; change: number; rank?: number; name?: string }[];
}
