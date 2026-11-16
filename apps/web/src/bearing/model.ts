import {
  type Atlas,
  type Competitor,
  type Discipline,
  type GameResult,
  type Match,
  type Tournament,
  formatPoints,
  liveGame,
  seriesScore,
  winnerOf,
} from "@bearing/domain";
import { type Times, gameClock } from "./time";

/**
 * What the Bearing screens need to know about a match, worked out once from the domain model.
 * The rules behind it are in docs/BRAND.md: a team is a flat disc, a thing won is a flat dot,
 * and how much is shown depends on the room there is. Every word here is derived from match
 * state; nothing is guessed.
 */

/** Fixed colours for fields of more than two, in starting order. */
const FIELD = ["#00c978", "#ff8a00", "#7a5cff", "#19a8ff"];

export interface SideView {
  id: string | null;
  /** The everyday name: "Vitality", not "Team Vitality". */
  name: string;
  /** The name where room is tight: the short tag when the name is long. */
  label: string;
  /** Short name for the disc. */
  short: string;
  color: string;
  /** Text colour that reads on `color`. */
  ink: string;
  /** Teams take a plural verb ("Vitality win"), players a singular one. */
  plural: boolean;
  /** A team's mark or a player's picture, where a source has one. */
  image?: string;
  /** The picture is of a person, and is cropped to the face; a mark is shown whole. */
  person?: boolean;
}

export type Dot =
  | { k: "won"; side: number; label: string }
  | { k: "shared"; label: string }
  | { k: "now"; label: string }
  | { k: "open" }
  /** A space in the line: the half-time break in a Counter-Strike map. */
  | { k: "gap" };

/** One stop on the line of a series: a map or a game, or where the winner goes next. */
export interface Stop {
  kind: "done" | "now" | "next" | "later" | "end";
  label: string;
  sub: string;
  /** The side that won it, or "draw". */
  winner?: number | "draw";
  /** The game being played, for the stop that opens into its detail. */
  game?: GameResult;
}

export interface MatchView {
  match: Match;
  discipline: Discipline;
  tournament: Tournament;
  event: string;
  /** Where in the event this match sits: "Semifinals", "Round 3". */
  where: string;
  sides: SideView[];
  /** More than two competitors: there is no "a v b", only a field and its standings. */
  solo: boolean;
  /** The score to lead with, one entry per side; a single entry when there is no score yet. */
  headline: string[];
  status: string;
  live: boolean;
  /** The game being played, if one is. */
  game?: GameResult;
  /** Left, middle and right of the small line under the score. */
  subs: [string, string, string];
  /** The small form: rows of dots. */
  rows: Dot[][];
  /** One dot per map or game, for a row. */
  series: Dot[];
  standings: { side: SideView; index: number; points: number; finalist: boolean }[];
}

function rgb(hex: string): [number, number, number] | undefined {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!m?.[1]) return undefined;
  const h =
    m[1].length === 3
      ? m[1]
          .split("")
          .map((c) => c + c)
          .join("")
      : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Black or white, whichever reads better on the colour. */
export function inkOn(color: string): string {
  const c = rgb(color);
  if (!c) return color === "var(--ink)" ? "var(--surface)" : "var(--ink)";
  return (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000 > 150 ? "#000" : "#fff";
}

/** Two team colours too close to tell apart as dots. */
function alike(a: string, b: string): boolean {
  const x = rgb(a);
  const y = rgb(b);
  if (!x || !y) return false;
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 70;
}

/** Too close to black or to white to stand on both a light and a dark page. */
function extreme(color: string): boolean {
  const c = rgb(color);
  if (!c) return false;
  const light = (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000;
  // Pale and nearly without colour (a cream, a light grey) counts too: on white it is a ghost.
  const chroma = Math.max(...c) - Math.min(...c);
  return light < 48 || light > 236 || (light > 195 && chroma < 45);
}

/** "Team Vitality" is "Vitality" in running text. */
export function plainName(atlas: Atlas, id: string | null | undefined): string {
  return atlas.name(id).replace(/^Team /, "");
}

function tag(c: Competitor | undefined): string {
  if (!c) return "";
  return c.kind === "team" ? c.short : c.handle.slice(0, 2).toUpperCase();
}

/** A team or player on its own, outside a match: its own colour, or ink when it has none. */
export function sideOf(atlas: Atlas, id: string): SideView {
  const c = atlas.competitor(id);
  const name = plainName(atlas, id);
  // A colour that is nearly white or nearly black disappears on one of the two grounds, so a
  // team known by such a colour is drawn in ink, which is always the opposite of the ground.
  const own = c?.colors?.primary;
  const color = own && !extreme(own) ? own : "var(--ink)";
  return {
    id,
    name,
    label: c?.kind === "team" && name.length > 10 ? c.short : name,
    short: tag(c),
    color,
    ink: inkOn(color),
    plural: c?.kind === "team",
    image: c?.image,
    person: c?.kind === "player",
  };
}

/**
 * A side for someone or something Bearing has no record of: only a name, and perhaps a
 * picture. An earlier opponent, a chess player in no event, an event's own mark. Drawn in
 * ink like every side without a colour; `bare` leaves the ground out, for a mark alone.
 */
export function standIn(of: {
  name: string;
  short?: string;
  image: string | undefined;
  person: boolean;
  bare?: boolean;
}): SideView {
  return {
    id: null,
    name: of.name,
    label: of.name,
    short: of.short ?? "",
    color: of.bare ? "transparent" : "var(--ink)",
    ink: of.bare ? "var(--ink)" : "var(--ground)",
    plural: !of.person,
    image: of.image,
    person: of.person,
  };
}

function sidesOf(atlas: Atlas, match: Match, subject?: string): SideView[] {
  // Two sides with no colours of their own, as chess players always are and a team can be:
  // one takes ink, the other the surface colour. Ink goes to the one the page is about, else
  // to the one the viewer follows, else to the first named.
  const ids = match.sides.map((s) => s.competitorId);
  const inked =
    subject && ids.includes(subject)
      ? ids.indexOf(subject)
      : atlas.followsCompetitor(ids[1]) && !atlas.followsCompetitor(ids[0])
        ? 1
        : 0;
  const sides = match.sides.map((s, i): SideView => {
    if (!s.competitorId) {
      const name = s.placeholder ?? "To be decided";
      return {
        id: null,
        name,
        label: name,
        short: "",
        color: "var(--sunk)",
        ink: "var(--ink)",
        plural: false,
      };
    }
    const side = sideOf(atlas, s.competitorId);
    if (match.sides.length > 2) {
      side.color = FIELD[i % FIELD.length] ?? "var(--ink)";
      side.ink = "#000";
    }
    return side;
  });
  const [a, b] = sides;
  if (sides.length === 2 && a && b && a.color === "var(--ink)" && b.color === "var(--ink)") {
    const pale = inked === 0 ? b : a;
    pale.color = "var(--surface)";
    pale.ink = "var(--ink)";
  }
  if (sides.length === 2 && a?.id && b?.id && alike(a.color, b.color)) {
    // The second-named team falls back to its second colour, then to ink. A second colour
    // that is nearly black or nearly white cannot be told from the page in one of the two
    // modes, so it counts as having none.
    const second = atlas.colors(b.id).secondary;
    b.color = alike(a.color, second) || extreme(second) ? "var(--ink)" : second;
    b.ink = inkOn(b.color);
  }
  return sides;
}

function gameDot(game: GameResult, index: number, sides: SideView[], unit: string): Dot {
  const label = `${unit} ${index + 1}`;
  if (game.status === "live") return { k: "now", label };
  if (game.status !== "finished" || game.winner === undefined) return { k: "open" };
  if (game.winner === "draw") return { k: "shared", label: `${label} · draw` };
  return { k: "won", side: game.winner, label: `${label} · ${sides[game.winner]?.name ?? ""}` };
}

/** The rounds of a Counter-Strike map from `from` up to `to`, with the one being played and those to come. */
export function roundDots(game: GameResult, sides: SideView[], from: number, to: number): Dot[] {
  const rounds = game.rounds ?? [];
  const live = game.status === "live";
  const dots: Dot[] = [];
  for (let i = from; i < to; i++) {
    const r = rounds[i];
    if (r)
      dots.push({
        k: "won",
        side: r.winner,
        label: `Round ${i + 1} · ${sides[r.winner]?.name ?? ""}`,
      });
    else if (live)
      dots.push(i === rounds.length ? { k: "now", label: `Round ${i + 1}` } : { k: "open" });
  }
  return dots;
}

/** How many rounds a map has room for: twenty-four, and six more for each overtime it reaches. */
export function roundSlots(game: GameResult): number {
  const played = (game.rounds?.length ?? 0) + (game.status === "live" ? 1 : 0);
  return Math.max(24, 24 + Math.ceil((played - 24) / 6) * 6);
}

/** Every round of a Counter-Strike map, twelve to a row. */
export function roundRows(game: GameResult, sides: SideView[]): Dot[][] {
  const rows: Dot[][] = [];
  for (let i = 0; i < roundSlots(game); i += 12) {
    const row = roundDots(game, sides, i, i + 12);
    if (row.length || i < 24) rows.push(row);
  }
  return rows;
}

/** One dot per round of a cup match, in the colour of the driver who won it. */
export function cupDots(game: GameResult | undefined, sides: SideView[]): Dot[] {
  const rounds = game?.cup?.rounds ?? [];
  const dots: Dot[] = rounds.map((order, i) => ({
    k: "won",
    side: order[0] ?? 0,
    label: `Round ${i + 1} · ${sides[order[0] ?? 0]?.name ?? ""}`,
  }));
  if (game?.status === "live") dots.push({ k: "now", label: `Round ${rounds.length + 1}` });
  return dots;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const COUNT: Record<number, string> = { 1: "one", 3: "three", 5: "five", 7: "seven" };

export function bestOf(n: number): string {
  return `Best of ${COUNT[n] ?? n}`;
}

/** Time left in a Rocket League game, or how far into overtime it is. */
export function rocketClock(game: GameResult): string {
  const clock = game.clock ?? 0;
  return clock > 300 ? `+${gameClock(clock - 300)}` : gameClock(300 - clock);
}

function wins(side: SideView | undefined): string {
  return side ? `${side.name} ${side.plural ? "win" : "wins"}` : "";
}

export function summarize(
  atlas: Atlas,
  match: Match,
  now: number,
  times: Times,
  /** The team or player the page is about, if it is about one. */
  subject?: string,
): MatchView {
  const tournament = atlas.tournamentOf(match);
  const discipline = atlas.discipline(tournament.discipline);
  const sides = sidesOf(atlas, match, subject);
  const solo = sides.length > 2;
  const series = seriesScore(match);
  const game = liveGame(match);
  const gameIndex = game ? match.games.indexOf(game) : -1;
  const unit = cap(discipline.unit.one);
  const live = match.status === "live";
  const d = discipline.id;
  const single = match.bestOf === 1;

  const last = match.games.at(-1);
  const points = (game ?? last)?.scores ?? series;
  const finalists = (game ?? last)?.cup?.finalists ?? [];
  const order = match.ranking;
  const standings = sides
    .map((side, index) => ({
      side,
      index,
      points: points[index] ?? 0,
      finalist: finalists.includes(index),
    }))
    .sort((x, y) =>
      order ? order.indexOf(x.index) - order.indexOf(y.index) : y.points - x.points,
    );

  let status: string;
  if (live) {
    if (solo) status = `Live · ${standings[0]?.side.name ?? ""} leads`;
    else if (!game) {
      // Between two games: say what has just been decided.
      const done = match.games.findLast((g) => g.status === "finished");
      if (!done) status = "Live";
      else if (done.winner === "draw" || done.winner === undefined) status = `${done.label} drawn`;
      else status = `${done.label} to ${sides[done.winner]?.name ?? ""}`;
    } else if (d === "cs2" && game.rounds) status = `Live · round ${game.rounds.length + 1}`;
    else if (d === "lol" && game.clock !== undefined)
      status = `Live · game ${gameIndex + 1} · ${gameClock(game.clock)}`;
    else if (d === "rocket-league" && game.clock !== undefined)
      status = `Live · game ${gameIndex + 1} · ${rocketClock(game)}`;
    else if (d === "chess")
      status = single
        ? `Live · move ${game.chess?.move ?? 1}`
        : `Live · game ${gameIndex + 1} · move ${game.chess?.move ?? 1}`;
    else status = `Live · ${discipline.unit.one} ${gameIndex + 1}`;
  } else if (match.status === "scheduled") {
    status = `${times.day(match.scheduledAt, now)} · ${times.clock(match.scheduledAt)}`;
  } else {
    const w = winnerOf(match);
    status =
      w === "draw" ? "Final · drawn" : w === undefined ? "Final" : `Final · ${wins(sides[w])}`;
  }

  // The score to lead with is the smallest thing that has a real score.
  const inGame = live && (d === "cs2" || d === "rocket-league") && game?.scores;
  let headline = inGame ? game.scores!.map(String) : series.map(formatPoints);
  let subs: [string, string, string] = ["", single ? "" : bestOf(match.bestOf), ""];
  const many = discipline.unit.many;
  const count = (n: number) => `${formatPoints(n)} ${n === 1 ? discipline.unit.one : many}`;
  if (solo) {
    headline = [
      game?.cup ? `Round ${game.cup.round}` : live ? "Live" : wins(standings[0]?.side) || status,
    ];
    subs = [
      standings[0] ? `${standings[0].side.name} ${standings[0].points}` : "",
      standings[1] ? `${standings[1].side.name} ${standings[1].points}` : "",
      standings
        .slice(2)
        .map((s) => `${s.side.name} ${s.points}`)
        .join(" · "),
    ];
  } else if (inGame) {
    subs = [
      count(series[0] ?? 0),
      d === "cs2" ? game.label : bestOf(match.bestOf),
      count(series[1] ?? 0),
    ];
  } else if (d === "lol" && game?.scores) {
    subs = [
      `${game.scores?.[0] ?? 0} kills`,
      bestOf(match.bestOf),
      `${game.scores?.[1] ?? 0} kills`,
    ];
  } else if (d === "chess") {
    const first = (game ?? match.games[0])?.firstSide ?? 0;
    const middle = single
      ? (atlas.roundOf(match)?.name ?? "")
      : `Game ${Math.max(1, gameIndex + 1)} of ${match.bestOf}`;
    subs = [first === 0 ? "White" : "Black", middle, first === 0 ? "Black" : "White"];
    // A single game in progress has no score yet; its move count leads instead.
    if (single && game) headline = [`Move ${game.chess?.move ?? 1}`];
  } else if (single && last?.status === "finished") {
    subs = ["", last.label, ""];
  }

  const games = match.games.map((g, i) => gameDot(g, i, sides, unit));
  const seriesDots = match.status === "finished" ? games.filter((x) => x.k !== "open") : games;
  let rows: Dot[][];
  if (solo) rows = [cupDots(game ?? last, sides)];
  else if (d === "cs2" && game?.rounds) rows = roundRows(game, sides);
  else rows = [seriesDots];

  return {
    match,
    discipline,
    tournament,
    event: tournament.short,
    where: heat(atlas, match),
    sides,
    solo,
    headline,
    status,
    live,
    game,
    subs,
    rows,
    series: solo ? (rows[0] ?? []) : seriesDots,
    standings,
  };
}

/** Which match of its round this is: "Semifinals", or "Quarterfinal B" when a field has several heats. */
export function heat(atlas: Atlas, match: Match): string {
  const round = atlas.roundOf(match);
  if (!round) return atlas.stageOf(match).name;
  if (match.sides.length <= 2 || round.matchIds.length < 2) return round.name;
  const letter = "ABCDEFGH"[round.matchIds.indexOf(match.id)] ?? "";
  return `${round.name.replace(/s$/, "")} ${letter}`;
}

/** The small line under a match's title: its game and event, or for a field, who is in it. */
export function lineOf(view: MatchView): string {
  const line = `${view.discipline.short} · ${view.event}`;
  if (!view.solo) return line;
  const known = view.sides.filter((s) => s.id).map((s) => s.name);
  return `${line} · ${known.length ? known.join(", ") : "field not decided yet"}`;
}

/** "A v B", or the event when there is a whole field. */
export function titleOf(view: MatchView): string {
  if (view.solo) return view.where;
  return view.sides.map((s) => s.name).join(" v ");
}

/** The series as a line of stops: what is done, what is on, what is still to come, and where the winner goes. */
export function stopsOf(atlas: Atlas, view: MatchView, times: Times): Stop[] {
  const { match, sides, discipline } = view;
  const d = discipline.id;
  // A single game is not a series, and there is nothing to draw as a line.
  if (match.bestOf === 1 && !view.solo) return [];
  const series = seriesScore(match);
  const need = Math.floor(match.bestOf / 2) + 1;
  const over = match.status === "finished";
  const played = match.games.filter((g) => g.status === "finished").length;
  // Games that will certainly be played: those already done plus what the leader still needs.
  const certain = played + Math.max(0, need - Math.max(0, ...series));
  const nextIndex = match.games.findIndex((g) => g.status === "scheduled");
  const hasLive = match.games.some((g) => g.status === "live");
  const short = match.games.length > 5;

  const stops: Stop[] = match.games.map((g, i): Stop => {
    const name =
      d === "cs2"
        ? g.label
        : view.solo
          ? g.label
          : short && g.status !== "live"
            ? `G${i + 1}`
            : `Game ${i + 1}`;
    if (g.status === "finished") {
      let sub = "";
      if (view.solo) sub = `${sides[typeof g.winner === "number" ? g.winner : 0]?.name ?? ""} won`;
      else if (d === "lol") sub = g.clock ? `${Math.round(g.clock / 60)} min` : "";
      else if (d === "chess")
        sub = g.winner === "draw" ? "Draw" : `${sides[g.winner as number]?.name ?? ""} won`;
      else if (g.scores) sub = g.scores.join("–");
      // Only who won it is known.
      if (!sub && typeof g.winner === "number") sub = `${sides[g.winner]?.label ?? ""} won`;
      return { kind: "done", label: name, sub, winner: g.winner };
    }
    if (g.status === "live") {
      let sub = "";
      if (d === "cs2" && g.rounds) sub = `Round ${g.rounds.length + 1}, first to 13`;
      else if (d === "lol" && g.clock !== undefined)
        sub = `${gameClock(g.clock)} · kills ${(g.scores ?? [0, 0]).join("–")}`;
      else if (d === "rocket-league" && g.clock !== undefined)
        sub = g.clock > 300 ? `Overtime ${rocketClock(g)}` : `${rocketClock(g)} left`;
      else if (d === "chess") sub = `Move ${g.chess?.move ?? 1}`;
      else if (g.cup) sub = `Round ${g.cup.round} · first to ${g.cup.limit}, then one round`;
      return { kind: "now", label: name, sub: sub || "Being played", game: g };
    }
    if (over) return { kind: "later", label: name, sub: "Not needed" };
    if (i === nextIndex && !hasLive && match.status === "live")
      return { kind: "next", label: name, sub: "Next" };
    return { kind: "later", label: name, sub: i < certain ? "" : "If needed" };
  });

  const ahead = match.next?.winner ? atlas.match(match.next.winner) : undefined;
  if (ahead) {
    // Once the match is over the line ends in who went on, not in a time that has passed.
    const won = over ? winnerOf(match) : undefined;
    const through = typeof won === "number" ? sides[won] : undefined;
    if (!over || through)
      stops.push({
        kind: "end",
        label: atlas.roundOf(ahead)?.name ?? "Next",
        sub: through
          ? `${through.label} went on`
          : `${times.weekday(ahead.scheduledAt)} ${times.clock(ahead.scheduledAt)}`,
        winner: typeof won === "number" ? won : undefined,
      });
  }
  return stops;
}

/** Where a match sits in its event and what the winner plays for, in a sentence. */
export function placeOf(atlas: Atlas, view: MatchView, now: number, times: Times): string {
  const { match, tournament } = view;
  const stage = atlas.stageOf(match);
  const round = atlas.roundOf(match);
  const where =
    stage.format === "round-robin" || stage.format === "swiss"
      ? `${round?.name ?? stage.name} of the ${stage.name.toLowerCase()}`
      : (round?.name ?? stage.name).replace(/finals$/, "final");
  const ahead = match.next?.winner ? atlas.match(match.next.winner) : undefined;
  let next = "";
  if (ahead) {
    const round2 = (atlas.roundOf(ahead)?.name ?? "next round")
      .toLowerCase()
      .replace(/finals$/, "final");
    const waiting = ahead.sides.find(
      (s) => s.competitorId && !match.sides.some((x) => x.competitorId === s.competitorId),
    );
    const when = `${times.day(ahead.scheduledAt, now)} at ${times.clock(ahead.scheduledAt)}`;
    const through =
      (stage.rules?.advancePerMatch ?? 1) > 1
        ? `The top ${stage.rules?.advancePerMatch === 2 ? "two" : stage.rules?.advancePerMatch} go`
        : "The winner goes";
    const w = winnerOf(match);
    const winner = typeof w === "number" ? view.sides[w] : undefined;
    next =
      match.status === "finished"
        ? // Said only while it is still ahead of them.
          winner && ahead.sides.length === 2 && ahead.status !== "finished"
          ? ` ${winner.name} ${winner.plural ? "go" : "goes"} to the ${round2}, ${lower(when)}.`
          : ""
        : waiting && ahead.sides.length === 2
          ? ` ${through} to the ${round2} against ${plainName(atlas, waiting.competitorId)}, ${lower(when)}.`
          : ` ${through} to the ${round2}, ${lower(when)}.`;
  } else if (/final/i.test(round?.name ?? "") && match.status !== "finished") {
    next = " The winner takes the title.";
  }
  return `${cap(where)}, ${tournament.name}.${next}`;
}

function lower(s: string): string {
  return /^(Today|Tomorrow|Yesterday)/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : `on ${s}`;
}
