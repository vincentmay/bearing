import type { Atlas, Follow, Match } from "@bearing/domain";
import {
  formatPoints,
  relative,
  roundRobinStandings,
  seriesScore,
  winnerOf,
} from "@bearing/domain";

export interface Upcoming {
  match: Match;
  /** Set when the viewer's interest depends on another result: "If Vitality beat Aurora". */
  conditional?: { competitorId: string; via: Match };
}

/** The live match most worth leading with: something followed first, then the highest tier. */
export function featuredLive(atlas: Atlas): Match | undefined {
  const live = atlas.live();
  const tierRank = { S: 0, A: 1, B: 2 } as const;
  return [...live].sort((a, b) => {
    const fa = atlas.isFollowed(a) ? 0 : 1;
    const fb = atlas.isFollowed(b) ? 0 : 1;
    if (fa !== fb) return fa - fb;
    const teamA = atlas.discipline(atlas.tournamentOf(a).discipline).competitor === "team" ? 0 : 1;
    const teamB = atlas.discipline(atlas.tournamentOf(b).discipline).competitor === "team" ? 0 : 1;
    return (
      teamA - teamB || tierRank[atlas.tournamentOf(a).tier] - tierRank[atlas.tournamentOf(b).tier]
    );
  })[0];
}

/** Matches whose winner feeds into `match`. */
export function feeders(atlas: Atlas, match: Match): Match[] {
  return atlas.world.matches.filter((m) => m.next?.winner === match.id);
}

/**
 * The unfinished match that will fill an open slot. With one feeder per slot, slot i is fed by
 * the i-th feeder in bracket order; otherwise open slots take the feeders that don't already
 * account for a known side.
 */
export function pendingSource(atlas: Atlas, match: Match, slot: number): Match | undefined {
  if (match.sides[slot]?.competitorId) return undefined;
  const round = atlas
    .stageOf(match)
    .rounds.find((r) => r.matchIds.some((id) => feeders(atlas, match).some((f) => f.id === id)));
  const order = (m: Match) => round?.matchIds.indexOf(m.id) ?? 0;
  const fs = feeders(atlas, match).sort((a, b) => order(a) - order(b));
  let source: Match | undefined;
  if (fs.length === match.sides.length) source = fs[slot];
  else {
    const open = fs.filter(
      (f) =>
        !match.sides.some(
          (s) => s.competitorId && f.sides.some((x) => x.competitorId === s.competitorId),
        ),
    );
    const emptyIndex = match.sides.slice(0, slot + 1).filter((s) => !s.competitorId).length - 1;
    source = open[emptyIndex];
  }
  return source && source.status !== "finished" ? source : undefined;
}

/** Followed upcoming matches, plus matches a followed competitor reaches by winning a pending one. */
export function upcomingForYou(atlas: Atlas): Upcoming[] {
  const out: Upcoming[] = [];
  for (const m of atlas.upcoming()) {
    if (atlas.isFollowed(m)) {
      out.push({ match: m });
      continue;
    }
    if (m.sides.some((s) => !s.competitorId)) {
      for (const f of feeders(atlas, m)) {
        if (f.status === "finished") continue;
        const side = f.sides.find((s) => atlas.followsCompetitor(s.competitorId));
        if (side?.competitorId)
          out.push({ match: m, conditional: { competitorId: side.competitorId, via: f } });
      }
    }
  }
  return out;
}

/** Results for followed things since the start of the previous day. */
export function recentForYou(atlas: Atlas, limit = 6): Match[] {
  return atlas
    .recent()
    .filter((m) => atlas.isFollowed(m))
    .slice(0, limit);
}

/** Where the winner of `match` goes next, if that is known. */
export function pathAhead(atlas: Atlas, match: Match) {
  const nextId = match.next?.winner;
  const next = nextId ? atlas.match(nextId) : undefined;
  if (!next) return undefined;
  const round = atlas.roundOf(next);
  const waiting = next.sides.find(
    (s) => s.competitorId && !match.sides.some((x) => x.competitorId === s.competitorId),
  );
  return { next, round, waiting: waiting?.competitorId ?? null };
}

export function roundLabel(atlas: Atlas, match: Match): string {
  const stage = atlas.stageOf(match);
  const round = atlas.roundOf(match);
  if (stage.format === "round-robin" || stage.format === "swiss")
    return `${stage.name} · ${round?.name ?? ""}`;
  return round?.name ?? stage.name;
}

export function scoreLine(match: Match): string {
  return seriesScore(match)
    .map((n) => (n % 1 ? (n < 1 ? "½" : `${Math.floor(n)}½`) : String(n)))
    .join("–");
}

export function didWin(match: Match, competitorId: string): boolean | "draw" | undefined {
  const w = winnerOf(match);
  if (w === undefined) return undefined;
  if (w === "draw") return "draw";
  return match.sides[w]?.competitorId === competitorId;
}

/** Per-map record for a team across all finished games. */
export function mapRecord(atlas: Atlas, competitorId: string) {
  const out = new Map<string, { played: number; won: number; roundDiff: number }>();
  for (const m of atlas.matchesFor(competitorId)) {
    const idx = m.sides.findIndex((s) => s.competitorId === competitorId);
    for (const g of m.games) {
      if (g.status !== "finished" || !g.scores) continue;
      const rec = out.get(g.label) ?? { played: 0, won: 0, roundDiff: 0 };
      rec.played++;
      if (g.winner === idx) rec.won++;
      rec.roundDiff += g.scores[idx]! - g.scores[1 - idx]!;
      out.set(g.label, rec);
    }
  }
  return [...out.entries()]
    .map(([map, r]) => ({ map, ...r }))
    .sort((a, b) => b.played - a.played || b.won - a.won);
}

// ---------------------------------------------------------------------------------------------
// Follow summaries

export interface FollowStatus {
  /** Short state: "Live", "Next", "Out", "Done". */
  state: "live" | "next" | "out" | "idle";
  line: string;
  matchId?: string;
}

/** One line on where a followed thing stands right now. */
export function followStatus(atlas: Atlas, f: Follow, now: number): FollowStatus {
  const relevant = atlas.world.matches.filter((m) => atlas.touches(m, f));
  const live = relevant.find((m) => m.status === "live");
  const next = relevant
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
  const last = relevant
    .filter((m) => m.status === "finished")
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))[0];
  if (f.kind === "player") {
    const p = atlas.player(f.id);
    const t = live ? atlas.tournamentOf(live) : next ? atlas.tournamentOf(next) : undefined;
    const stage = t?.stages.find((s) => s.format === "round-robin");
    if (p && t && stage) {
      const row = roundRobinStandings(atlas, stage, t.participantIds).find(
        (r) => r.competitorId === p.id,
      );
      const standing = row
        ? `${formatPoints(row.points)}/${row.played} · ${ordinal(row.rank)}`
        : "";
      if (live) return { state: "live", line: `Playing now · ${standing}`, matchId: live.id };
      if (next)
        return {
          state: "next",
          line: `${standing} · next ${relative(next.scheduledAt, now)}`,
          matchId: next.id,
        };
    }
  }
  if (live)
    return {
      state: "live",
      line: `Live · ${atlas.tournamentOf(live).short}, ${roundName(atlas, live)}`,
      matchId: live.id,
    };
  if (f.kind === "tournament") {
    return next
      ? { state: "next", line: `Next match ${relative(next.scheduledAt, now)}`, matchId: next.id }
      : { state: "idle", line: "Complete" };
  }
  const subject = f.kind === "organization" ? undefined : f.id;
  if (next)
    return {
      state: "next",
      line: `${atlas.tournamentOf(next).short} · ${relative(next.scheduledAt, now)}`,
      matchId: next.id,
    };
  if (last && subject) {
    const idx = last.sides.findIndex((s) => s.competitorId === subject);
    const s = seriesScore(last);
    if (idx >= 0 && s[idx]! < s[1 - idx]!) {
      return {
        state: "out",
        line: `Out · lost ${s[idx]}–${s[1 - idx]} to ${atlas.name(last.sides[1 - idx]!.competitorId).replace(/^Team /, "")}`,
        matchId: last.id,
      };
    }
  }
  return { state: "idle", line: "Nothing scheduled" };
}

export function roundName(atlas: Atlas, m: Match): string {
  return (atlas.roundOf(m)?.name ?? atlas.stageOf(m).name)
    .toLowerCase()
    .replace(/finals$/, "final");
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function followTarget(
  atlas: Atlas,
  f: Follow,
): { name: string; sub: string; colors: { primary: string; secondary: string } } {
  switch (f.kind) {
    case "organization": {
      const o = atlas.world.organizations.find((x) => x.id === f.id);
      const teams = atlas.world.competitors.filter((c) => c.kind === "team" && c.orgId === f.id);
      return {
        name: o?.name ?? f.id,
        sub: `Organisation · ${teams.map((t) => atlas.discipline(t.discipline).short).join(", ")}`,
        colors: o?.colors ?? { primary: "#888888", secondary: "#222222" },
      };
    }
    case "tournament": {
      const t = atlas.tournament(f.id);
      return {
        name: t?.name ?? f.id,
        sub: `Event · ${t ? atlas.discipline(t.discipline).name : ""}`,
        colors: t?.colors ?? { primary: "#888888", secondary: "#222222" },
      };
    }
    case "discipline": {
      const d = atlas.discipline(f.id as never);
      return {
        name: d.name,
        sub: "Game",
        colors: { primary: d.palette.accent, secondary: d.palette.deep },
      };
    }
    default: {
      const c = atlas.competitor(f.id);
      const d = c ? atlas.discipline(c.discipline) : undefined;
      return {
        name: atlas.name(f.id),
        sub: `${c?.kind === "team" ? "Team" : "Player"} · ${d?.name ?? ""}`,
        colors: atlas.colors(f.id),
      };
    }
  }
}

/** Head-to-head series between two competitors, newest first. */
export function headToHead(atlas: Atlas, a: string, b: string): Match[] {
  return atlas.world.matches
    .filter(
      (m) =>
        m.status === "finished" &&
        m.sides.some((s) => s.competitorId === a) &&
        m.sides.some((s) => s.competitorId === b),
    )
    .sort((x, y) => y.scheduledAt.localeCompare(x.scheduledAt));
}

/** Placements a competitor has earned across all events, best first. */
export function achievements(atlas: Atlas, competitorId: string) {
  return atlas.world.tournaments
    .flatMap((t) =>
      (t.placements ?? [])
        .filter((p) => p.competitorIds.includes(competitorId))
        .map((p) => ({ t, p })),
    )
    .sort((x, y) => x.p.rank - y.p.rank || y.t.end.localeCompare(x.t.end));
}
