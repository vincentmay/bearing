import type { Champion, GameResult, PlayerLine } from "../model.ts";
import { sameTeam } from "./lolesports.ts";

/**
 * League of Legends games as Leaguepedia records them (lol.fandom.com): who picked and banned
 * what, and every player's line. Nothing here fetches anything.
 *
 * Leaguepedia is a wiki kept by volunteers, published under CC BY-SA 3.0, with an open query
 * interface ("Cargo") over its tables. It is a different site from Liquipedia. A game appears
 * once someone has entered it, usually within hours of its end; until then the match shows what
 * the other sources give.
 */

const API = "https://lol.fandom.com/api.php";
const HOURS = 60 * 60 * 1000;

/** One row of the table of games, with the names asked for in `gamesUrl`. */
export interface LpGame {
  id: string;
  series: string;
  n: string;
  at: string;
  minutes: string;
  team1: string;
  team2: string;
  winner: string;
  picks1: string;
  picks2: string;
  bans1: string;
  bans2: string;
  kills1: string;
  kills2: string;
  gold1: string;
  gold2: string;
  towers1: string;
  towers2: string;
  dragons1: string;
  dragons2: string;
  barons1: string;
  barons2: string;
}

/** One row of the table of player lines, with the names asked for in `playersUrl`. */
export interface LpPlayer {
  game: string;
  name: string;
  /** "1" is the blue side, which is `team1` of the game. */
  side: string;
  champion: string;
  kills: string;
  deaths: string;
  assists: string;
  gold: string;
  cs: string;
  damage: string;
  role: string;
}

const GAME_FIELDS: Record<keyof LpGame, string> = {
  id: "GameId",
  series: "MatchId",
  n: "N_GameInMatch",
  at: "DateTime_UTC",
  minutes: "Gamelength_Number",
  team1: "Team1",
  team2: "Team2",
  winner: "Winner",
  picks1: "Team1Picks",
  picks2: "Team2Picks",
  bans1: "Team1Bans",
  bans2: "Team2Bans",
  kills1: "Team1Kills",
  kills2: "Team2Kills",
  gold1: "Team1Gold",
  gold2: "Team2Gold",
  towers1: "Team1Towers",
  towers2: "Team2Towers",
  dragons1: "Team1Dragons",
  dragons2: "Team2Dragons",
  barons1: "Team1Barons",
  barons2: "Team2Barons",
};

const PLAYER_FIELDS: Record<keyof LpPlayer, string> = {
  game: "GameId",
  name: "Name",
  side: "Side",
  champion: "Champion",
  kills: "Kills",
  deaths: "Deaths",
  assists: "Assists",
  gold: "Gold",
  cs: "CS",
  damage: "DamageToChampions",
  role: "Role",
};

function url(tables: string, fields: Record<string, string>, where: string, order: string) {
  const query = new URLSearchParams({
    action: "cargoquery",
    format: "json",
    tables,
    fields: Object.entries(fields)
      .map(([as, field]) => `${field}=${as}`)
      .join(","),
    where,
    order_by: order,
    limit: "500",
  });
  return `${API}?${query.toString()}`;
}

/** A moment the way the tables write it: `2026-11-14 23:18:00`, in UTC. */
const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");
const quoted = (text: string) => `'${text.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

/** Every game that began between two moments, oldest first. One request holds up to 500. */
export function gamesUrl(from: number, to: number): string {
  return url(
    "ScoreboardGames",
    GAME_FIELDS,
    `DateTime_UTC >= ${quoted(stamp(from))} AND DateTime_UTC <= ${quoted(stamp(to))}`,
    "DateTime_UTC",
  );
}

/** The ten lines of each of these games. Fifty games fill one request. */
export function playersUrl(gameIds: string[]): string {
  return url(
    "ScoreboardPlayers",
    PLAYER_FIELDS,
    `GameId IN (${gameIds.map(quoted).join(",")})`,
    "GameId,Side,Role_Number",
  );
}

/** The rows of an answer, or nothing if it is not one. */
export function rowsOf<T>(body: unknown): T[] {
  const rows = (body as { cargoquery?: { title?: T }[] } | null)?.cargoquery;
  return Array.isArray(rows) ? rows.flatMap((r) => (r.title ? [r.title] : [])) : [];
}

const instant = (at: string) => Date.parse(`${at.replace(" ", "T")}Z`);

/**
 * The games of one series: the same two teams, the first game beginning within a few hours of
 * when the match was to start. In the order they were played.
 */
export function findGames(
  games: LpGame[],
  sides: { name: string; short: string }[],
  scheduledAt: string,
): LpGame[] {
  const [a, b] = sides;
  if (!a || !b) return [];
  const at = Date.parse(scheduledAt);
  const is = (name: string, ours: { name: string; short: string }) =>
    sameTeam({ name, code: "" }, ours);
  const theirs = games.filter(
    (g) => (is(g.team1, a) && is(g.team2, b)) || (is(g.team1, b) && is(g.team2, a)),
  );
  const bySeries = new Map<string, LpGame[]>();
  for (const g of theirs) bySeries.set(g.series, [...(bySeries.get(g.series) ?? []), g]);
  let best: LpGame[] = [];
  let off = 6 * HOURS;
  for (const list of bySeries.values()) {
    list.sort((x, y) => Number(x.n) - Number(y.n));
    const distance = Math.abs(instant(list[0]!.at) - at);
    if (distance <= off) [best, off] = [list, distance];
  }
  return best;
}

const plain = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Where each champion's picture is filed, from the game's own list of champions
 * (`champion.json` of Data Dragon): by the name written plainly.
 */
export function championKeys(body: unknown): Map<string, string> {
  const data = (body as { data?: Record<string, { id?: string; name?: string }> } | null)?.data;
  const out = new Map<string, string>();
  for (const entry of Object.values(data ?? {})) {
    if (!entry.id || !entry.name) continue;
    out.set(plain(entry.name), entry.id);
    out.set(plain(entry.id), entry.id);
  }
  return out;
}

function champions(list: string, keys: Map<string, string>): Champion[] {
  return list
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name && name !== "None")
    .map((name) => {
      const key = keys.get(plain(name));
      return key ? { name, key } : { name };
    });
}

const count = (text: string | undefined) => {
  const n = Number(text);
  return text !== undefined && text !== "" && Number.isFinite(n) ? n : undefined;
};

/**
 * One game as the match's own sides see it: who was on blue, the draft, the totals, and a line
 * for every player. `rosters` are the players Bearing knows on each side; a player it does not
 * know keeps the name the wiki gives and no link.
 */
export function readGame(
  game: LpGame,
  players: LpPlayer[],
  sides: { name: string; short: string }[],
  rosters: { id: string; handle: string }[][],
  art?: { patch: string; keys: Map<string, string> },
): Pick<
  GameResult,
  "firstSide" | "draft" | "lines" | "scores" | "objectives" | "clock" | "winner"
> | null {
  const blue = sides.findIndex((s) => sameTeam({ name: game.team1, code: "" }, s));
  if (blue < 0 || sides.length !== 2) return null;
  const keys = art?.keys ?? new Map<string, string>();
  const by = <T>(first: T, second: T): T[] => (blue === 0 ? [first, second] : [second, first]);
  const pair = (first: string, second: string): number[] | undefined => {
    const [x, y] = [count(first), count(second)];
    return x === undefined || y === undefined ? undefined : by(x, y);
  };

  const lines: PlayerLine[] = [];
  for (const p of players) {
    if (p.game !== game.id) continue;
    const side = p.side === "1" ? blue : 1 - blue;
    const known = rosters[side]?.find((r) => plain(r.handle) === plain(p.name));
    const [kills, deaths, assists] = [count(p.kills), count(p.deaths), count(p.assists)];
    if (kills === undefined || deaths === undefined || assists === undefined) continue;
    lines.push({
      playerId: known?.id ?? "",
      handle: p.name,
      side,
      kills,
      deaths,
      assists,
      role: p.role || undefined,
      gold: count(p.gold),
      champion: p.champion || undefined,
      cs: count(p.cs),
      damage: count(p.damage),
    });
  }

  const picks = by(champions(game.picks1, keys), champions(game.picks2, keys));
  const bans = by(champions(game.bans1, keys), champions(game.bans2, keys));
  const towers = pair(game.towers1, game.towers2);
  const dragons = pair(game.dragons1, game.dragons2);
  const barons = pair(game.barons1, game.barons2);
  const gold = pair(game.gold1, game.gold2);
  const minutes = count(game.minutes);
  const won = game.winner === "1" ? blue : game.winner === "2" ? 1 - blue : undefined;
  return {
    firstSide: blue,
    winner: won,
    draft: picks.some((p) => p.length) ? { patch: art?.patch, picks, bans } : undefined,
    lines: lines.length ? lines : undefined,
    scores: pair(game.kills1, game.kills2),
    objectives: towers && dragons && barons && gold ? { towers, dragons, barons, gold } : undefined,
    clock: minutes ? Math.round(minutes * 60) : undefined,
  };
}
