import type { Atlas, Match } from "@bearing/domain";
import { seriesScore, winnerOf } from "@bearing/domain";

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
function feeders(atlas: Atlas, match: Match): Match[] {
  return atlas.world.matches.filter((m) => m.next?.winner === match.id);
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

/** Results for followed things, newest first. */
export function recentForYou(atlas: Atlas, limit = 6): Match[] {
  return atlas
    .recent()
    .filter((m) => atlas.isFollowed(m))
    .slice(0, limit);
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
