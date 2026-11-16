import type { Champion, GameEvent, GameResult, PlayerLine } from "../model.ts";

/**
 * What happens inside a League of Legends game, from the feed behind lolesports.com: kills,
 * towers, dragons, barons and gold, moment by moment. Nothing here fetches anything.
 *
 * This is not a documented, supported API. It is what Riot's own site reads, it asks for no
 * account, and no terms were found that either allow or forbid reading it. Bearing reads it
 * sparingly, for League only, and only to add detail to matches it already knows from elsewhere;
 * if it stops answering, those matches simply go back to showing the series alone.
 */

export interface LolSide {
  totalGold: number;
  totalKills: number;
  towers: number;
  barons: number;
  /** One entry per dragon taken, by kind. */
  dragons: string[];
  /** Each of the five players at this moment. */
  participants?: LolParticipant[];
}

export interface LolParticipant {
  participantId: number;
  totalGold?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  creepScore?: number;
}

/** Who sits where in a game: the player's name, their champion and their position. */
export interface LolSeat {
  participantId: number;
  /** The team's tag and the player's name: "GEN Kiin". */
  summonerName?: string;
  /** The champion, by the name its picture is filed under: "LeeSin". */
  championId?: string;
  role?: string;
}

export interface LolMeta {
  /** The version of the game being played: "16.20.826.3891". */
  patchVersion?: string;
  blueTeamMetadata?: { participantMetadata?: LolSeat[] };
  redTeamMetadata?: { participantMetadata?: LolSeat[] };
}

export interface LolFrame {
  rfc460Timestamp: string;
  /** "in_game", "paused" or "finished". */
  gameState: string;
  blueTeam: LolSide;
  redTeam: LolSide;
}

export interface LolEvent {
  startTime: string;
  match?: { id: string; teams: { name: string; code: string }[] };
}

export interface LolDetails {
  match: {
    teams: { id: string; name: string; code: string }[];
    games: { id: string; number: number; state: string; teams: { id: string; side: string }[] }[];
  };
}

const HOURS = 60 * 60 * 1000;

function key(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b(team|esports?|gaming|club)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Whether a team as lolesports names it is the team Bearing knows by this name and short name. */
export function sameTeam(
  theirs: { name: string; code: string },
  ours: { name: string; short: string },
): boolean {
  if (key(theirs.code) && key(theirs.code) === key(ours.short)) return true;
  const a = key(theirs.name);
  const b = key(ours.name);
  return a.length > 1 && b.length > 1 && (a === b || a.includes(b) || b.includes(a));
}

/** The lolesports event that is this match: the same two teams, starting within three hours. */
export function findEvent(
  events: LolEvent[],
  sides: { name: string; short: string }[],
  scheduledAt: string,
): LolEvent | undefined {
  const at = Date.parse(scheduledAt);
  const [a, b] = sides;
  if (!a || !b) return undefined;
  return events.find((e) => {
    const teams = e.match?.teams;
    if (teams?.length !== 2 || Math.abs(Date.parse(e.startTime) - at) > 3 * HOURS) return false;
    const [x, y] = teams as [(typeof teams)[number], (typeof teams)[number]];
    return (sameTeam(x, a) && sameTeam(y, b)) || (sameTeam(x, b) && sameTeam(y, a));
  });
}

/** Which of the match's two sides plays on blue in a game, or undefined if it cannot be told. */
export function blueSide(
  details: LolDetails,
  gameNumber: number,
  sides: { name: string; short: string }[],
): number | undefined {
  const game = details.match.games.find((g) => g.number === gameNumber);
  const blueId = game?.teams.find((t) => t.side === "blue")?.id;
  const blue = details.match.teams.find((t) => t.id === blueId);
  if (!blue) return undefined;
  const index = sides.findIndex((s) => sameTeam(blue, s));
  return index >= 0 ? index : undefined;
}

/** What is known of a game at one moment, by the match's own sides rather than by blue and red. */
export interface LolState {
  /** Seconds since the first frame. */
  clock: number;
  finished: boolean;
  kills: number[];
  towers: number[];
  dragons: number[];
  barons: number[];
  gold: number[];
}

export function stateOf(frame: LolFrame, startedAt: number, blue: number): LolState {
  const by = (pick: (s: LolSide) => number) => {
    const out = [0, 0];
    out[blue] = pick(frame.blueTeam);
    out[1 - blue] = pick(frame.redTeam);
    return out;
  };
  return {
    clock: Math.max(0, Math.round((Date.parse(frame.rfc460Timestamp) - startedAt) / 1000)),
    finished: frame.gameState === "finished",
    kills: by((s) => s.totalKills),
    towers: by((s) => s.towers),
    dragons: by((s) => s.dragons.length),
    barons: by((s) => s.barons),
    gold: by((s) => s.totalGold),
  };
}

const KINDS = [
  ["towers", "tower"],
  ["dragons", "dragon"],
  ["barons", "baron"],
] as const;

/**
 * The objectives that fell between two looks at a game. Each is placed halfway between the two
 * looks, since that is all that is known about when it happened.
 */
export function between(before: LolState | undefined, after: LolState): GameEvent[] {
  const at = Math.round(((before?.clock ?? 0) + after.clock) / 2);
  const events: GameEvent[] = [];
  for (const [field, kind] of KINDS) {
    for (const side of [0, 1]) {
      const gained = (after[field][side] ?? 0) - (before?.[field][side] ?? 0);
      for (let i = 0; i < gained; i++) events.push({ at, side, kind });
    }
  }
  return events;
}

/**
 * A whole game from looks taken at intervals, oldest first: its clock, the kills, the totals,
 * and every objective at about the moment it fell.
 */
export function readGame(
  frames: LolFrame[],
  blue: number,
): Pick<
  GameResult,
  "clock" | "scores" | "objectives" | "events" | "firstSide" | "startedAt" | "lead"
> | null {
  const first = frames[0];
  if (!first) return null;
  const startedAt = Date.parse(first.rfc460Timestamp);
  const events: GameEvent[] = [];
  // The looks are a minute apart, so the lead in gold at each of them is the lead by the minute.
  const lead: number[] = [];
  let before: LolState | undefined;
  for (const frame of frames) {
    const state = stateOf(frame, startedAt, blue);
    lead.push((state.gold[0] ?? 0) - (state.gold[1] ?? 0));
    events.push(...between(before, state));
    before = state;
    if (state.finished) break;
  }
  const last = before!;
  return {
    startedAt: first.rfc460Timestamp.replace(/\.\d+Z$/, "Z"),
    firstSide: blue,
    clock: last.clock,
    scores: last.kills,
    objectives: {
      towers: last.towers,
      dragons: last.dragons,
      barons: last.barons,
      gold: last.gold,
    },
    events,
    lead,
  };
}

/** The moments at which to look at a game: once a minute from its start, on the feed's ten-second marks. */
export function lookTimes(startedAt: number, until: number, every = 60_000): string[] {
  const out: string[] = [];
  for (let t = startedAt + every; t <= until; t += every)
    out.push(new Date(Math.floor(t / 10_000) * 10_000).toISOString().replace(".000Z", "Z"));
  return out;
}

const POSITIONS: Record<string, string> = {
  top: "Top",
  jungle: "Jungle",
  mid: "Mid",
  bottom: "Bot",
  support: "Support",
};

/** A champion's name from the name its picture is filed under: "LeeSin" is "Lee Sin". */
const championName = (key: string) =>
  key === "MonkeyKing" ? "Wukong" : key.replace(/([a-z])([A-Z])/g, "$1 $2");

/**
 * The ten players at one moment of a game, by the match's own sides: who plays what, and how
 * they stand. The feed names players, it does not identify them, so a line carries the name
 * and no player; the champions make a draft without bans, which the feed does not have.
 */
export function playersOf(
  frame: LolFrame,
  meta: LolMeta | undefined,
  blue: number,
): Pick<GameResult, "lines" | "draft"> {
  if (!meta) return {};
  const lines: PlayerLine[] = [];
  const picks: Champion[][] = [[], []];
  const teams = [
    { side: blue, team: frame.blueTeam, seats: meta.blueTeamMetadata?.participantMetadata },
    { side: 1 - blue, team: frame.redTeam, seats: meta.redTeamMetadata?.participantMetadata },
  ];
  for (const { side, team, seats } of teams) {
    for (const seat of seats ?? []) {
      const champion = seat.championId
        ? { name: championName(seat.championId), key: seat.championId }
        : undefined;
      if (champion) picks[side]?.push(champion);
      const now = team.participants?.find((p) => p.participantId === seat.participantId);
      if (!now) continue;
      lines.push({
        playerId: "",
        // The name without the team's tag in front of it.
        handle: (seat.summonerName ?? "").replace(/^\S+\s+(?=\S)/, ""),
        side,
        kills: now.kills ?? 0,
        deaths: now.deaths ?? 0,
        assists: now.assists ?? 0,
        role: POSITIONS[seat.role ?? ""],
        gold: now.totalGold,
        champion: champion?.name,
        cs: now.creepScore,
      });
    }
  }
  const patch = /^(\d+\.\d+)\./.exec(meta.patchVersion ?? "")?.[1];
  return {
    lines: lines.length ? lines : undefined,
    draft: picks.some((list) => list.length)
      ? { patch: patch ? `${patch}.1` : undefined, picks, bans: [[], []] }
      : undefined,
  };
}
