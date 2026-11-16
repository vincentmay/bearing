import { Atlas, roundRobinStandings, seriesScore, winnerOf } from "../derive.ts";
import type {
  DisciplineId,
  GameEvent,
  GameResult,
  Match,
  PlayerLine,
  RoundRecord,
  Tournament,
  World,
} from "../model.ts";
import { SAMPLE_GAMES, notesOf } from "./games.ts";
import { pick, shuffle, type Rand } from "./kit.ts";
import { CUP_LIMIT, CUP_POINTS } from "./trackmania.ts";

/**
 * Plays the sample world forward by one beat, so the screens have something that changes: a round
 * is won, a goal goes in, a game ends, the winner moves on in the bracket.
 *
 * It is a pure function from one world to the next. The app calls it on a timer today; a backend
 * can call it on a schedule and the screens will not know the difference. A world that did not
 * change is returned as the same object, and a match that did not change keeps its identity.
 */
export function advance(world: World, r: Rand, now: number = Date.parse(world.now)): World {
  const disciplineOf = new Map(world.tournaments.map((t) => [t.id, t.discipline]));
  const ended: Match[] = [];
  let matches = world.matches.map((m) => {
    const d = disciplineOf.get(m.tournamentId);
    if (!d) return m;
    let next = m;
    if (m.status === "live") next = STEP[d](m, r);
    else if (
      m.status === "scheduled" &&
      Date.parse(m.scheduledAt) <= now &&
      m.sides.every((s) => s.competitorId)
    )
      next = openNext({ ...m, status: "live" }, d, r);
    if (next !== m && next.status === "finished") ended.push(next);
    return next;
  });
  for (const m of ended) matches = promote(world, matches, m);
  if (!matches.some((m, i) => m !== world.matches[i])) return world;
  const touched = new Set(ended.map((m) => m.tournamentId));
  const tournaments = touched.size
    ? world.tournaments.map((t) => (touched.has(t.id) ? placed({ ...world, matches }, t) : t))
    : world.tournaments;
  return { ...world, matches, tournaments };
}

/** Write whoever is now out, or has won, into the event's places. */
function placed(world: World, t: Tournament): Tournament {
  const stage = t.stages.at(-1);
  if (!t.placements || !stage) return t;
  const byId = new Map(world.matches.map((m) => [m.id, m]));
  const at = new Map<number, string[]>();
  const put = (rank: number, id: string | null | undefined) => {
    if (id) at.set(rank, [...(at.get(rank) ?? []), id]);
  };
  if (stage.format === "single-elim" || stage.format === "cup") {
    const per = stage.rules?.advancePerMatch ?? 1;
    const rounds = stage.rounds.filter((r) => r.matchIds.length);
    rounds.forEach((round, i) => {
      const final = i === rounds.length - 1;
      for (const id of round.matchIds) {
        const m = byId.get(id);
        if (m?.status !== "finished") continue;
        const w = winnerOf(m);
        const order = m.ranking ?? (typeof w === "number" ? [w, 1 - w] : []);
        order.forEach((side, place) => {
          const who = m.sides[side]?.competitorId;
          // In the final the first two take first and second; everyone else shares third.
          if (final) put(Math.min(place + 1, 3), who);
          // Before it, whoever does not go through shares the place below those who do.
          else if (place >= per) put(round.matchIds.length * per + 1, who);
        });
      }
    });
  } else if (stage.format === "round-robin") {
    const matches = stage.rounds.flatMap((r) => r.matchIds.map((id) => byId.get(id)));
    if (matches.every((m) => m?.status === "finished")) {
      roundRobinStandings(new Atlas(world), stage, t.participantIds).forEach((row, i) =>
        put(i + 1, row.competitorId),
      );
    }
  }
  if (!at.size) return t;
  return {
    ...t,
    placements: t.placements.map((p) => {
      const ids = at.get(p.rank);
      return ids ? { ...p, competitorIds: ids } : p;
    }),
  };
}

const CS_MAPS = ["Ancient", "Anubis", "Dust2", "Inferno", "Mirage", "Nuke", "Train"] as const;

const STEP: Record<DisciplineId, (m: Match, r: Rand) => Match> = {
  cs2: stepCs,
  lol: stepLol,
  "rocket-league": stepRocketLeague,
  chess: stepChess,
  trackmania: stepCup,
};

function liveIndex(m: Match): number {
  return m.games.findIndex((g) => g.status === "live");
}

function withGame(m: Match, index: number, game: GameResult): Match {
  return { ...m, games: m.games.map((g, i) => (i === index ? game : g)) };
}

/** The series is over once one side cannot be caught, or every game has been played. */
function settle(m: Match): Match {
  const decided = Math.max(...seriesScore(m)) > m.bestOf / 2;
  const played = m.games.length >= m.bestOf && m.games.every((g) => g.status === "finished");
  return decided || played ? { ...m, status: "finished" } : m;
}

/** Between two games nothing is being played for a moment; then the next one begins. */
function openNext(m: Match, d: DisciplineId, r: Rand): Match {
  let games = m.games;
  if (!games.some((g) => g.status === "scheduled")) {
    if (games.length >= m.bestOf) return m;
    const labels =
      d === "cs2"
        ? shuffle(r, CS_MAPS)
        : Array.from({ length: m.bestOf }, (_, i) => `Game ${i + 1}`);
    games = [
      ...games,
      ...labels
        .slice(games.length, m.bestOf)
        .map((label): GameResult => ({ label, status: "scheduled" })),
    ];
  }
  const index = games.findIndex((g) => g.status === "scheduled");
  const game = games[index]!;
  const zero = m.sides.map(() => 0);
  let opened: GameResult;
  switch (d) {
    case "cs2": {
      const before = games.findLast((g) => g.lines)?.lines;
      opened = {
        ...game,
        status: "live",
        scores: zero,
        rounds: [],
        lines: before?.map((l): PlayerLine => ({
          playerId: l.playerId,
          side: l.side,
          kills: 0,
          deaths: 0,
          assists: 0,
        })),
      };
      break;
    }
    case "lol":
      opened = {
        ...game,
        status: "live",
        scores: zero,
        clock: 0,
        events: [],
        firstSide: game.firstSide ?? index % 2,
        objectives: { towers: [0, 0], dragons: [0, 0], barons: [0, 0], gold: [0, 0] },
      };
      break;
    case "rocket-league":
      opened = { ...game, status: "live", scores: zero, clock: 0, events: [] };
      break;
    case "chess":
      opened = {
        ...game,
        status: "live",
        firstSide: game.firstSide ?? index % 2,
        chess: { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", move: 1 },
      };
      break;
    case "trackmania":
      opened = {
        ...game,
        status: "live",
        scores: zero,
        detail: "Round 1",
        cup: { limit: CUP_LIMIT, round: 1, finalists: [], rounds: [] },
      };
      break;
  }
  return { ...m, games: games.map((g, i) => (i === index ? opened : g)) };
}

// ---------------- Counter-Strike 2: a beat is a round ----------------

function stepCs(m: Match, r: Rand): Match {
  const i = liveIndex(m);
  if (i < 0) return r() < 0.6 ? openNext(m, "cs2", r) : m;
  if (r() > 0.45) return m;
  const g = m.games[i]!;
  const rounds = g.rounds ?? [];
  const scores = [...(g.scores ?? [0, 0])];
  const w = r() < 0.52 ? 0 : 1;
  scores[w]!++;
  const n = rounds.length;
  const startCt = rounds[0]?.ct ?? (r() < 0.5 ? 0 : 1);
  // Sides swap at the half and every three rounds in overtime.
  let ct = n < 12 ? startCt : 1 - startCt;
  if (n >= 24) ct = Math.floor((n - 24) / 3) % 2 === 0 ? startCt : 1 - startCt;
  const roll = r();
  const how: RoundRecord["how"] =
    w === ct
      ? roll < 0.58
        ? "elimination"
        : roll < 0.83
          ? "defuse"
          : "time"
      : roll < 0.64
        ? "elimination"
        : "bomb";
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  // First to 13; from 12–12, overtime to 16, then 19, always two clear.
  const over = max >= 13 && max - min >= 2 && (max - 13) % 3 === 0;
  const game: GameResult = {
    ...g,
    scores,
    rounds: [...rounds, { winner: w, how, ct }],
    lines: csKills(g.lines, w, r),
    ...(over
      ? {
          status: "finished" as const,
          winner: w,
          detail: max > 16 ? "Double overtime" : max > 13 ? "Overtime" : undefined,
        }
      : {}),
  };
  const next = withGame(m, i, game);
  return over ? settle(next) : next;
}

/** Share a round's kills out among the players, keeping kills and deaths in step. */
function csKills(lines: PlayerLine[] | undefined, w: number, r: Rand): PlayerLine[] | undefined {
  if (!lines?.length) return lines;
  const out = lines.map((l) => ({ ...l }));
  const add = (side: number, count: number) => {
    const killers = out.filter((l) => l.side === side);
    const victims = out.filter((l) => l.side !== side);
    if (!killers.length || !victims.length) return;
    for (let k = 0; k < count; k++) {
      pick(r, killers).kills++;
      pick(r, victims).deaths++;
    }
  };
  add(w, 3 + Math.floor(r() * 3));
  add(1 - w, Math.floor(r() * 4));
  return out;
}

// ---------------- League of Legends: the clock runs, objectives fall ----------------

const WEIGHT: Record<GameEvent["kind"], number> = { goal: 1, tower: 1, dragon: 2, baron: 3 };

function stepLol(m: Match, r: Rand): Match {
  const i = liveIndex(m);
  if (i < 0) return r() < 0.6 ? openNext(m, "lol", r) : m;
  const g = m.games[i]!;
  const clock = (g.clock ?? 0) + 20;
  const scores = [...(g.scores ?? [0, 0])];
  if (r() < 0.3) scores[r() < 0.55 ? 0 : 1]!++;
  let events = g.events ?? [];
  const o = g.objectives ?? { towers: [0, 0], dragons: [0, 0], barons: [0, 0], gold: [0, 0] };
  let objectives = o;
  if (clock > 4 * 60 && r() < 0.12) {
    const roll = r();
    const kind: GameEvent["kind"] =
      clock >= 20 * 60 && roll < 0.2 ? "baron" : roll < 0.45 ? "dragon" : "tower";
    const side = r() < 0.55 ? 0 : 1;
    events = [...events, { at: clock, side, kind }];
    const bump = (list: number[]) => list.map((v, s) => (s === side ? v + 1 : v));
    objectives = {
      ...o,
      towers: kind === "tower" ? bump(o.towers) : o.towers,
      dragons: kind === "dragon" ? bump(o.dragons) : o.dragons,
      barons: kind === "baron" ? bump(o.barons) : o.barons,
    };
  }
  const over = clock >= 26 * 60 && (r() < 0.04 || clock >= 42 * 60);
  let game: GameResult = { ...g, clock, scores, events, objectives };
  if (over) {
    const weight = [0, 1].map((s) =>
      events.filter((e) => e.side === s).reduce((sum, e) => sum + WEIGHT[e.kind], 0),
    );
    const winner =
      weight[0] !== weight[1] ? (weight[0]! > weight[1]! ? 0 : 1) : scores[1]! > scores[0]! ? 1 : 0;
    game = {
      ...game,
      status: "finished",
      winner,
      detail: `${Math.floor(clock / 60)}:${String(clock % 60).padStart(2, "0")}`,
    };
  }
  const next = withGame(m, i, game);
  return over ? settle(next) : next;
}

// ---------------- Rocket League: five minutes, then overtime while level ----------------

function stepRocketLeague(m: Match, r: Rand): Match {
  const i = liveIndex(m);
  if (i < 0) return r() < 0.6 ? openNext(m, "rocket-league", r) : m;
  const g = m.games[i]!;
  const scores = [...(g.scores ?? [0, 0])];
  const before = g.clock ?? 0;
  const overtime = before >= 300;
  const clock = overtime ? before + 5 : Math.min(300, before + 5);
  let events = g.events ?? [];
  if (r() < (overtime ? 0.2 : 0.07)) {
    const side = r() < 0.52 ? 0 : 1;
    scores[side]!++;
    events = [...events, { at: clock, side, kind: "goal" }];
  }
  const over = clock >= 300 && scores[0] !== scores[1];
  const game: GameResult = {
    ...g,
    clock,
    scores,
    events,
    ...(over
      ? {
          status: "finished" as const,
          winner: scores[0]! > scores[1]! ? 0 : 1,
          detail: clock > 300 ? "Overtime" : undefined,
        }
      : {}),
  };
  const next = withGame(m, i, game);
  return over ? settle(next) : next;
}

// ---------------- Chess: moves are played, then a result ----------------

function stepChess(m: Match, r: Rand): Match {
  const i = liveIndex(m);
  if (i < 0) return r() < 0.6 ? openNext(m, "chess", r) : m;
  if (r() > 0.5) return m;
  const g = m.games[i]!;
  const sofar = g.moves ?? [];
  // The game on the board is one from the shelf; a new game takes one at random.
  const line =
    SAMPLE_GAMES.find((x) => sofar.length && sofar.every((san, k) => x.moves[k] === san)) ??
    pick(r, SAMPLE_GAMES);
  const moves = line.moves.slice(0, sofar.length + 1);
  const move = Math.ceil(moves.length / 2);
  const chess = { fen: "", move };
  if (moves.length < line.moves.length) {
    return withGame(m, i, {
      ...g,
      chess,
      moves,
      ...notesOf(line, moves.length),
      detail: `${line.opening} · move ${move}`,
    });
  }
  const white = g.firstSide ?? 0;
  const winner = line.result === 0.5 ? ("draw" as const) : line.result === 1 ? white : 1 - white;
  return settle(
    withGame(m, i, {
      ...g,
      status: "finished",
      chess,
      moves,
      ...notesOf(line, moves.length),
      winner,
      scores: m.sides.map((_, s) => (winner === "draw" ? 0.5 : winner === s ? 1 : 0)),
      detail: `${line.opening} · ${move} moves`,
    }),
  );
}

// ---------------- Trackmania cup: a beat is a round ----------------

function stepCup(m: Match, r: Rand): Match {
  const i = liveIndex(m);
  if (i < 0) return r() < 0.6 ? openNext(m, "trackmania", r) : m;
  if (r() > 0.3) return m;
  const g = m.games[i]!;
  const cup = g.cup ?? { limit: CUP_LIMIT, round: 1, finalists: [], rounds: [] };
  const scores = [...(g.scores ?? m.sides.map(() => 0))];
  // Whoever is ahead is a little more likely to finish in front.
  const order = m.sides
    .map((_, s) => ({ s, roll: r() * (1 + (scores[s] ?? 0) / cup.limit) }))
    .sort((a, b) => b.roll - a.roll)
    .map((x) => x.s);
  const rounds = [...(cup.rounds ?? []), order];
  const first = order[0]!;
  if (cup.finalists.includes(first)) {
    // A driver at the limit has won a round: the match is theirs.
    const rest = order.slice(1).sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
    return {
      ...withGame(m, i, { ...g, status: "finished", winner: first, cup: { ...cup, rounds } }),
      status: "finished",
      ranking: [first, ...rest],
    };
  }
  order.forEach((s, place) => {
    if (!cup.finalists.includes(s)) scores[s] = (scores[s] ?? 0) + (CUP_POINTS[place] ?? 0);
  });
  const finalists = m.sides.map((_, s) => s).filter((s) => (scores[s] ?? 0) >= cup.limit);
  const round = cup.round + 1;
  return withGame(m, i, {
    ...g,
    scores,
    detail: `Round ${round}`,
    cup: { ...cup, round, finalists, rounds },
  });
}

// ---------------- The bracket moves on ----------------

/** Put whoever came through `done` into the open places of the match it feeds. */
function promote(world: World, matches: Match[], done: Match): Match[] {
  const targetId = done.next?.winner;
  const target = matches.find((m) => m.id === targetId);
  if (!targetId || !target) return matches;
  const round = world.tournaments
    .find((t) => t.id === done.tournamentId)
    ?.stages.find((s) => s.id === done.stageId)
    ?.rounds.find((x) => x.id === done.roundId);
  const order = (m: Match) => round?.matchIds.indexOf(m.id) ?? 0;
  const feeders = matches
    .filter((m) => m.next?.winner === targetId)
    .sort((a, b) => order(a) - order(b));
  const per = Math.max(1, Math.floor(target.sides.length / feeders.length));
  const slot = feeders.findIndex((f) => f.id === done.id) * per;
  const w = winnerOf(done);
  const through = done.ranking
    ? done.ranking.slice(0, per).map((s) => done.sides[s]?.competitorId ?? null)
    : typeof w === "number"
      ? [done.sides[w]?.competitorId ?? null]
      : [];
  const sides = target.sides.map((s, i) => {
    const id = through[i - slot];
    return id && !s.competitorId ? { ...s, competitorId: id } : s;
  });
  return matches.map((m) => (m.id === targetId ? { ...m, sides } : m));
}
