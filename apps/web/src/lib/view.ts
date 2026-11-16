import type { Atlas, Match } from "@bearing/domain";
import { seriesScore, winnerOf } from "@bearing/domain";

export interface Upcoming {
  match: Match;
  /** Set when the viewer's interest depends on another result: "If Vitality beat Aurora". */
  conditional?: { competitorId: string; via: Match };
}

const TIER = { S: 0, A: 1, B: 2 } as const;

/** The better of two live matches to lead with: a team game before a single player, then the higher tier. */
function byWeight(atlas: Atlas) {
  return (a: Match, b: Match) => {
    const ta = atlas.tournamentOf(a);
    const tb = atlas.tournamentOf(b);
    const teamA = atlas.discipline(ta.discipline).competitor === "team" ? 0 : 1;
    const teamB = atlas.discipline(tb.discipline).competitor === "team" ? 0 : 1;
    return teamA - teamB || TIER[ta.tier] - TIER[tb.tier];
  };
}

/**
 * The match to look at first. Something the viewer follows that is live; failing that, a live
 * match at the very top of its game; failing that, the next thing the viewer follows; and only
 * then whatever else is live or coming.
 */
export function leadMatch(atlas: Atlas, mine: Upcoming[]): Match | undefined {
  const live = atlas.live();
  const followed = live.filter((m) => atlas.isFollowed(m)).sort(byWeight(atlas))[0];
  if (followed) return followed;
  const top = live.filter((m) => atlas.tournamentOf(m).tier === "S").sort(byWeight(atlas))[0];
  if (top) return top;
  const next = mine.find((u) => !u.conditional)?.match;
  if (next) return next;
  return (
    [...live].sort(byWeight(atlas))[0] ??
    atlas.upcoming().find((m) => m.sides.every((s) => s.competitorId))
  );
}

/** One line of a list: a match, or a whole round of an event when it has too many games to list. */
export type Listed =
  | { kind: "match"; match: Match }
  | { kind: "round"; key: string; matches: Match[] };

/**
 * A round of forty chess games is one line, not forty. Matches of the same round of the same
 * event are folded together once there are too many of them: more than three for a game played
 * one against one, more than eight for teams, whose matches are each worth a line for longer.
 * A match the viewer follows always keeps its own line.
 */
export function bundle(atlas: Atlas, matches: Match[]): Listed[] {
  const limitOf = (m: Match) =>
    atlas.discipline(atlas.tournamentOf(m).discipline).competitor === "team" ? 8 : 3;
  const groups = new Map<string, Match[]>();
  for (const m of matches) {
    if (atlas.isFollowed(m)) continue;
    const key = `${m.tournamentId}|${m.roundId}`;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  const out: Listed[] = [];
  const done = new Set<string>();
  for (const m of matches) {
    const key = `${m.tournamentId}|${m.roundId}`;
    const group = groups.get(key);
    if (atlas.isFollowed(m) || !group || group.length <= limitOf(m)) {
      out.push({ kind: "match", match: m });
    } else if (!done.has(key)) {
      done.add(key);
      out.push({ kind: "round", key, matches: group });
    }
  }
  return out;
}

/** What is coming up that the viewer does not follow: the top of each game first, then by time. */
export function elsewhere(atlas: Atlas, skip: Set<string>, limit: number): Match[] {
  return atlas
    .upcoming()
    .filter((m) => !skip.has(m.id) && !atlas.isFollowed(m) && m.sides.every((s) => s.competitorId))
    .sort(
      (a, b) =>
        TIER[atlas.tournamentOf(a).tier] - TIER[atlas.tournamentOf(b).tier] ||
        a.scheduledAt.localeCompare(b.scheduledAt),
    )
    .slice(0, limit * 6)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
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
