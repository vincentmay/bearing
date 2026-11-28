import { type Follow, type Match, tournamentStatus, winnerOf } from "@bearing/domain";
import { Check, Plus, Star, Trophy } from "lucide-react";
import { type CSSProperties, type ReactNode, useState } from "react";
import { useFollow } from "../lib/world";
import type { Board } from "./board";
import { plainName, sideOf } from "./model";
import { CardSky } from "./sky";
import { Disc } from "./ui";

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

/** What a team or player is doing today, in a few words: playing, about to, or done. */
function doing(board: Board, match: Match, id: string): string {
  const { atlas, times } = board;
  const other = match.sides.map((s) => s.competitorId).find((x) => x && x !== id);
  const versus = match.sides.length === 2 && other ? plainName(atlas, other) : undefined;
  if (match.status === "live") return versus ? `Live against ${versus}` : "Playing now";
  if (match.status === "scheduled") {
    const at = times.clock(match.scheduledAt);
    return versus ? `Plays ${versus} at ${at}` : `Plays at ${at}`;
  }
  const w = winnerOf(match);
  const won = typeof w === "number" && match.sides[w]?.competitorId === id;
  return versus ? `${won ? "Won" : "Lost"} against ${versus} today` : "Played today";
}

/**
 * The first visit: who do you follow? A few taps here and every page puts the viewer's own
 * matches first. It asks once per device, can be put aside, and needs no account.
 */
export function Welcome({ board, onDone }: { board: Board; onDone: () => void }) {
  const { atlas, now, times } = board;
  const [game, setGame] = useState<string>();
  const today = times.dayKey(now);

  // Whoever plays today, the live ones first; each team or player once.
  const order = { live: 0, scheduled: 1, finished: 2 } as const;
  const matches = atlas.world.matches
    .filter((m) => m.status === "live" || times.dayKey(m.scheduledAt) === today)
    .sort(
      (a, b) => order[a.status] - order[b.status] || a.scheduledAt.localeCompare(b.scheduledAt),
    );
  const seen = new Set<string>();
  const playing: Pick[] = [];
  for (const match of matches) {
    const tournament = atlas.tournamentOf(match);
    const discipline = atlas.discipline(tournament.discipline);
    // A field of forty boards is not forty cards: only matches of two.
    if (match.sides.length !== 2) continue;
    for (const side of match.sides) {
      const id = side.competitorId;
      const c = id ? atlas.competitor(id) : undefined;
      if (!id || !c || seen.has(id)) continue;
      seen.add(id);
      playing.push({
        follow: { kind: c.kind, id },
        name: plainName(atlas, id),
        line: `${discipline.short} · ${doing(board, match, id)}`,
        mark: <Disc side={sideOf(atlas, id)} size={44} />,
        game: discipline.id,
      });
    }
  }
  const tier = { S: 0, A: 1, B: 2 } as const;
  const events: Pick[] = atlas.world.tournaments
    .filter((t) => tournamentStatus(atlas, t, now) === "live")
    .sort((a, b) => tier[a.tier] - tier[b.tier] || a.start.localeCompare(b.start))
    .map((t) => {
      const first = Date.parse(`${t.start}T00:00:00Z`);
      const last = Date.parse(`${t.end}T00:00:00Z`);
      const days = Math.round((last - first) / DAY) + 1;
      const day = Math.min(days, Math.max(1, Math.floor((now - first) / DAY) + 1));
      return {
        follow: { kind: "tournament", id: t.id } satisfies Follow,
        name: t.name,
        line: `${atlas.discipline(t.discipline).short} · Day ${day} of ${days}`,
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
    });
  const games = atlas.world.disciplines.filter(
    (d) => playing.some((p) => p.game === d.id) || events.some((e) => e.game === d.id),
  );
  const shown = (list: Pick[], most: number) =>
    list.filter((p) => !game || p.game === game).slice(0, most);
  const picked = atlas.world.follows.length;
  const done = () => {
    remember();
    onDone();
  };
  const people = shown(playing, 12);
  const on = shown(events, 8);

  return (
    <>
      <section className="bx-stage">
        <CardSky />
        <div className="bx-ent-in">
          <div className="bx-eh">
            <div>
              <h1>What do you follow?</h1>
              <p>
                Pick a few teams and players. Their matches come first everywhere in Kiming, and
                you need no account.
              </p>
            </div>
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
      </section>
      {people.length ? (
        <>
          <h2 className="bx-h2">
            Playing today <small>tap to follow</small>
          </h2>
          <div className="bx-pks">
            {people.map((p) => (
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
