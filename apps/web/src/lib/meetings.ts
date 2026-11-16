import type { Atlas } from "@bearing/domain";
import { seriesScore, winnerOf } from "@bearing/domain";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../convex/_generated/api";
import { reader } from "./backend";

/** One earlier meeting of two sides, seen from the first of them. */
export interface Meeting {
  /** The match, where Bearing has it and it can be opened. */
  matchId?: string;
  at: string;
  event: string;
  score: number[];
  /** 0 when the first side won, 1 when the second did; undefined for a draw. */
  winner?: number;
}

/**
 * Every meeting on record between two sides, the latest first: the matches Bearing has, and
 * for teams whatever the store has looked up from further back.
 */
export function useMeetings(atlas: Atlas, a: string | null, b: string | null, not?: string) {
  const both = !!a && !!b;
  const { data } = useQuery({
    ...convexQuery(api.meetings.between, { a: a ?? "", b: b ?? "" }),
    enabled: both && !!reader,
  });
  if (!both) return [];
  const own: Meeting[] = atlas.world.matches
    .filter(
      (m) =>
        m.status === "finished" &&
        m.sides.length === 2 &&
        m.sides.some((s) => s.competitorId === a) &&
        m.sides.some((s) => s.competitorId === b),
    )
    .map((m) => {
      const first = m.sides[0]?.competitorId === a ? 0 : 1;
      const score = seriesScore(m);
      const won = winnerOf(m);
      return {
        matchId: m.id,
        at: m.scheduledAt,
        event: atlas.tournament(m.tournamentId)?.name ?? "",
        score: first === 0 ? score : [...score].reverse(),
        winner: typeof won === "number" ? (won === first ? 0 : 1) : undefined,
      };
    });
  const have = new Set(own.map((m) => m.matchId));
  const older: Meeting[] = (data ?? [])
    .filter((g) => !have.has(g.id))
    .map((g) => ({ at: g.at, event: g.event, score: g.score, winner: g.winner }));
  return [...own, ...older]
    .filter((m) => m.matchId !== not)
    .sort((x, y) => y.at.localeCompare(x.at));
}
