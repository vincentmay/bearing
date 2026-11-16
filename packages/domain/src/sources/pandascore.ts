import type {
  DisciplineId,
  GameResult,
  Match,
  MatchStatus,
  Placement,
  Player,
  Stage,
  Stint,
  Team,
  Tournament,
} from "../model.ts";
import { teamColors } from "./colors.ts";

/**
 * PandaScore, mapped into the canonical model: Counter-Strike 2, League of Legends and Rocket
 * League. Nothing here fetches anything, so it can be tested against saved answers.
 *
 * API: https://developers.pandascore.co. This uses what the free plan gives: every match with
 * its series score and the winner of each game, the bracket, the teams and their players, the
 * prize pool. It does not give what happens inside a game (rounds, objectives, goals), so those
 * stay unknown and the screens draw the series only.
 *
 * PandaScore's own words: a "league" is the competition (BLAST Rivals), a "serie" is one edition
 * of it (Fall 2026), and a "tournament" is one stage of that edition (Group A, Playoffs). One
 * serie becomes one Bearing tournament; its tournaments become the stages.
 */

export interface PandaTeam {
  id: number;
  name: string;
  acronym?: string | null;
  location?: string | null;
  slug?: string | null;
}

export interface PandaPlayer {
  id: number;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  nationality?: string | null;
  role?: string | null;
  birthday?: string | null;
  active?: boolean;
}

export interface PandaGame {
  position: number;
  /** "not_started", "running" or "finished". */
  status: string;
  /** Seconds the game lasted. */
  length?: number | null;
  forfeit?: boolean;
  winner?: { id: number | null; type?: string | null } | null;
}

export interface PandaMatch {
  id: number;
  name: string;
  /** "not_started", "running", "finished", "canceled" or "postponed". */
  status: string;
  scheduled_at?: string | null;
  begin_at?: string | null;
  number_of_games: number;
  tournament_id: number;
  opponents?: { type?: string; opponent: PandaTeam }[];
  games?: PandaGame[];
  results?: { team_id?: number; score: number }[];
  streams_list?: { main?: boolean; official?: boolean; language?: string; raw_url?: string }[];
  /** Brackets only: the matches whose winner or loser plays this one. */
  previous_matches?: { /** "winner" or "loser". */ type: string; match_id: number }[];
}

export interface PandaStage {
  id: number;
  name: string;
  /** "s" is the top of the game, then "a" to "d". */
  tier?: string | null;
  type?: string | null;
  country?: string | null;
  begin_at?: string | null;
  end_at?: string | null;
  prizepool?: string | null;
  has_bracket?: boolean;
  winner_id?: number | null;
  teams?: PandaTeam[];
}

export interface PandaLeague {
  id: number;
  name: string;
}

export interface PandaEdition {
  id: number;
  full_name?: string | null;
  begin_at?: string | null;
  end_at?: string | null;
}

export interface PandaSerie {
  league: PandaLeague;
  serie: PandaEdition;
  /** The stages of this edition. */
  tournaments: PandaStage[];
  /** Every match of the edition, with opponents, games and results. */
  matches: PandaMatch[];
  /** By stage id: the same matches as a bracket, with what feeds what. */
  brackets: Record<string, PandaMatch[]>;
  /** By stage id: the teams entered, with their players. */
  rosters: Record<string, { rosters?: (PandaTeam & { players?: PandaPlayer[] })[] }>;
}

export interface Mapped {
  tournament: Tournament;
  competitors: (Team | Player)[];
  stints: Stint[];
  matches: Match[];
}

const UNIT: Record<DisciplineId, string> = {
  cs2: "Map",
  lol: "Game",
  "rocket-league": "Game",
  chess: "Game",
  trackmania: "Round",
};

const ROLES: Record<string, string> = {
  top: "Top",
  jun: "Jungle",
  mid: "Mid",
  adc: "Bot",
  sup: "Support",
};

const CURRENCY: Record<string, string> = {
  "United States Dollar": "USD",
  Euro: "EUR",
  "British Pound": "GBP",
  "Chinese Yuan": "CNY",
  "South Korean Won": "KRW",
  "Brazilian Real": "BRL",
  "Swedish Krona": "SEK",
  "Danish Krone": "DKK",
  "Polish Zloty": "PLN",
  "Australian Dollar": "AUD",
  "Canadian Dollar": "CAD",
  "Japanese Yen": "JPY",
};

const WORDS: Record<number, string> = { 1: "one", 2: "two", 3: "three", 5: "five", 7: "seven" };

const teamId = (id: number) => `ps-team-${id}`;
const playerId = (id: number) => `ps-player-${id}`;
const matchId = (id: number) => `ps-match-${id}`;
const day = (iso: string) => iso.slice(0, 10);
const instant = (iso: string) => iso.replace(/\.\d+Z$/, "Z");

/** "1,000,000 United States Dollar" is a million dollars; a currency Bearing cannot name is left out. */
export function prizeOf(text: string | null | undefined): Tournament["prize"] {
  const m = /^([\d,.\s]+)\s+(.+)$/.exec(text?.trim() ?? "");
  if (!m?.[1] || !m[2]) return undefined;
  const amount = Number(m[1].replace(/[,\s]/g, ""));
  const currency = CURRENCY[m[2].trim()];
  return currency && Number.isFinite(amount) && amount > 0 ? { amount, currency } : undefined;
}

function toTeam(t: PandaTeam, discipline: DisciplineId): Team {
  return {
    kind: "team",
    id: teamId(t.id),
    discipline,
    name: t.name,
    short: (t.acronym || t.name).slice(0, 5).toUpperCase(),
    // PandaScore gives a country, not a region; where it gives nothing, nothing is shown.
    region: "",
    country: t.location ?? undefined,
    colors: teamColors(t.name),
  };
}

function toPlayer(p: PandaPlayer, discipline: DisciplineId): Player {
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
  return {
    kind: "player",
    id: playerId(p.id),
    discipline,
    handle: p.name,
    name: name || undefined,
    country: p.nationality ?? "",
    born: p.birthday ?? undefined,
    role: p.role ? (ROLES[p.role] ?? p.role) : undefined,
  };
}

const STATUS: Record<string, MatchStatus> = {
  not_started: "scheduled",
  postponed: "scheduled",
  running: "live",
  finished: "finished",
};

/** "Quarterfinal 2: A vs B" belongs to the round "Quarterfinals"; a match with no such prefix opens the stage. */
function roundName(match: PandaMatch): string {
  const prefix = match.name.includes(":") ? match.name.split(":")[0]!.trim() : "";
  if (!prefix) return "Opening matches";
  const base = prefix.replace(/\s*#?\d+$/, "").trim();
  if (/final$/i.test(base) && !/grand|^final$/i.test(base) && /\d$/.test(prefix)) return `${base}s`;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function shortName(name: string): string {
  const known: Record<string, string> = {
    quarterfinals: "QF",
    semifinals: "SF",
    "grand final": "GF",
    final: "F",
  };
  return (
    known[name.toLowerCase()] ??
    name
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 3)
  );
}

function toMatch(
  m: PandaMatch,
  discipline: DisciplineId,
  tournamentId: string,
  byId: Map<number, PandaMatch>,
): Match | null {
  const status = STATUS[m.status];
  const at = m.scheduled_at ?? m.begin_at;
  // A cancelled match is not a match; one without a time cannot be put on a schedule.
  if (!status || !at) return null;
  const opponents = m.opponents ?? [];
  const feeders = m.previous_matches ?? [];
  const sides: Match["sides"] = [0, 1].map((i) => {
    const o = opponents[i]?.opponent;
    if (o) return { competitorId: teamId(o.id) };
    // Still open: say where the team will come from, when the bracket says so.
    const from = feeders[i - opponents.length] ?? feeders[i];
    const source = from ? byId.get(from.match_id) : undefined;
    const label = source?.name.includes(":") ? source.name.split(":")[0]!.trim() : undefined;
    return {
      competitorId: null,
      placeholder: label
        ? `${from!.type === "loser" ? "Loser" : "Winner"} of ${label}`
        : "To be decided",
    };
  });
  const index = (id: number | null | undefined) => opponents.findIndex((o) => o.opponent.id === id);

  const unit = UNIT[discipline];
  const games: GameResult[] = [...(m.games ?? [])]
    .sort((a, b) => a.position - b.position)
    .filter((g) => g.status !== "not_played")
    .map((g): GameResult => {
      const state = STATUS[g.status] ?? "scheduled";
      const w = index(g.winner?.id);
      return {
        label: `${unit} ${g.position}`,
        status: state,
        winner: state === "finished" && w >= 0 ? w : undefined,
        // Only League's length is time on the game clock; elsewhere it is time on the wall.
        clock: state === "finished" && discipline === "lol" && g.length ? g.length : undefined,
        detail: g.forfeit ? "Forfeit" : undefined,
      };
    });
  // A series still to be played or under way has all its possible games, whatever was listed.
  if (status !== "finished") {
    for (let n = games.length + 1; n <= m.number_of_games; n++)
      games.push({ label: `${unit} ${n}`, status: "scheduled" });
  }

  const stream =
    m.streams_list?.find((s) => s.main && s.raw_url) ??
    m.streams_list?.find((s) => s.official && s.raw_url) ??
    m.streams_list?.find((s) => s.raw_url);
  return {
    id: matchId(m.id),
    tournamentId,
    stageId: `ps-stage-${m.tournament_id}`,
    roundId: "",
    scheduledAt: instant(at),
    bestOf: m.number_of_games,
    status,
    sides,
    games,
    stream: stream?.raw_url ? { label: "Stream", url: stream.raw_url } : undefined,
  };
}

/** How a stage works, said only from its structure: who feeds whom, and how long a series is. */
function explain(format: Stage["format"], teams: number, lengths: number[]): string {
  const parts: string[] = [];
  if (format === "single-elim")
    parts.push(
      `${teams ? `${teams} teams, single` : "Single"} elimination: lose once and you are out.`,
    );
  if (format === "double-elim")
    parts.push(
      `${teams ? `${teams} teams. ` : ""}Losing an early match does not end it here: the losers play on in elimination matches.`,
    );
  const distinct = [...new Set(lengths)].sort((a, b) => a - b);
  const word = (n: number) => `best-of-${WORDS[n] ?? n}`;
  if (distinct.length === 1) parts.push(`Every series is ${word(distinct[0]!)}.`);
  else if (distinct.length > 1)
    parts.push(`Series are ${distinct.map(word).join(distinct.length > 2 ? ", " : " and ")}.`);
  return parts.join(" ");
}

/** One edition of a competition as a tournament with its stages, teams, players and matches. */
export function mapSerie(source: PandaSerie, discipline: DisciplineId, now: number): Mapped {
  const { league, serie } = source;
  const id = `ps-serie-${serie.id}`;
  const stagesIn = [...source.tournaments].sort((a, b) =>
    (a.begin_at ?? "").localeCompare(b.begin_at ?? ""),
  );

  // The bracket's copy of a match knows what feeds it; the full copy knows the rest.
  const feeds = new Map<number, PandaMatch["previous_matches"]>();
  for (const list of Object.values(source.brackets))
    for (const b of list) feeds.set(b.id, b.previous_matches ?? []);
  const raw = source.matches.map((m) => ({ ...m, previous_matches: feeds.get(m.id) }));
  const byId = new Map(raw.map((m) => [m.id, m]));

  const matches: Match[] = [];
  const kept = new Map<number, Match>();
  const known = new Set(stagesIn.map((x) => x.id));
  for (const m of raw) {
    // A match of a stage that was not handed over has nowhere to sit.
    const mapped = known.has(m.tournament_id) ? toMatch(m, discipline, id, byId) : null;
    if (!mapped) continue;
    matches.push(mapped);
    kept.set(m.id, mapped);
  }
  // Where the winner and the loser go next.
  for (const m of raw) {
    for (const f of m.previous_matches ?? []) {
      const from = kept.get(f.match_id);
      const to = kept.get(m.id);
      if (!from || !to) continue;
      from.next = { ...from.next, [f.type === "loser" ? "loser" : "winner"]: to.id };
    }
  }

  const teams = new Map<string, Team>();
  const players = new Map<string, Player>();
  const stints = new Map<string, Stint>();
  const add = (t: PandaTeam) => {
    if (!teams.has(teamId(t.id))) teams.set(teamId(t.id), toTeam(t, discipline));
  };
  for (const s of stagesIn) for (const t of s.teams ?? []) add(t);
  for (const m of raw) for (const o of m.opponents ?? []) add(o.opponent);
  for (const entry of Object.values(source.rosters)) {
    for (const roster of entry.rosters ?? []) {
      add(roster);
      for (const p of roster.players ?? []) {
        if (p.active === false) continue;
        players.set(playerId(p.id), toPlayer(p, discipline));
        const key = `ps-${roster.id}-${p.id}`;
        // When a player joined is not something PandaScore says, so the stint has no start.
        stints.set(key, {
          id: key,
          playerId: playerId(p.id),
          teamId: teamId(roster.id),
          role: p.role ? (ROLES[p.role] ?? p.role) : "",
        });
      }
    }
  }

  const stages: Stage[] = stagesIn.map((s) => {
    const mine = raw
      .filter((m) => m.tournament_id === s.id && kept.has(m.id))
      .sort((a, b) => kept.get(a.id)!.scheduledAt.localeCompare(kept.get(b.id)!.scheduledAt));
    const links = mine.flatMap((m) => m.previous_matches ?? []);
    const format: Stage["format"] = !s.has_bracket
      ? "rounds"
      : links.some((l) => l.type === "loser")
        ? "double-elim"
        : "single-elim";

    // Rounds: by depth in the tree for a bracket, so that a match sits after what feeds it;
    // by the name PandaScore gives the match otherwise.
    const depth = new Map<number, number>();
    const depthOf = (m: PandaMatch): number => {
      const known = depth.get(m.id);
      if (known !== undefined) return known;
      depth.set(m.id, 0);
      const before = (m.previous_matches ?? [])
        .map((f) => byId.get(f.match_id))
        .filter((x): x is (typeof raw)[number] => !!x && kept.has(x.id));
      const d = before.length ? 1 + Math.max(...before.map(depthOf)) : 0;
      depth.set(m.id, d);
      return d;
    };
    const groups = new Map<string, { name: string; order: number; ids: string[] }>();
    for (const m of mine) {
      const name = roundName(m);
      const key = format === "single-elim" ? `${depthOf(m)}` : name;
      const order = format === "single-elim" ? depthOf(m) : groups.size;
      const group = groups.get(key) ?? { name, order, ids: [] };
      group.ids.push(matchId(m.id));
      groups.set(key, group);
    }
    const rounds = [...groups.values()]
      .sort((a, b) => a.order - b.order)
      .map((g, i) => {
        const roundId = `ps-stage-${s.id}-r${i + 1}`;
        for (const mid of g.ids) {
          const match = matches.find((x) => x.id === mid);
          if (match) match.roundId = roundId;
        }
        return { id: roundId, name: g.name, short: shortName(g.name), matchIds: g.ids };
      });
    const start = s.begin_at ?? serie.begin_at ?? new Date(now).toISOString();
    return {
      id: `ps-stage-${s.id}`,
      name: s.name,
      format,
      start: day(start),
      end: day(s.end_at ?? start),
      explainer: explain(
        format,
        s.teams?.length ?? 0,
        mine.map((m) => m.number_of_games),
      ),
      rounds,
    };
  });

  // What is known of the final places: who won the last stage and, in a bracket, who they beat.
  const last = stagesIn.at(-1);
  const placements: Placement[] = [];
  if (last?.winner_id) {
    placements.push({ place: "1st", rank: 1, competitorIds: [teamId(last.winner_id)] });
    const final = raw
      .filter((m) => m.tournament_id === last.id && m.status === "finished")
      .find((m) => !raw.some((x) => x.previous_matches?.some((f) => f.match_id === m.id)));
    const loser = final?.opponents?.find((o) => o.opponent.id !== last.winner_id)?.opponent;
    if (
      last.has_bracket &&
      loser &&
      final?.opponents?.some((o) => o.opponent.id === last.winner_id)
    )
      placements.push({ place: "2nd", rank: 2, competitorIds: [teamId(loser.id)] });
  }

  const tiers = stagesIn.map((s) => s.tier);
  const begins = stagesIn.flatMap((s) => (s.begin_at ? [s.begin_at] : []));
  const ends = stagesIn.flatMap((s) => (s.end_at ? [s.end_at] : []));
  const start = serie.begin_at ?? begins.sort()[0] ?? new Date(now).toISOString();
  const end = serie.end_at ?? ends.sort().at(-1) ?? start;
  const offline = stagesIn.find((s) => s.type === "offline" && s.country);
  const prizes = stagesIn.flatMap((s) => prizeOf(s.prizepool) ?? []);
  const edition = serie.full_name?.trim();
  const tournament: Tournament = {
    id,
    discipline,
    name: edition ? `${league.name} ${edition}` : league.name,
    short: league.name,
    series: league.name,
    tier: tiers.includes("s") ? "S" : tiers.includes("a") ? "A" : "B",
    organizer: "",
    location: offline?.country ? { city: "", country: offline.country } : null,
    start: day(start),
    end: day(end),
    // Each stage may repeat the pool of the whole event; the largest figure is the pool.
    prize: prizes.sort((a, b) => b.amount - a.amount)[0],
    participantIds: [...teams.keys()],
    stages,
    placements: placements.length ? placements : undefined,
    provenance: {
      source: "PandaScore",
      checkedAt: new Date(now).toISOString().replace(/\.\d+Z$/, "Z"),
    },
  };
  return {
    tournament,
    competitors: [...teams.values(), ...players.values()],
    stints: [...stints.values()],
    matches,
  };
}

/**
 * PandaScore's names for each game: `slug` in its addresses, `videogame` on a match.
 */
export const PANDA_GAMES: { slug: string; videogame: string; discipline: DisciplineId }[] = [
  { slug: "csgo", videogame: "cs-go", discipline: "cs2" },
  { slug: "lol", videogame: "league-of-legends", discipline: "lol" },
  { slug: "rl", videogame: "rl", discipline: "rocket-league" },
];

/**
 * One match on its own, as it stands now, for refreshing what is under way. Where it sits in
 * its event is not known from a single match and is left for the store to keep.
 */
export function mapLiveMatch(m: PandaMatch, discipline: DisciplineId): Match | null {
  return toMatch(m, discipline, "", new Map());
}

/** Which editions to follow: those of the top tiers that have a match in the given lists. */
export function seriesToFollow(
  matches: { serie_id?: number; tournament?: { tier?: string | null } }[],
  tiers: readonly string[],
  limit: number,
): number[] {
  const count = new Map<number, number>();
  for (const m of matches) {
    if (!m.serie_id || !tiers.includes(m.tournament?.tier ?? "")) continue;
    count.set(m.serie_id, (count.get(m.serie_id) ?? 0) + 1);
  }
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}
