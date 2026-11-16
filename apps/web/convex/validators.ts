import type {
  Competitor,
  Discipline,
  Follow,
  Match,
  Organization,
  Ranking,
  Stint,
  Tournament,
} from "@bearing/domain";
import { type Infer, v } from "convex/values";

/**
 * The canonical model of `packages/domain`, as validators. Everything written to the database
 * passes through these, so a source adapter cannot store a shape the screens do not know.
 * The assertions at the end fail to compile if the two ever drift apart.
 */

const text = v.string();
const maybeText = v.optional(v.string());
const numbers = v.array(v.number());

export const disciplineId = v.union(
  v.literal("cs2"),
  v.literal("lol"),
  v.literal("trackmania"),
  v.literal("chess"),
  v.literal("rocket-league"),
);

const colors = v.object({ primary: text, secondary: text });

export const discipline = v.object({
  id: disciplineId,
  name: text,
  short: text,
  competitor: v.union(v.literal("team"), v.literal("player")),
  unit: v.object({ one: text, many: text }),
  palette: v.object({ accent: text, glow: text, deep: text }),
});

export const organization = v.object({ id: text, name: text, colors });

const team = v.object({
  kind: v.literal("team"),
  id: text,
  discipline: disciplineId,
  orgId: maybeText,
  name: text,
  short: text,
  region: text,
  country: maybeText,
  colors: v.optional(colors),
  founded: maybeText,
  image: maybeText,
  imageDark: maybeText,
});

const player = v.object({
  kind: v.literal("player"),
  id: text,
  discipline: disciplineId,
  handle: text,
  name: maybeText,
  country: text,
  born: maybeText,
  role: maybeText,
  title: maybeText,
  rating: v.optional(v.object({ system: text, value: v.number() })),
  colors: v.optional(colors),
  image: maybeText,
  imageCredit: maybeText,
});

export const competitor = v.union(team, player);

export const stint = v.object({
  id: text,
  playerId: text,
  teamId: text,
  role: text,
  from: maybeText,
  to: maybeText,
  note: maybeText,
});

const provenance = v.object({ source: text, checkedAt: text, note: maybeText });

const stage = v.object({
  id: text,
  name: text,
  format: v.union(
    v.literal("swiss"),
    v.literal("single-elim"),
    v.literal("double-elim"),
    v.literal("round-robin"),
    v.literal("cup"),
    v.literal("rounds"),
  ),
  start: text,
  end: text,
  explainer: text,
  rounds: v.array(v.object({ id: text, name: text, short: text, matchIds: v.array(text) })),
  rules: v.optional(
    v.object({
      winsToAdvance: v.optional(v.number()),
      lossesToExit: v.optional(v.number()),
      advancePerMatch: v.optional(v.number()),
    }),
  ),
});

export const tournament = v.object({
  image: maybeText,
  id: text,
  discipline: disciplineId,
  name: text,
  short: text,
  series: maybeText,
  tier: v.union(v.literal("S"), v.literal("A"), v.literal("B")),
  organizer: text,
  location: v.union(v.null(), v.object({ city: text, country: text, venue: maybeText })),
  start: text,
  end: text,
  prize: v.optional(v.object({ amount: v.number(), currency: text })),
  colors: v.optional(colors),
  participantIds: v.array(text),
  stages: v.array(stage),
  provenance,
  placements: v.optional(
    v.array(
      v.object({
        place: text,
        rank: v.number(),
        prize: v.optional(v.number()),
        competitorIds: v.array(text),
      }),
    ),
  ),
  blurb: maybeText,
});

const status = v.union(v.literal("scheduled"), v.literal("live"), v.literal("finished"));

const champion = v.object({ name: text, key: maybeText });

export const game = v.object({
  label: text,
  status,
  scores: v.optional(numbers),
  winner: v.optional(v.union(v.number(), v.literal("draw"))),
  pickedBy: v.optional(v.number()),
  firstSide: v.optional(v.number()),
  detail: maybeText,
  rounds: v.optional(
    v.array(
      v.object({
        winner: v.number(),
        how: v.union(
          v.literal("elimination"),
          v.literal("bomb"),
          v.literal("defuse"),
          v.literal("time"),
        ),
        ct: v.number(),
      }),
    ),
  ),
  lines: v.optional(
    v.array(
      v.object({
        playerId: text,
        side: v.number(),
        kills: v.number(),
        deaths: v.number(),
        assists: v.number(),
        adr: v.optional(v.number()),
        rating: v.optional(v.number()),
        role: maybeText,
        gold: v.optional(v.number()),
        handle: maybeText,
        champion: maybeText,
        cs: v.optional(v.number()),
        damage: v.optional(v.number()),
      }),
    ),
  ),
  lead: v.optional(v.array(v.number())),
  draft: v.optional(
    v.object({
      patch: maybeText,
      picks: v.array(v.array(champion)),
      bans: v.array(v.array(champion)),
    }),
  ),
  objectives: v.optional(
    v.object({ towers: numbers, dragons: numbers, barons: numbers, gold: numbers }),
  ),
  chess: v.optional(
    v.object({
      fen: text,
      move: v.number(),
      clocks: v.optional(v.array(text)),
      eval: v.optional(v.number()),
      lastMove: maybeText,
    }),
  ),
  moves: v.optional(v.array(text)),
  evals: v.optional(v.array(v.number())),
  clocks: v.optional(v.array(v.number())),
  cup: v.optional(
    v.object({
      limit: v.number(),
      round: v.number(),
      finalists: numbers,
      rounds: v.optional(v.array(numbers)),
    }),
  ),
  startedAt: maybeText,
  clock: v.optional(v.number()),
  events: v.optional(
    v.array(
      v.object({
        at: v.number(),
        side: v.number(),
        kind: v.union(
          v.literal("goal"),
          v.literal("tower"),
          v.literal("dragon"),
          v.literal("baron"),
        ),
      }),
    ),
  ),
});

export const match = v.object({
  id: text,
  tournamentId: text,
  stageId: text,
  roundId: text,
  scheduledAt: text,
  bestOf: v.number(),
  status,
  sides: v.array(v.object({ competitorId: v.union(text, v.null()), placeholder: maybeText })),
  games: v.array(game),
  veto: v.optional(
    v.array(
      v.object({
        action: v.union(v.literal("ban"), v.literal("pick"), v.literal("decider")),
        side: v.optional(v.number()),
        label: text,
      }),
    ),
  ),
  stream: v.optional(v.object({ label: text, url: text })),
  next: v.optional(v.object({ winner: maybeText, loser: maybeText })),
  ranking: v.optional(numbers),
});

export const ranking = v.object({
  discipline: disciplineId,
  title: text,
  entries: v.array(
    v.object({
      competitorId: text,
      points: v.number(),
      change: v.number(),
      rank: v.optional(v.number()),
      name: maybeText,
    }),
  ),
});

export const follow = v.object({
  kind: v.union(
    v.literal("team"),
    v.literal("player"),
    v.literal("tournament"),
    v.literal("discipline"),
    v.literal("organization"),
  ),
  id: text,
});

/** Compiles only when the validator and the domain type describe the same thing. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
export const sameAsDomain: [
  Same<Infer<typeof discipline>, Discipline>,
  Same<Infer<typeof organization>, Organization>,
  Same<Infer<typeof competitor>, Competitor>,
  Same<Infer<typeof stint>, Stint>,
  Same<Infer<typeof tournament>, Tournament>,
  Same<Infer<typeof match>, Match>,
  Same<Infer<typeof ranking>, Ranking>,
  Same<Infer<typeof follow>, Follow>,
] = [true, true, true, true, true, true, true, true];
