import {
  type Atlas,
  type Discipline,
  type GameResult,
  type Match,
  clock,
  dayLabel,
  formatPoints,
  liveGame,
  seriesScore,
} from "@bearing/domain";

/**
 * What the Bearing screens need to know about a match, worked out once from the domain model.
 * The rules behind it are in docs/BRAND.md: a team is a flat disc, a thing won is a flat dot,
 * and how much is shown depends on the room there is.
 */

/** Fixed colours for fields of more than two, in starting order. */
const FIELD = ["#00c978", "#ff8a00", "#7a5cff", "#19a8ff"];

export interface SideView {
  id: string | null;
  name: string;
  /** Short name for the disc. */
  short: string;
  color: string;
  /** Text colour that reads on `color`. */
  ink: string;
}

export type Dot =
  | { k: "won"; side: number; label: string }
  | { k: "shared"; label: string }
  | { k: "now"; label: string }
  | { k: "open" };

export interface MatchView {
  match: Match;
  discipline: Discipline;
  event: string;
  /** Where in the event this match sits: "Semifinals", "Round 3". */
  where: string;
  sides: SideView[];
  /** More than two competitors: there is no "a v b", only a field and its standings. */
  solo: boolean;
  /** The score to lead with: one entry per side, or a single line for a field. */
  headline: string[];
  status: string;
  live: boolean;
  /** Left, middle and right of the small line under the score. */
  subs: [string, string, string];
  /** The small form: rows of dots. */
  rows: Dot[][];
  standings: { side: SideView; points: number }[];
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
  if (!c) return "var(--surface)";
  return (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000 > 150 ? "#000" : "#fff";
}

/** Two team colours too close to tell apart as dots. */
function alike(a: string, b: string): boolean {
  const x = rgb(a);
  const y = rgb(b);
  if (!x || !y) return false;
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 70;
}

function tag(atlas: Atlas, id: string | null): string {
  const c = atlas.competitor(id);
  if (!c) return "?";
  return c.kind === "team" ? c.short : c.handle.slice(0, 2).toUpperCase();
}

function sidesOf(atlas: Atlas, match: Match, discipline: Discipline): SideView[] {
  const sides = match.sides.map((s, i): SideView => {
    const name = s.competitorId ? atlas.name(s.competitorId) : (s.placeholder ?? "To be decided");
    let color = s.competitorId ? atlas.colors(s.competitorId).primary : "var(--rest)";
    let ink = inkOn(color);
    if (discipline.id === "chess") {
      // Players have no colours: ink and the surface colour.
      color = i === 0 ? "var(--ink)" : "var(--surface)";
      ink = i === 0 ? "var(--surface)" : "var(--ink)";
    } else if (match.sides.length > 2) {
      color = FIELD[i % FIELD.length] ?? "var(--ink)";
      ink = "#000";
    }
    return { id: s.competitorId, name, short: tag(atlas, s.competitorId), color, ink };
  });
  const [a, b] = sides;
  if (sides.length === 2 && a && b && alike(a.color, b.color)) {
    // The second-named team falls back to its second colour, then to ink.
    const second = atlas.colors(b.id).secondary;
    b.color = alike(a.color, second) ? "var(--ink)" : second;
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

/** Every round of a Counter-Strike map, twelve to a row, with the round being played and those to come. */
export function roundRows(game: GameResult, sides: SideView[]): Dot[][] {
  const rounds = game.rounds ?? [];
  const live = game.status === "live";
  const slots = Math.max(24, Math.ceil((rounds.length + (live ? 1 : 0)) / 6) * 6);
  const dots: Dot[] = [];
  for (let i = 0; i < (live ? slots : rounds.length); i++) {
    const r = rounds[i];
    if (r)
      dots.push({
        k: "won",
        side: r.winner,
        label: `Round ${i + 1} · ${sides[r.winner]?.name ?? ""}`,
      });
    else dots.push(i === rounds.length ? { k: "now", label: `Round ${i + 1}` } : { k: "open" });
  }
  const rows: Dot[][] = [];
  for (let i = 0; i < dots.length; i += 12) rows.push(dots.slice(i, i + 12));
  return rows;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function summarize(atlas: Atlas, match: Match, now: number): MatchView {
  const tournament = atlas.tournamentOf(match);
  const discipline = atlas.discipline(tournament.discipline);
  const sides = sidesOf(atlas, match, discipline);
  const solo = sides.length > 2;
  const series = seriesScore(match);
  const game = liveGame(match);
  const gameIndex = game ? match.games.indexOf(game) : -1;
  const unit = cap(discipline.unit.one);
  const live = match.status === "live";

  let status = "Final";
  if (live) {
    if (game?.rounds) status = `Live · round ${game.rounds.length + 1}`;
    else if (game?.cup) status = `Live · round ${game.cup.round}`;
    else status = game ? `Live · ${discipline.unit.one} ${gameIndex + 1}` : "Live";
  } else if (match.status === "scheduled") {
    status = `${dayLabel(match.scheduledAt, now)} · ${clock(match.scheduledAt, true)}`;
  }

  const points = match.games.at(-1)?.scores ?? series;
  const standings = sides
    .map((side, i) => ({ side, points: points[i] ?? 0 }))
    .sort((x, y) => y.points - x.points);

  // The score to lead with is the smallest thing that has a real score.
  const inGame = (discipline.id === "cs2" || discipline.id === "rocket-league") && game?.scores;
  let headline = inGame ? game.scores!.map(String) : series.map(formatPoints);
  let subs: [string, string, string] = ["", `Best of ${match.bestOf}`, ""];
  if (solo) {
    headline = [game?.cup ? `Round ${game.cup.round}` : live ? "Live" : status];
    subs = [
      standings[0] ? `${standings[0].side.name} ${standings[0].points}` : "",
      standings[1] ? `${standings[1].side.name} ${standings[1].points}` : "",
      standings[2] ? `${standings[2].side.name} ${standings[2].points}` : "",
    ];
  } else if (inGame) {
    const many = discipline.unit.many;
    const count = (n: number) => `${formatPoints(n)} ${n === 1 ? discipline.unit.one : many}`;
    subs = [count(series[0] ?? 0), game.label, count(series[1] ?? 0)];
  } else if (discipline.id === "chess" && game) {
    const white = game.firstSide ?? 0;
    subs = [
      white === 0 ? "White" : "Black",
      `Game ${gameIndex + 1} of ${match.bestOf}`,
      white === 0 ? "Black" : "White",
    ];
  } else if (game) {
    subs = ["", `${unit} ${gameIndex + 1} · best of ${match.bestOf}`, ""];
  }

  let rows: Dot[][] = [];
  if (!solo) {
    if (discipline.id === "cs2" && game?.rounds) rows = roundRows(game, sides);
    else {
      const dots = match.games.map((g, i) => gameDot(g, i, sides, unit));
      rows = [match.status === "finished" ? dots.filter((d) => d.k !== "open") : dots];
    }
  }

  return {
    match,
    discipline,
    event: tournament.short,
    where: atlas.roundOf(match)?.name ?? atlas.stageOf(match).name,
    sides,
    solo,
    headline,
    status,
    live,
    subs,
    rows,
    standings,
  };
}
