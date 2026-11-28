import { type Follow, seriesScore, winnerOf } from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Play, Rows3, Star, Zap } from "lucide-react";
import { type ReactNode, useSyncExternalStore } from "react";
import { useAtlas, useFollow } from "../lib/world";
import type { Board } from "./board";
import { Go } from "./links";
import { type MatchView, type SideView, bestOf } from "./model";
import { CardSky, light } from "./sky";
import { until } from "./time";
import { Disc, Ping, Score } from "./ui";

const ROOM = "(min-width: 1100px) and (min-height: 720px)";

/** True when the window has room for the large card: wide enough, and not short. */
export function useRoom(): boolean {
  return useSyncExternalStore(
    (listener) => {
      const query = window.matchMedia(ROOM);
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
    () => window.matchMedia(ROOM).matches,
    () => false,
  );
}

/**
 * How far ahead the first side is, from -1 to 1: the series first, then the game being played.
 * It decides how much of the card's sky each side's colour takes.
 */
export function leadOf(view: MatchView): number {
  const { match, game } = view;
  if (view.solo || view.sides.length !== 2) return 0;
  const series = seriesScore(match);
  const need = Math.max(1, Math.ceil(match.bestOf / 2));
  let lead = ((series[0] ?? 0) - (series[1] ?? 0)) / need;
  const [a, b] = game?.scores ?? [];
  if (a !== undefined && b !== undefined && a + b > 0) {
    // A map to thirteen, a game of goals, a fight in kills: how far apart they are in it.
    const most = view.discipline.id === "cs2" ? 13 : Math.max(a, b, 4);
    lead += ((a - b) / most) * 0.5;
  }
  return Math.max(-1, Math.min(1, lead));
}

/** How far a side's colour reaches and how strong it is, as factors of the card's own measure. */
function lights(view: MatchView): [[number, number], [number, number]] {
  const status = view.match.status;
  if (status === "finished") {
    const w = winnerOf(view.match);
    if (w === 0)
      return [
        [1.15, 1],
        [0.6, 0.16],
      ];
    if (w === 1)
      return [
        [0.6, 0.16],
        [1.15, 1],
      ];
    return [
      [0.8, 0.5],
      [0.8, 0.5],
    ];
  }
  if (status === "live") {
    const lead = leadOf(view);
    return [
      [1 + 0.24 * lead, 0.8 + 0.2 * lead],
      [1 - 0.24 * lead, 0.8 - 0.2 * lead],
    ];
  }
  // Before the start both wait.
  return [
    [0.8, 0.5],
    [0.8, 0.5],
  ];
}

/** The state of a match as a small tag: live, starting within the hour, later, or over. */
export function StateTag({ view, now }: { view: MatchView; now: number }) {
  const { match } = view;
  if (view.live)
    return (
      <span className="bx-tag">
        <Ping />
        Live
      </span>
    );
  if (match.status === "finished")
    return (
      <span className="bx-tag" data-k="done">
        Final
      </span>
    );
  const soon = Date.parse(match.scheduledAt) - now < 60 * 60_000;
  return (
    <span className="bx-tag" data-k={soon ? "soon" : "later"}>
      {view.resumes ? "Continues" : "Starts"} {until(match.scheduledAt, now)}
    </span>
  );
}

function follows(side: SideView, view: MatchView): Follow | undefined {
  if (!side.id) return undefined;
  return { kind: view.discipline.competitor === "team" ? "team" : "player", id: side.id };
}

/** Follow one side of the match, or stop: said in words, since two sides share the card. */
function FollowSide({ follow, name, short }: { follow: Follow; name: string; short?: boolean }) {
  const atlas = useAtlas();
  const [direct, toggle] = useFollow(follow);
  // Followed through something wider, such as the organisation: shown as followed, changed there.
  const inherited = !direct && atlas.followsCompetitor(follow.id);
  const on = direct || inherited;
  const says = inherited
    ? `${name} is followed through its organisation`
    : on
      ? `Stop following ${name}`
      : `Follow ${name}`;
  return (
    <button
      type="button"
      className="bx-btn"
      data-k={short ? "icon" : "quiet"}
      aria-pressed={on}
      aria-label={says}
      title={short || inherited ? says : undefined}
      disabled={inherited}
      onClick={toggle}
    >
      <Star size={short ? 18 : 17} aria-hidden />
      {short ? null : on ? `Following ${name}` : `Follow ${name}`}
    </button>
  );
}

/** The maps or games of the series, as small chips: what is done, what is on, what may come. */
function Chips({ view }: { view: MatchView }) {
  const { match, sides } = view;
  if (view.solo || match.bestOf < 2 || match.games.length < 2) return null;
  // A long match (fourteen games of chess) is not a row of chips.
  if (match.games.length > 5) return null;
  return (
    <div className="bx-chips">
      {match.games.map((g, i) => {
        const score = g.scores && g.status !== "scheduled" ? g.scores.join("–") : undefined;
        const won = typeof g.winner === "number" ? sides[g.winner] : undefined;
        return (
          <span
            key={i}
            data-k={g.status === "live" ? "now" : g.status === "scheduled" ? "open" : undefined}
          >
            {g.status === "live" ? <Ping /> : won ? <i style={{ background: won.color }} /> : null}
            {g.label}
            {score ? <b>{score}</b> : null}
          </span>
        );
      })}
    </div>
  );
}

/** The score, the time of the start, or a word, with what kind it is for the size it is set in. */
function figure(view: MatchView, board: Board): { kind?: "time" | "words"; node: ReactNode } {
  const { match } = view;
  if (match.status === "scheduled" && !view.resumes)
    return { kind: "time", node: board.times.clock(match.scheduledAt) };
  if (view.headline.length === 2)
    return {
      node: (
        <>
          {view.headline[0]}
          <i>:</i>
          {view.headline[1]}
        </>
      ),
    };
  return { kind: "words", node: <Score view={view} times={board.times} /> };
}

/** What stands under the figure: where the game is, when it was, or how long it will be. */
function under(view: MatchView, board: Board): string {
  const { match } = view;
  if (view.live) {
    const where = view.status.replace(/^Live( · )?/, "");
    // A single game of chess leads with its move count: the line under it says the round instead.
    if (view.headline.length === 1 && view.headline[0]?.toLowerCase() === where.toLowerCase())
      return view.subs[1] || view.where;
    const label = view.discipline.id === "cs2" ? view.game?.label : undefined;
    return [label, where].filter(Boolean).join(" · ") || "Live";
  }
  if (match.status === "finished")
    return `${board.times.day(match.scheduledAt, board.now)}, ${board.times.clock(match.scheduledAt)}`;
  const parts = [
    board.times.day(match.scheduledAt, board.now),
    match.bestOf > 1 ? bestOf(match.bestOf) : "",
    match.stream && match.stream.url !== "#" ? match.stream.label : "",
  ];
  return parts.filter(Boolean).join(" · ");
}

/**
 * The match in front: the one card on a page that wears the sky. Large when there is room (a
 * stage), one row when there is not. `why` says why this match leads the page; on the match's
 * own page there is no way in to show, since the viewer is there.
 */
export function Front({
  view,
  board,
  size,
  why,
  mine = false,
  page = false,
}: {
  view: MatchView;
  board: Board;
  size: "stage" | "row";
  /** Why this match is in front: "You follow Vitality". */
  why?: string;
  /** The reason is the viewer's own (something they follow), not the match's standing. */
  mine?: boolean;
  /** This is the match's own page. */
  page?: boolean;
}) {
  const { match, sides } = view;
  const [a, b] = sides;
  const live = view.live;
  const over = match.status === "finished";
  const [la, lb] = lights(view);
  const reach = size === "stage" ? 560 : 360;
  const fig = figure(view, board);
  const line = under(view, board);
  const won = over ? winnerOf(match) : undefined;
  const followed = sides.filter((s) => s.id && board.atlas.followsCompetitor(s.id));
  // Before a start the viewer is waiting for, first light: amber from below.
  const first = !live && !over && followed.length ? 0.9 : 0;
  const stream = match.stream && match.stream.url !== "#" ? match.stream : undefined;
  const open = (children: ReactNode, k: "main" | "quiet") => (
    <Link to="/match/$matchId" params={{ matchId: match.id }} className="bx-btn" data-k={k}>
      {children}
    </Link>
  );
  const watch =
    live && stream ? (
      <a href={stream.url} target="_blank" rel="noreferrer" className="bx-btn" data-k="main">
        <Play size={15} data-fill="" aria-hidden />
        Watch on {stream.label.replace(/^.* on /, "")}
      </a>
    ) : page ? null : (
      open(
        <>
          <Rows3 size={15} aria-hidden />
          {over ? "How it went" : live ? "Follow it live" : "Line-ups and form"}
        </>,
        "main",
      )
    );
  // The side the viewer follows keeps its star in words; with none followed, each side offers one.
  const stars = view.solo
    ? []
    : (followed.length ? followed.slice(0, 1) : sides).flatMap((s) => {
        const f = follows(s, view);
        return f ? [{ follow: f, name: s.name }] : [];
      });
  const way =
    page || !(live && stream)
      ? null
      : open(
          <>
            Line-ups and rounds
            <ArrowRight size={15} aria-hidden />
          </>,
          "quiet",
        );
  const reason = why ? (
    <span className="bx-why">
      {mine ? <Star size={14} aria-hidden /> : <Zap size={14} aria-hidden />}
      {why}
    </span>
  ) : null;
  const sky = <CardSky first={first} live={live} />;
  const team = (side: SideView | undefined, mark: ReactNode) =>
    side?.id ? (
      <Go to={{ kind: view.discipline.competitor === "team" ? "team" : "player", id: side.id }}>
        {mark}
      </Go>
    ) : (
      mark
    );

  if (view.solo || !a || !b) {
    // A field of more than two: the event leads, and who is ahead in it.
    return (
      <section className="bx-stage" data-size="stage" data-live={live ? "" : undefined}>
        {sky}
        <div className="bx-stage-in">
          <div className="bx-hrow">
            <StateTag view={view} now={board.now} />
            <span>
              <b>{view.tournament.name}</b> · {view.where}
            </span>
            {reason ?? <span className="bx-why">{view.discipline.name}</span>}
          </div>
          <div className="bx-duel" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
            <div className="bx-fig" style={{ textAlign: "left" }}>
              <b data-k="words">
                <Score view={view} times={board.times} />
              </b>
              <small>{view.subs.filter(Boolean).join(" · ") || line}</small>
            </div>
          </div>
          <div className="bx-hfoot">{watch}</div>
        </div>
      </section>
    );
  }

  if (size === "row") {
    return (
      <section className="bx-stage" data-size="row" data-live={live ? "" : undefined}>
        {sky}
        <div className="bx-stage-in">
          <div className="bx-cl">
            <StateTag view={view} now={board.now} />
            <span>
              <b>{view.tournament.name}</b>
              <small>{[why, view.where].filter(Boolean).join(" · ")}</small>
            </span>
          </div>
          <div className="bx-cmid">
            <div className="bx-cduel">
              <span data-long={a.label.length > 12 ? "" : undefined}>{a.label}</span>
              {team(
                a,
                <span {...light(a.color, reach * la[0], la[1])}>
                  <Disc side={a} size={44} />
                </span>,
              )}
              <b data-k={fig.kind}>{fig.node}</b>
              {team(
                b,
                <span {...light(b.color, reach * lb[0], lb[1])}>
                  <Disc side={b} size={44} />
                </span>,
              )}
              <span data-long={b.label.length > 12 ? "" : undefined}>{b.label}</span>
            </div>
            <small>{line}</small>
          </div>
          <div className="bx-cr">
            {watch}
            {stars.slice(0, 1).map((s) => (
              <FollowSide key={s.follow.id} follow={s.follow} name={s.name} short />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bx-stage" data-size="stage" data-live={live ? "" : undefined}>
      {sky}
      <div className="bx-stage-in">
        <div className="bx-hrow">
          <StateTag view={view} now={board.now} />
          <span>
            <b>{view.tournament.name}</b> · {view.where}
            {match.bestOf > 1 ? ` · ${bestOf(match.bestOf)}` : ""}
          </span>
          {reason ?? <span className="bx-why">{view.discipline.name}</span>}
        </div>
        <div className="bx-duel">
          {team(
            a,
            <span
              className="bx-tm"
              data-long={a.name.length > 14 ? "" : undefined}
              data-lost={over && won === 1 ? "" : undefined}
            >
              <span {...light(a.color, reach * la[0], la[1])}>
                <Disc side={a} size={68} />
              </span>
              <span>
                <b>{a.name}</b>
                <small>{view.subs[0] || " "}</small>
              </span>
            </span>,
          )}
          <div className="bx-fig">
            <b data-k={fig.kind}>{fig.node}</b>
            <small>{line}</small>
          </div>
          {team(
            b,
            <span
              className="bx-tm"
              data-b=""
              data-long={b.name.length > 14 ? "" : undefined}
              data-lost={over && won === 0 ? "" : undefined}
            >
              <span {...light(b.color, reach * lb[0], lb[1])}>
                <Disc side={b} size={68} />
              </span>
              <span>
                <b>{b.name}</b>
                <small>{view.subs[2] || " "}</small>
              </span>
            </span>,
          )}
        </div>
        <div className="bx-hfoot">
          {watch}
          {stars.map((s) => (
            <FollowSide key={s.follow.id} follow={s.follow} name={s.name} />
          ))}
          {way}
          <Chips view={view} />
        </div>
      </div>
    </section>
  );
}
