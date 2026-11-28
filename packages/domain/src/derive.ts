import type {
  Competitor,
  Discipline,
  DisciplineId,
  Follow,
  Match,
  Player,
  Stage,
  Stint,
  Team,
  Tournament,
  World,
} from "./model.ts";

/** Indexed, read-only view over a World with the derivations every surface needs. */
export class Atlas {
  readonly world: World;
  private readonly competitorById = new Map<string, Competitor>();
  private readonly tournamentById = new Map<string, Tournament>();
  private readonly matchById = new Map<string, Match>();
  private readonly disciplineById = new Map<DisciplineId, Discipline>();
  /** The team each player is on now; built the first time it is asked for. */
  private teamNow?: Map<string, string>;

  constructor(world: World) {
    this.world = world;
    for (const c of world.competitors) this.competitorById.set(c.id, c);
    for (const t of world.tournaments) this.tournamentById.set(t.id, t);
    for (const m of world.matches) this.matchById.set(m.id, m);
    for (const d of world.disciplines) this.disciplineById.set(d.id, d);
  }

  discipline(id: DisciplineId): Discipline {
    const d = this.disciplineById.get(id);
    if (!d) throw new Error(`Unknown discipline ${id}`);
    return d;
  }

  competitor(id: string | null | undefined): Competitor | undefined {
    return id ? this.competitorById.get(id) : undefined;
  }

  team(id: string): Team | undefined {
    const c = this.competitorById.get(id);
    return c?.kind === "team" ? c : undefined;
  }

  player(id: string): Player | undefined {
    const c = this.competitorById.get(id);
    return c?.kind === "player" ? c : undefined;
  }

  tournament(id: string): Tournament | undefined {
    return this.tournamentById.get(id);
  }

  match(id: string): Match | undefined {
    return this.matchById.get(id);
  }

  tournamentOf(match: Match): Tournament {
    const t = this.tournamentById.get(match.tournamentId);
    if (!t) throw new Error(`Match ${match.id} references unknown tournament`);
    return t;
  }

  stageOf(match: Match): Stage {
    const stage = this.tournamentOf(match).stages.find((s) => s.id === match.stageId);
    if (!stage) throw new Error(`Match ${match.id} references unknown stage`);
    return stage;
  }

  roundOf(match: Match) {
    return this.stageOf(match).rounds.find((r) => r.id === match.roundId);
  }

  matchesOf(tournamentId: string): Match[] {
    return this.world.matches.filter((m) => m.tournamentId === tournamentId);
  }

  stageMatches(stage: Stage): Match[] {
    return stage.rounds.flatMap((r) =>
      r.matchIds.map((id) => this.matchById.get(id)).filter(isDefined),
    );
  }

  matchesFor(competitorId: string): Match[] {
    return this.world.matches
      .filter((m) => m.sides.some((s) => s.competitorId === competitorId))
      .sort(byTime);
  }

  live(): Match[] {
    return this.world.matches.filter((m) => m.status === "live").sort(byTime);
  }

  upcoming(after = this.world.now): Match[] {
    return this.world.matches
      .filter((m) => m.status === "scheduled" && m.scheduledAt >= after)
      .sort(byTime);
  }

  recent(before = this.world.now): Match[] {
    return this.world.matches
      .filter((m) => m.status === "finished" && m.scheduledAt <= before)
      .sort((a, b) => byTime(b, a));
  }

  /** Every match touching something the viewer follows. */
  isFollowed(match: Match): boolean {
    return this.world.follows.some((f) => this.touches(match, f));
  }

  /** Whether a match belongs to one follow: its event, its game, or one of its competitors. */
  touches(match: Match, f: Follow): boolean {
    switch (f.kind) {
      case "tournament":
        return f.id === match.tournamentId;
      case "discipline":
        return this.tournamentOf(match).discipline === f.id;
      case "team":
      case "player":
        return match.sides.some((s) => s.competitorId === f.id) || this.rosterTouches(match, f.id);
      case "organization":
        return match.sides.some((s) => {
          const c = this.competitor(s.competitorId);
          return c?.kind === "team" && c.orgId === f.id;
        });
    }
  }

  /** True when the viewer follows this competitor directly, through its organisation, or as a current roster member. */
  followsCompetitor(id: string | null | undefined): boolean {
    if (!id) return false;
    const c = this.competitor(id);
    return this.world.follows.some((f) => {
      if ((f.kind === "team" || f.kind === "player") && f.id === id) return true;
      if (f.kind === "organization" && c?.kind === "team" && c.orgId === f.id) return true;
      if (f.kind === "player") return this.teamOf(f.id) === id;
      return false;
    });
  }

  /**
   * The team a player is on now. Every page asks this for every match and every follow, so the
   * answer is looked up, not searched for among all stints each time.
   */
  private teamOf(playerId: string): string | undefined {
    if (!this.teamNow) {
      this.teamNow = new Map();
      for (const s of this.world.stints) {
        if (!s.to && !this.teamNow.has(s.playerId)) this.teamNow.set(s.playerId, s.teamId);
      }
    }
    return this.teamNow.get(playerId);
  }

  private rosterTouches(match: Match, playerId: string): boolean {
    const teamId = this.teamOf(playerId);
    return !!teamId && match.sides.some((s) => s.competitorId === teamId);
  }

  stints(teamId: string): Stint[] {
    return this.world.stints
      .filter((s) => s.teamId === teamId)
      .sort((a, b) => (a.from ?? "").localeCompare(b.from ?? ""));
  }

  roster(teamId: string): { stint: Stint; player: Player }[] {
    return this.stints(teamId)
      .filter((s) => !s.to)
      .map((stint) => ({ stint, player: this.player(stint.playerId) }))
      .filter((r): r is { stint: Stint; player: Player } => !!r.player);
  }

  name(id: string | null | undefined): string {
    const c = this.competitor(id);
    if (!c) return "TBD";
    return c.kind === "team" ? c.name : c.handle;
  }

  short(id: string | null | undefined): string {
    const c = this.competitor(id);
    if (!c) return "TBD";
    return c.kind === "team" ? c.short : c.handle;
  }

  colors(id: string | null | undefined) {
    const c = this.competitor(id);
    if (!c) return { primary: "#6b6b70", secondary: "#2a2a2e" };
    if (c.kind === "team" && c.colors) return c.colors;
    return (
      c.colors ?? { primary: this.discipline(c.discipline).palette.accent, secondary: "#1a1a1e" }
    );
  }
}

function isDefined<T>(v: T | undefined): v is T {
  return v !== undefined;
}

export function byTime(a: Match, b: Match): number {
  return a.scheduledAt.localeCompare(b.scheduledAt);
}

/** Series score per side: maps won, or chess points (½ for a draw). */
export function seriesScore(match: Match): number[] {
  const score = match.sides.map(() => 0);
  for (const g of match.games) {
    if (g.status !== "finished" || g.winner === undefined) continue;
    if (g.points) {
      for (let i = 0; i < score.length; i++) score[i]! += g.points[i] ?? 0;
    } else if (g.winner === "draw") {
      for (let i = 0; i < score.length; i++) score[i]! += 0.5;
    } else {
      score[g.winner]! += 1;
    }
  }
  return score;
}

export function winnerOf(match: Match): number | "draw" | undefined {
  if (match.status !== "finished") return undefined;
  if (match.ranking) return match.ranking[0];
  const s = seriesScore(match);
  if (s.length === 2 && s[0] === s[1]) return "draw";
  let best = 0;
  for (let i = 1; i < s.length; i++) if (s[i]! > s[best]!) best = i;
  return best;
}

export function liveGame(match: Match) {
  return match.games.find((g) => g.status === "live");
}

export function formatPoints(n: number): string {
  const whole = Math.floor(n);
  const half = n - whole >= 0.5;
  if (!half) return String(whole);
  return whole === 0 ? "½" : `${whole}½`;
}

export interface SwissRecord {
  competitorId: string;
  wins: number;
  losses: number;
  /** Outcome per round, in order. */
  path: ("W" | "L")[];
  status: "advanced" | "eliminated" | "alive";
  /** Seed order the stage started with. */
  seed: number;
}

export function swissRecords(atlas: Atlas, stage: Stage, seeds: string[]): SwissRecord[] {
  const wins = stage.rules?.winsToAdvance ?? 3;
  const losses = stage.rules?.lossesToExit ?? 3;
  const records = new Map<string, SwissRecord>(
    seeds.map((id, i) => [
      id,
      { competitorId: id, wins: 0, losses: 0, path: [], status: "alive", seed: i + 1 },
    ]),
  );
  for (const round of stage.rounds) {
    for (const id of round.matchIds) {
      const m = atlas.match(id);
      if (!m || m.status !== "finished") continue;
      const w = winnerOf(m);
      if (typeof w !== "number") continue;
      m.sides.forEach((side, i) => {
        const r = side.competitorId ? records.get(side.competitorId) : undefined;
        if (!r) return;
        if (i === w) {
          r.wins++;
          r.path.push("W");
        } else {
          r.losses++;
          r.path.push("L");
        }
        if (r.wins >= wins) r.status = "advanced";
        else if (r.losses >= losses) r.status = "eliminated";
      });
    }
  }
  return [...records.values()].sort(
    (a, b) => b.wins - a.wins || a.losses - b.losses || a.seed - b.seed,
  );
}

export interface Standing {
  competitorId: string;
  played: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  /** Sonneborn–Berger: sum of beaten opponents' points plus half of drawn opponents'. */
  tiebreak: number;
  /** Result against each opponent: 1, 0.5, 0, or null when unplayed. */
  versus: Map<string, number | null>;
  rank: number;
}

export function roundRobinStandings(
  atlas: Atlas,
  stage: Stage,
  participantIds: string[],
): Standing[] {
  const table = new Map<string, Standing>(
    participantIds.map((id) => [
      id,
      {
        competitorId: id,
        played: 0,
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        tiebreak: 0,
        versus: new Map(participantIds.filter((o) => o !== id).map((o) => [o, null])),
        rank: 0,
      },
    ]),
  );
  for (const m of atlas.stageMatches(stage)) {
    if (m.status !== "finished") continue;
    const [a, b] = m.sides.map((s) => s.competitorId);
    if (!a || !b) continue;
    const [sa, sb] = seriesScore(m);
    const ra = table.get(a)!;
    const rb = table.get(b)!;
    ra.played++;
    rb.played++;
    ra.points += sa!;
    rb.points += sb!;
    ra.versus.set(b, sa!);
    rb.versus.set(a, sb!);
    if (sa === sb) {
      ra.draws++;
      rb.draws++;
    } else if (sa! > sb!) {
      ra.wins++;
      rb.losses++;
    } else {
      rb.wins++;
      ra.losses++;
    }
  }
  for (const row of table.values()) {
    let sb = 0;
    for (const [opp, res] of row.versus) {
      if (res === null) continue;
      sb += res * table.get(opp)!.points;
    }
    row.tiebreak = sb;
  }
  const rows = [...table.values()].sort((x, y) => y.points - x.points || y.tiebreak - x.tiebreak);
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.rank = prev && prev.points === r.points && prev.tiebreak === r.tiebreak ? prev.rank : i + 1;
  });
  return rows;
}

/** Recent form, newest first: W, L or D for each finished match. */
export function form(atlas: Atlas, competitorId: string, count = 5): ("W" | "L" | "D")[] {
  return atlas
    .matchesFor(competitorId)
    .filter((m) => m.status === "finished")
    .reverse()
    .slice(0, count)
    .map((m) => {
      const w = winnerOf(m);
      if (w === "draw") return "D";
      const idx = m.sides.findIndex((s) => s.competitorId === competitorId);
      return w === idx ? "W" : "L";
    });
}

export interface PlayerTotals {
  games: number;
  kills: number;
  deaths: number;
  assists: number;
  adr?: number;
  rating?: number;
}

/** Totals for one player across a set of matches (all games with per-player lines). */
export function playerTotals(matches: Match[], playerId: string): PlayerTotals | undefined {
  const lines = matches.flatMap((m) =>
    m.games.flatMap((g) => g.lines?.filter((l) => l.playerId === playerId) ?? []),
  );
  if (!lines.length) return undefined;
  const sum = (f: (l: (typeof lines)[number]) => number) => lines.reduce((s, l) => s + f(l), 0);
  const withAdr = lines.filter((l) => l.adr !== undefined);
  const withRating = lines.filter((l) => l.rating !== undefined);
  return {
    games: lines.length,
    kills: sum((l) => l.kills),
    deaths: sum((l) => l.deaths),
    assists: sum((l) => l.assists),
    adr: withAdr.length ? withAdr.reduce((s, l) => s + l.adr!, 0) / withAdr.length : undefined,
    rating: withRating.length
      ? withRating.reduce((s, l) => s + l.rating!, 0) / withRating.length
      : undefined,
  };
}

export type TournamentStatus = "upcoming" | "live" | "completed";

export function tournamentStatus(atlas: Atlas, t: Tournament, now: number): TournamentStatus {
  const start = Date.parse(`${t.start}T00:00:00Z`);
  const end = Date.parse(`${t.end}T23:59:59Z`);
  if (now > end) return "completed";
  if (now < start) return "upcoming";
  const ms = atlas.matchesOf(t.id);
  if (ms.length && ms.every((m) => m.status === "finished")) return "completed";
  return "live";
}

/** Champion of a completed event, when known. */
export function champion(t: Tournament): string | undefined {
  return t.placements?.find((p) => p.rank === 1)?.competitorIds[0];
}
