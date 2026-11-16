import type {
  Champion,
  Draft,
  GameEvent,
  Match,
  PlayerLine,
  RoundRecord,
  Stint,
} from "../model.ts";
import { IMPACT } from "./rosters.ts";
import { rng, shuffle, type Rand } from "./kit.ts";

/** Current, non-coaching roster per team, in stint order. */
export function rosterIndex(stints: Stint[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const s of stints) {
    if (s.to || s.role === "Coach") continue;
    out.set(s.teamId, [...(out.get(s.teamId) ?? []), s.playerId]);
  }
  return out;
}

const impact = (playerId: string) => IMPACT[playerId.replace(/^[a-z0-9]+-/, "")] ?? 1;

/** Split an integer total across weights, keeping the sum exact. */
function split(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let rest = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (rest-- <= 0) break;
    out[i]!++;
  }
  return out;
}

// ---------------- Counter-Strike 2 ----------------

function cs2Rounds(r: Rand, scores: number[], finished: boolean, winner?: number): RoundRecord[] {
  const [a, b] = scores as [number, number];
  let order: number[];
  if (finished && winner !== undefined && Math.max(a, b) > 13) {
    // Overtime: level at 12–12 after regulation, then MR3 halves until someone wins by two.
    const reg = shuffle(r, [...Array(12).fill(0), ...Array(12).fill(1)]);
    const otW = Math.max(a, b) - 12;
    const otL = Math.min(a, b) - 12;
    const ot = shuffle(r, [...Array(otW - 1).fill(winner), ...Array(otL).fill(1 - winner)]);
    order = [...reg, ...ot, winner];
  } else if (finished && winner !== undefined) {
    const loser = 1 - winner;
    const body = shuffle(r, [
      ...Array(Math.max(a, b) - 1).fill(winner),
      ...Array(Math.min(a, b)).fill(loser),
    ]);
    order = [...body, winner];
  } else {
    order = shuffle(r, [...Array(a).fill(0), ...Array(b).fill(1)]);
  }
  const startCt = r() < 0.5 ? 0 : 1;
  return order.map((w, i) => {
    // Sides swap at the half (round 13) and every three rounds in overtime.
    let ct = i < 12 ? startCt : 1 - startCt;
    if (i >= 24) ct = Math.floor((i - 24) / 3) % 2 === 0 ? startCt : 1 - startCt;
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
    return { winner: w, how, ct };
  });
}

function cs2Lines(
  r: Rand,
  rosters: (string[] | undefined)[],
  scores: number[],
): PlayerLine[] | undefined {
  if (rosters.some((x) => !x || x.length < 5)) return undefined;
  const total = scores[0]! + scores[1]!;
  const teamKills = scores.map((won, side) => {
    const lost = scores[1 - side]!;
    return Math.round(won * 3.35 + lost * 1.55 + (r() - 0.5) * 6);
  });
  const lines: PlayerLine[] = [];
  rosters.forEach((roster, side) => {
    const ids = roster!.slice(0, 5);
    const kills = split(
      teamKills[side]!,
      ids.map((id) => impact(id) * (0.72 + r() * 0.56)),
    );
    const deaths = split(
      teamKills[1 - side]!,
      ids.map(() => 0.8 + r() * 0.4),
    );
    ids.forEach((playerId, i) => {
      const k = kills[i]!;
      const d = Math.min(deaths[i]!, total);
      const kpr = k / total;
      const spr = (total - d) / total;
      const adr = Math.round(kpr * 108 + 8 + r() * 12);
      const rating = Math.max(
        0.35,
        0.12 + (0.6 * kpr) / 0.68 + (0.28 * spr) / 0.32 + (r() - 0.5) * 0.08,
      );
      lines.push({
        playerId,
        side,
        kills: k,
        deaths: d,
        assists: Math.round(k * (0.22 + r() * 0.25)),
        adr,
        rating: Math.round(rating * 100) / 100,
      });
    });
  });
  return lines;
}

export function decorateCs2(matches: Match[], rosters: Map<string, string[]>) {
  const r = rng(4242);
  for (const m of matches) {
    const sideRosters = m.sides.map((s) =>
      s.competitorId ? rosters.get(s.competitorId) : undefined,
    );
    for (const g of m.games) {
      if (!g.scores || g.status === "scheduled") continue;
      const finished = g.status === "finished";
      g.rounds = cs2Rounds(
        r,
        g.scores,
        finished,
        typeof g.winner === "number" ? g.winner : undefined,
      );
      g.lines = cs2Lines(r, sideRosters, g.scores);
    }
  }
}

// ---------------- League of Legends ----------------

const LOL_ROLES = ["Top", "Jungle", "Mid", "Bot", "Support"] as const;
const KILL_SHARE = [0.19, 0.2, 0.26, 0.3, 0.05];
const DEATH_SHARE = [0.21, 0.2, 0.18, 0.18, 0.23];
const GOLD_SHARE = [0.21, 0.19, 0.23, 0.25, 0.12];

/** Put a game's objective counts on its clock: towers throughout, dragons every five minutes, barons late. */
function lolEvents(
  r: Rand,
  o: { towers: number[]; dragons: number[]; barons: number[] },
  seconds: number,
): GameEvent[] {
  const out: GameEvent[] = [];
  const spread = (kind: GameEvent["kind"], counts: number[], from: number, to: number) => {
    const sides = shuffle(r, [
      ...Array(counts[0]).fill(0),
      ...Array(counts[1]).fill(1),
    ] as number[]);
    sides.forEach((side, i) => {
      const slot = (to - from) / sides.length;
      out.push({ at: Math.round(from + slot * (i + 0.15 + r() * 0.7)), side, kind });
    });
  };
  spread("tower", o.towers, 7 * 60, seconds - 20);
  spread(
    "dragon",
    o.dragons,
    5 * 60,
    Math.min(seconds - 60, 5 * 60 + 300 * (o.dragons[0]! + o.dragons[1]!)),
  );
  spread("baron", o.barons, 20 * 60, seconds - 90);
  return out.sort((a, b) => a.at - b.at);
}

const c = (name: string, key = name): Champion => ({ name, key });

/** Champions by the role they are usually played in, top to support. */
const CHAMPIONS: Champion[][] = [
  [c("Gwen"), c("Ambessa"), c("Jax"), c("Aurora"), c("Rumble"), c("Renekton"), c("Jayce")],
  [c("Nocturne"), c("Wukong", "MonkeyKing"), c("Vi"), c("Pantheon"), c("Skarner"), c("Sejuani")],
  [c("Twisted Fate", "TwistedFate"), c("Annie"), c("Viktor"), c("Akali"), c("Azir"), c("Orianna")],
  [c("Jhin"), c("Xayah"), c("Kai'Sa", "Kaisa"), c("Sivir"), c("Ezreal"), c("Varus")],
  [c("Neeko"), c("Lulu"), c("Rakan"), c("Alistar"), c("Nautilus"), c("Braum")],
];

/** A draft: each side takes one champion per role, and bans five of those left over. */
function draftOf(r: Rand): Draft {
  const pools = CHAMPIONS.map((role) => shuffle(r, role));
  const picks = [0, 1].map((side) => pools.map((pool) => pool[side]!));
  const rest = shuffle(
    r,
    pools.flatMap((pool) => pool.slice(2)),
  );
  return { patch: "16.22.1", picks, bans: [rest.slice(0, 5), rest.slice(5, 10)] };
}

export function decorateLol(matches: Match[], rosters: Map<string, string[]>) {
  const r = rng(5151);
  for (const m of matches) {
    const sideRosters = m.sides.map((s) =>
      s.competitorId ? rosters.get(s.competitorId) : undefined,
    );
    for (const g of m.games) {
      if (g.status !== "finished" || !g.scores || typeof g.winner !== "number") continue;
      const w = g.winner;
      const towers = [0, 0];
      const dragons = [0, 0];
      const barons = [0, 0];
      const gold = [0, 0];
      towers[w] = 8 + Math.floor(r() * 4);
      towers[1 - w] = 1 + Math.floor(r() * 5);
      dragons[w] = 3 + Math.floor(r() * 2);
      dragons[1 - w] = Math.floor(r() * 3);
      barons[w] = 1 + Math.floor(r() * 2);
      barons[1 - w] = r() < 0.3 ? 1 : 0;
      gold[w] = 62_000 + Math.floor(r() * 12_000);
      gold[1 - w] = gold[w]! - (4_000 + Math.floor(r() * 9_000));
      g.objectives = { towers, dragons, barons, gold };
      const [min, sec] = (g.detail ?? "32:00").split(":").map(Number) as [number, number];
      g.clock = min * 60 + sec;
      g.events = lolEvents(r, g.objectives, g.clock);
      g.draft = draftOf(r);
      if (sideRosters.some((x) => !x || x.length < 5)) continue;
      const lines: PlayerLine[] = [];
      sideRosters.forEach((roster, side) => {
        const teamKills = g.scores![side]!;
        const kills = split(
          teamKills,
          KILL_SHARE.map((s, i) => s * impact(roster![i]!) * (0.7 + r() * 0.6)),
        );
        const deaths = split(
          g.scores![1 - side]!,
          DEATH_SHARE.map((s) => s * (0.7 + r() * 0.6)),
        );
        const golds = split(
          gold[side]!,
          GOLD_SHARE.map((s) => s * (0.9 + r() * 0.2)),
        );
        roster!.slice(0, 5).forEach((playerId, i) => {
          const participation = 0.55 + r() * 0.3;
          lines.push({
            playerId,
            side,
            role: LOL_ROLES[i],
            champion: g.draft!.picks[side]![i]!.name,
            cs: i === 4 ? 25 + Math.floor(r() * 30) : 190 + Math.floor(r() * 150),
            kills: kills[i]!,
            deaths: deaths[i]!,
            assists: Math.max(0, Math.round(teamKills * participation) - kills[i]!),
            gold: golds[i],
          });
        });
      });
      g.lines = lines;
    }
  }
}
