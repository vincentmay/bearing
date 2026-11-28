import { type Atlas, type DisciplineId, type Follow, tournamentStatus } from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import { Check, Plus, Search, Star, Trophy } from "lucide-react";
import { type CSSProperties, type ReactNode, useMemo, useState } from "react";
import { useFollow } from "../lib/world";
import { type Board, useBoard } from "./board";
import { plainName, sideOf } from "./model";
import { useFind } from "./shell";
import { CardSky } from "./sky";
import { Disc, TopCard } from "./ui";

const KEY = "bearing.welcome.v1";
const DAY = 24 * 60 * 60 * 1000;

/** Whether the first visit's question has been answered or put aside on this device. */
export function welcomed(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return true;
  }
}

function remember() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Not remembered: the question comes once more, which does no harm.
  }
}

interface Pick {
  follow: Follow;
  name: string;
  line: string;
  mark: ReactNode;
  game: string;
}

/** One thing to follow, as a card: a tap follows it, another lets go again. */
function PickCard({ pick }: { pick: Pick }) {
  const [on, toggle] = useFollow(pick.follow);
  return (
    <button type="button" className="bx-pk" aria-pressed={on} onClick={toggle}>
      {pick.mark}
      <span className="bx-pk-tg" aria-hidden>
        {on ? <Star size={16} /> : <Plus size={16} />}
      </span>
      <span>
        <b>{pick.name}</b>
        <small>{pick.line}</small>
      </span>
    </button>
  );
}

const tier = { S: 0, A: 1, B: 2 } as const;

interface Standing {
  /** Lower is better; only compared within one game. */
  order: number;
  /** What it rests on, in a few words: "No. 3 in the world", "GM · 2839", an event's name. */
  says: string;
}

/**
 * Who matters most in each game, best first. A game with a ranking uses it (Valve's for
 * Counter-Strike); one whose players carry a rating uses that (FIDE's for chess); for the rest
 * it is whoever plays in the biggest events Kiming knows of.
 */
function standings(atlas: Atlas): Map<string, { id: string; standing: Standing }[]> {
  const out = new Map<string, { id: string; standing: Standing }[]>();
  for (const d of atlas.world.disciplines) {
    const ranking = atlas.world.rankings.find((r) => r.discipline === d.id);
    const world = ranking && /world/i.test(ranking.title) ? " in the world" : "";
    const ranked = (ranking?.entries ?? [])
      .map((e, i) => ({
        id: e.competitorId,
        standing: { order: i, says: `No. ${e.rank ?? i + 1}${world}` },
      }))
      .filter((e) => atlas.competitor(e.id)?.kind === d.competitor);
    if (ranked.length) {
      out.set(d.id, ranked);
      continue;
    }
    const rated = atlas.world.competitors
      .filter((c) => c.kind === "player" && c.discipline === d.id && c.rating)
      .map((c) => {
        const p = c as Extract<typeof c, { kind: "player" }>;
        const value = p.rating?.value ?? 0;
        return {
          id: p.id,
          standing: { order: -value, says: p.title ? `${p.title} · ${value}` : `${value}` },
        };
      })
      .sort((a, b) => a.standing.order - b.standing.order);
    if (d.competitor === "player" && rated.length) {
      out.set(d.id, rated);
      continue;
    }
    // No ranking and no rating: the biggest event each one plays in, then how much they play.
    const seen = new Map<string, { best: number; event: string; games: number }>();
    for (const match of atlas.world.matches) {
      const t = atlas.tournamentOf(match);
      if (t.discipline !== d.id) continue;
      for (const side of match.sides) {
        const id = side.competitorId;
        if (!id || atlas.competitor(id)?.kind !== d.competitor) continue;
        const was = seen.get(id);
        const best = tier[t.tier];
        if (!was) seen.set(id, { best, event: t.name, games: 1 });
        else {
          was.games++;
          if (best < was.best) {
            was.best = best;
            was.event = t.name;
          }
        }
      }
    }
    const playing = [...seen]
      .sort((a, b) => a[1].best - b[1].best || b[1].games - a[1].games)
      .map(([id, s], i) => ({ id, standing: { order: i, says: s.event } }));
    if (playing.length) out.set(d.id, playing);
  }
  return out;
}

/** What a team or player is doing today, if anything: playing, or about to. */
function doing(board: Board, id: string): string | undefined {
  const { atlas, now, times } = board;
  const today = times.dayKey(now);
  const mine = atlas.world.matches.filter(
    (m) => m.sides.length === 2 && m.sides.some((s) => s.competitorId === id),
  );
  const live = mine.find((m) => m.status === "live");
  if (live) {
    const other = live.sides.map((s) => s.competitorId).find((x) => x && x !== id);
    return other ? `Live against ${plainName(atlas, other)}` : "Live now";
  }
  const next = mine
    .filter((m) => m.status === "scheduled" && times.dayKey(m.scheduledAt) === today)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
  return next ? `plays at ${times.clock(next.scheduledAt)}` : undefined;
}

/** The first of each list, then the second of each, and so on: no one game fills the grid. */
function inTurn<T>(lists: T[][], most: number): T[] {
  const out: T[] = [];
  for (let i = 0; out.length < most && lists.some((l) => i < l.length); i++) {
    for (const list of lists) {
      const entry = list[i];
      if (entry !== undefined && out.length < most) out.push(entry);
    }
  }
  return out;
}

/** How many cards each grid holds: three rows of people, one of events (two once a game is chosen). */
const PEOPLE = 12;
const EVENTS = 4;

/**
 * The first visit: who do you follow? A few taps here and every page puts the viewer's own
 * matches first. It asks once per device, can be put aside, and needs no account.
 */
export function Welcome({ board, onDone }: { board: Board; onDone: () => void }) {
  return <Picks board={board} onDone={onDone} />;
}

/** More to follow, from the Following page: the same picks, without what is followed already. */
export function FollowMore() {
  return <Picks board={useBoard()} more />;
}

/**
 * Things to follow, a tap each. It offers the names most people come for (the top of each
 * game, every game in turn), not whoever happens to play at this hour; anyone else is a search
 * away.
 */
function Picks({
  board,
  more = false,
  onDone,
}: {
  board: Board;
  /** Opened from Following, not on a first visit: what is followed already is left out. */
  more?: boolean;
  onDone?: () => void;
}) {
  const { atlas, now } = board;
  const [game, setGame] = useState<string>();
  const find = useFind();
  // What was followed when the page opened. A card tapped here stays where it is, lit.
  const [before] = useState(atlas);
  const had = (follow: Follow) =>
    more &&
    (follow.kind === "tournament"
      ? before.world.follows.some((f) => f.kind === "tournament" && f.id === follow.id)
      : before.followsCompetitor(follow.id));

  const best = useMemo(() => standings(atlas), [atlas]);
  const events = useMemo(() => {
    const on = new Set(atlas.live().map((m) => m.tournamentId));
    const days = (t: { start: string; end: string }) =>
      Math.round((Date.parse(`${t.end}T00:00:00Z`) - Date.parse(`${t.start}T00:00:00Z`)) / DAY) + 1;
    // The biggest first; among those, what is being played right now, and a week's event
    // before a league that runs for most of a year.
    return atlas.world.tournaments
      .filter((t) => tournamentStatus(atlas, t, now) === "live")
      .sort(
        (a, b) =>
          tier[a.tier] - tier[b.tier] ||
          Number(on.has(b.id)) - Number(on.has(a.id)) ||
          days(a) - days(b) ||
          a.start.localeCompare(b.start),
      )
      .map((t): Pick => {
        const first = Date.parse(`${t.start}T00:00:00Z`);
        const all = days(t);
        const day = Math.min(all, Math.max(1, Math.floor((now - first) / DAY) + 1));
        return {
          follow: { kind: "tournament", id: t.id },
          name: t.name,
          line: `${atlas.discipline(t.discipline).short} · Day ${day} of ${all}`,
          mark: (
            <span
              className="bx-disc bx-disc-plain"
              style={{ "--s": "44px" } as CSSProperties}
              aria-hidden
            >
              <Trophy size={20} />
            </span>
          ),
          game: t.discipline,
        };
      })
      .filter((pick) => !had(pick.follow));
    // `had` follows from `before` and `more`, which do not change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atlas, now]);

  const games = atlas.world.disciplines.filter(
    (d) => best.has(d.id) || events.some((e) => e.game === d.id),
  );
  // With every game shown, each takes its turn: the first of each, then the second of each.
  const people = useMemo(() => {
    const lists = (game ? [game] : games.map((d) => d.id)).map((id) =>
      (best.get(id) ?? []).filter(
        (entry) => !had({ kind: atlas.competitor(entry.id)?.kind ?? "team", id: entry.id }),
      ),
    );
    return inTurn(lists, PEOPLE).map((entry) => entry.id);
    // `games` follows from `atlas` and `best`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atlas, best, game]);
  const picks: Pick[] = people.flatMap((id) => {
    const c = atlas.competitor(id);
    if (!c) return [];
    const discipline = atlas.discipline(c.discipline);
    const says = best.get(c.discipline)?.find((e) => e.id === id)?.standing.says;
    const today = doing(board, id);
    // Playing right now is the news; otherwise where they stand, and when they play today.
    const line = today?.startsWith("Live") ? today : [says, today].filter(Boolean).join(" · ");
    return [
      {
        follow: { kind: c.kind, id },
        name: plainName(atlas, id),
        line: `${discipline.short} · ${line}`,
        mark: <Disc side={sideOf(atlas, id)} size={44} />,
        game: c.discipline,
      },
    ];
  });
  const on = game
    ? events.filter((e) => e.game === game).slice(0, EVENTS * 2)
    : inTurn(
        games.map((d) => events.filter((e) => e.game === d.id)),
        EVENTS,
      );

  const picked = atlas.world.follows.length;
  const done = () => {
    remember();
    onDone?.();
  };

  return (
    <>
      <TopCard className="bx-stage">
        <CardSky />
        <div className="bx-ent-in">
          <div className="bx-eh">
            <div>
              <h1>{more ? "Follow more" : "What do you follow?"}</h1>
              <p>
                {more
                  ? "Tap a team, a player or an event. Their matches come first everywhere in Kiming."
                  : "Pick a few teams and players. Their matches come first everywhere in Kiming, and you need no account."}
              </p>
            </div>
            {more ? (
              <div className="bx-eh-acts">
                <Link to="/following" className="bx-btn" data-k="main">
                  <Check size={16} aria-hidden />
                  Done
                </Link>
              </div>
            ) : (
              <div className="bx-eh-acts">
                {picked ? null : (
                  <button type="button" className="bx-btn" data-k="quiet" onClick={done}>
                    Skip for now
                  </button>
                )}
                <button
                  type="button"
                  className="bx-btn"
                  data-k="main"
                  disabled={!picked}
                  onClick={done}
                >
                  <Check size={16} aria-hidden />
                  {picked ? `Done, ${picked} picked` : "Done"}
                </button>
              </div>
            )}
          </div>
          {games.length > 1 ? (
            <div className="bx-picks" data-k="words" role="group" aria-label="Game">
              <button type="button" aria-pressed={!game} onClick={() => setGame(undefined)}>
                All games
              </button>
              {games.map((d) => (
                <button
                  type="button"
                  key={d.id}
                  aria-pressed={game === d.id}
                  onClick={() => setGame(d.id)}
                >
                  {d.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </TopCard>
      {picks.length ? (
        <>
          <h2 className="bx-h2">
            {game
              ? `The top of ${atlas.discipline(game as DisciplineId).name}`
              : "The top of each game"}
            <small>tap to follow</small>
            <button type="button" data-k="find" onClick={find}>
              <Search size={15} aria-hidden />
              <span>Find someone else</span>
            </button>
          </h2>
          <div className="bx-pks">
            {picks.map((p) => (
              <PickCard key={p.follow.id} pick={p} />
            ))}
          </div>
        </>
      ) : null}
      {on.length ? (
        <>
          <h2 className="bx-h2">Events on now</h2>
          <div className="bx-pks">
            {on.map((p) => (
              <PickCard key={p.follow.id} pick={p} />
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
