import { Atlas, type Match } from "@bearing/domain";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { lichessId, roundOf, useRoundGames, withLive } from "../lib/chess-live";
import { useAtlas, useDetailed, useMinute } from "../lib/world";
import { type MatchView, summarize } from "./model";
import { type Times, useTimes } from "./time";

export interface Board {
  atlas: Atlas;
  /** The current instant, to the minute. */
  now: number;
  times: Times;
  view(match: Match): MatchView;
  /** What the page asked to have whole is still on its way. */
  loading: boolean;
}

/**
 * What every screen starts from: the world, the time, and how to read a match. A page about one
 * team or player names it as the subject, so that matches are drawn from its point of view.
 */
export function useBoard(
  subject?: string,
  /** What this page needs whole: one match, or the matches of one team or player. */
  whole?: { match?: string; side?: string; event?: string },
): Board {
  const light = useAtlas();
  const { match, side, event } = whole ?? {};
  const ids = useMemo(() => {
    if (match) return [match];
    if (event) {
      // An event's matches from before the weeks a list reaches back are asked for by name.
      const stages = light.tournament(event)?.stages ?? [];
      return stages
        .flatMap((s) => s.rounds.flatMap((r) => r.matchIds))
        .filter((id) => !light.match(id));
    }
    if (!side) return [];
    // A player's games are their team's: the lines of both are wanted.
    const team = light.world.stints.find((s) => s.playerId === side && !s.to)?.teamId;
    return [side, ...(team ? [team] : [])]
      .flatMap((id) => light.matchesFor(id))
      .filter((m) => m.status === "finished")
      .sort((x, y) => y.scheduledAt.localeCompare(x.scheduledAt))
      .map((m) => m.id);
  }, [light, match, side, event]);
  const detailed = useDetailed(light, ids);
  const atlas = useHeard(detailed.atlas, match, event);
  const loading = detailed.loading;
  const now = useMinute();
  const times = useTimes();
  const view = useCallback(
    (match: Match) => summarize(atlas, match, now, times, subject),
    [atlas, now, times, subject],
  );
  return { atlas, now, times, view, loading };
}

/**
 * Chess on the page, as Lichess has it this second. A page about one game listens to the
 * round it is part of while it is being played, and reads the round once where the store has
 * the result but not the moves. A page about an event listens to the rounds under way in it.
 */
function useHeard(atlas: Atlas, match?: string, event?: string): Atlas {
  const one = match ? atlas.match(match) : undefined;
  // The round to listen to: the one a game of this match is being played in.
  const round = useMemo(() => {
    if (one) {
      const playing = one.games.find((g) => g.status === "live" && g.ref);
      if (playing) return roundOf(playing);
      return one.games[0]?.ref || !lichessId(one.id) ? undefined : lichessId(one.roundId);
    }
    if (!event || !lichessId(event)) return undefined;
    // An event's page listens to the round under way in it; the latest, if there are two.
    const rounds = new Set<string>();
    for (const m of atlas.world.matches) {
      if (m.tournamentId !== event || m.status !== "live") continue;
      const playing = m.games.find((g) => g.status === "live" && g.ref);
      const id = playing ? roundOf(playing) : m.games[0]?.ref ? undefined : lichessId(m.roundId);
      if (id) rounds.add(id);
    }
    return [...rounds].sort().at(-1);
  }, [atlas, one, event]);
  const game = one?.games[0];
  const how = !one
    ? round
      ? "live"
      : undefined
    : one.status === "live"
      ? "live"
      : one.status === "finished" && !game?.ref && !game?.moves?.length
        ? "once"
        : undefined;
  const heard = useRoundGames(round, round ? how : undefined);
  return useMemo(() => {
    if (!Object.keys(heard).length) return atlas;
    let changed = false;
    const matches = atlas.world.matches.map((m) => {
      if (!lichessId(m.id)) return m;
      const next = withLive(m, heard);
      if (next !== m) changed = true;
      return next;
    });
    return changed ? new Atlas({ ...atlas.world, matches }) : atlas;
  }, [atlas, heard]);
}

const WIDE = "(min-width: 900px)";

/** True when there is room for the wide layout. */
export function useWide(): boolean {
  return useSyncExternalStore(
    (listener) => {
      const query = window.matchMedia(WIDE);
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
}
