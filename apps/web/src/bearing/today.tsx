import type { Atlas, Match } from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Play, Star } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type Listed,
  type Upcoming,
  bundle,
  elsewhere,
  leadMatch,
  recentForYou,
  scoreLine,
  upcomingForYou,
} from "../lib/view";
import { type Board, useBoard, useWide } from "./board";
import { Front, useRoom } from "./front";
import { plainName } from "./model";
import { ListedRow, MatchRow } from "./rows";
import { Moment } from "./sky";
import { until } from "./time";
import { Disc, Ping, Tick } from "./ui";
import { Welcome, welcomed } from "./welcome";

/** How many other live matches stand as cards before the page points to the schedule. */
const CARDS = 4;

/** "If Vitality beat Aurora": a match that only happens for the viewer if something else goes their way. */
function condition(atlas: Atlas, item: Upcoming): string | undefined {
  const c = item.conditional;
  if (!c) return undefined;
  const who = plainName(atlas, c.competitorId);
  const team = atlas.competitor(c.competitorId)?.kind === "team";
  if (c.via.sides.length > 2) return `If ${who} ${team ? "go" : "goes"} through`;
  const other = c.via.sides.find((s) => s.competitorId !== c.competitorId);
  return `If ${who} ${team ? "beat" : "beats"} ${plainName(atlas, other?.competitorId)}`;
}

/**
 * Followed results first, topped up with the latest others. The others are spread over events:
 * one round of a chess open ends forty games at once, and they would otherwise be the whole list.
 */
function earlier(atlas: Atlas, limit: number, skip?: string): Match[] {
  const mine = recentForYou(atlas, limit).filter((m) => m.id !== skip);
  const rest = atlas.recent().filter((m) => !mine.includes(m) && m.id !== skip);
  const taken = new Map<string, number>();
  const spread: Match[] = [];
  const left: Match[] = [];
  for (const m of rest) {
    const t = atlas.tournamentOf(m);
    const most = atlas.discipline(t.discipline).competitor === "team" ? 2 : 1;
    const n = taken.get(t.id) ?? 0;
    if (n < most) {
      taken.set(t.id, n + 1);
      spread.push(m);
    } else left.push(m);
  }
  return [...mine, ...spread, ...left].slice(0, limit);
}

/**
 * The match that leads the page. When it ends it stays a moment, saying so, before the next one
 * takes its place.
 */
function useLead(atlas: Atlas, pick: Match | undefined): Match | undefined {
  const [shown, setShown] = useState(pick?.id);
  const held = shown ? atlas.match(shown) : undefined;
  const ended = held?.status === "finished";
  useEffect(() => {
    if (pick?.id === shown) return;
    const timer = setTimeout(() => setShown(pick?.id), ended ? 3600 : 0);
    return () => clearTimeout(timer);
  }, [pick?.id, shown, ended]);
  return held ?? pick;
}

/** Why a match is in front, in a few words, and whether the reason is the viewer's own. */
function reason(atlas: Atlas, match: Match, picked: boolean): { why?: string; mine: boolean } {
  const followed = match.sides
    .map((s) => s.competitorId)
    .find((id) => id && atlas.followsCompetitor(id));
  const mine = atlas.isFollowed(match);
  if (picked) return { mine };
  if (match.status === "live") {
    if (followed) return { why: `You follow ${plainName(atlas, followed)}`, mine: true };
    if (mine) return { why: "From what you follow", mine: true };
    return { why: "Biggest match live right now", mine: false };
  }
  if (mine) return { why: "Your next match", mine: true };
  return { why: "Next big match", mine: false };
}

/** Another live match, as a card: a tap brings it to the front. */
function LiveCard({
  item,
  board,
  onPick,
}: {
  item: Listed;
  board: Board;
  onPick: (id: string) => void;
}) {
  const { atlas } = board;
  if (item.kind === "round") {
    // A whole round being played (forty boards of a chess open) is one card, and leads to its event.
    const first = item.matches[0]!;
    const tournament = atlas.tournamentOf(first);
    const live = item.matches.filter((m) => m.status === "live").length;
    return (
      <Link
        to="/tournament/$tournamentId"
        params={{ tournamentId: tournament.id }}
        className="bx-ch"
      >
        <div className="bx-ch-k">
          <span>
            <Ping />
            {atlas.discipline(tournament.discipline).short}
          </span>
          <span>{tournament.short}</span>
          {item.matches.some((m) => atlas.isFollowed(m)) ? (
            <Star size={16} className="bx-starred" aria-label="You follow this" />
          ) : null}
        </div>
        <div>
          <div className="bx-ln">
            <span />
            <span>{tournament.name}</span>
          </div>
          <div className="bx-ln" data-quiet="">
            <span />
            <span>
              {live} {live === 1 ? "game" : "games"} being played
            </span>
          </div>
        </div>
        <div className="bx-ch-f">
          <span>{atlas.roundOf(first)?.name ?? atlas.stageOf(first).name}</span>
        </div>
      </Link>
    );
  }
  const view = board.view(item.match);
  const { match } = view;
  const [a, b] = view.sides;
  const where = view.status.replace(/^Live(?: · )?/, "");
  const game = view.discipline.id === "cs2" ? view.game?.label : undefined;
  const foot = view.solo
    ? view.sides
        .filter((s) => s.id)
        .slice(0, 4)
        .map((s) => s.name)
        .join(", ")
    : [game, where].filter(Boolean).join(", ") || view.where;
  // In a series the card counts games won; the game being played is said in the line below.
  const marks = view.solo
    ? []
    : match.bestOf > 1
      ? scoreLine(match).split("–")
      : view.headline.length === 2
        ? view.headline
        : [];
  return (
    <button type="button" className="bx-ch" onClick={() => onPick(match.id)}>
      <div className="bx-ch-k">
        <span>
          <Ping />
          {view.discipline.short}
        </span>
        <span>{view.event}</span>
        {atlas.isFollowed(match) ? (
          <Star size={16} className="bx-starred" aria-label="You follow this" />
        ) : null}
      </div>
      {view.solo || !a || !b ? (
        <div>
          <div className="bx-ln">
            <span />
            <span>{view.where}</span>
          </div>
          <div className="bx-ln" data-quiet="">
            <span />
            <span>{view.standings[0] ? `${view.standings[0].side.name} leads` : ""}</span>
          </div>
        </div>
      ) : (
        <div>
          {[a, b].map((side, i) => (
            <div className="bx-ln" key={side.id ?? i}>
              <Disc side={side} size={26} />
              <span>{side.name}</span>
              {marks[i] !== undefined ? (
                <b>
                  <Tick>{marks[i] ?? ""}</Tick>
                </b>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <div className="bx-ch-f">
        <span>{foot}</span>
        {match.stream && match.stream.url !== "#" ? (
          <span className="bx-go" aria-hidden>
            <Play size={13} />
          </span>
        ) : null}
      </div>
    </button>
  );
}

/** The viewer's next match, counted down: Sunrise's card among the live ones. */
function NextCard({ item, board }: { item: Upcoming; board: Board }) {
  const view = board.view(item.match);
  const { match } = view;
  const [a, b] = view.sides;
  return (
    <Link to="/match/$matchId" params={{ matchId: match.id }} className="bx-ch" data-k="soon">
      <div className="bx-ch-k">
        <span>Next for you</span>
        <span>{view.event}</span>
      </div>
      {view.solo || !a || !b ? (
        <div>
          <div className="bx-ln">
            <span />
            <span>{view.where}</span>
          </div>
          <div className="bx-ln" data-quiet="">
            <span />
            <span>
              {view.sides
                .filter((s) => s.id)
                .slice(0, 4)
                .map((s) => s.name)
                .join(", ")}
            </span>
          </div>
        </div>
      ) : (
        <div>
          {[a, b].map((side, i) => (
            <div className="bx-ln" key={side.id ?? i}>
              <Disc side={side} size={26} />
              <span>{side.name}</span>
            </div>
          ))}
        </div>
      )}
      <div className="bx-ch-f">
        <b>{until(match.scheduledAt, board.now).replace(/^in /, "")}</b>
        <span>{board.times.clock(match.scheduledAt)}</span>
      </div>
    </Link>
  );
}

export function Today() {
  const board = useBoard();
  const { atlas, now, times } = board;
  const wide = useWide();
  const room = useRoom();
  const following = atlas.world.follows.length > 0;
  // The first visit asks who the viewer follows, once, and stays until they are done picking.
  const [asking, setAsking] = useState(() => !following && !welcomed());

  const mine = upcomingForYou(atlas);
  const open = atlas.upcoming().filter((m) => m.sides.every((s) => s.competitorId));
  // A live match the viewer tapped stands in front for as long as it is live.
  const [picked, setPicked] = useState<string>();
  const chosen = picked ? atlas.match(picked) : undefined;
  const auto = useLead(atlas, leadMatch(atlas, mine));
  const lead = chosen?.status === "live" ? chosen : auto;
  const alsoLive = atlas
    .live()
    .filter((m) => m.id !== lead?.id)
    .sort((x, y) => Number(atlas.isFollowed(y)) - Number(atlas.isFollowed(x)));
  const live = bundle(atlas, alsoLive);
  const next: Upcoming[] = (mine.length ? mine : open.map((match) => ({ match })))
    .filter((u) => u.match.id !== lead?.id)
    .slice(0, 6);
  // The viewer's very next match gets its own card beside the live ones, if it is today.
  const soonest = mine.find(
    (u) =>
      !u.conditional &&
      u.match.id !== lead?.id &&
      Date.parse(u.match.scheduledAt) - now < 12 * 60 * 60_000,
  );
  const cards = live.slice(0, soonest ? CARDS - 1 : CARDS);
  // With little of the viewer's own coming up, the page also says what else is on its way.
  const others =
    mine.length && next.length < 4
      ? bundle(
          atlas,
          elsewhere(atlas, new Set([lead?.id ?? "", ...next.map((u) => u.match.id)]), 5),
        ).slice(0, 5)
      : [];
  const results = earlier(atlas, wide ? 6 : 5, lead?.id);
  const tonight = next.every((u) => times.dayKey(u.match.scheduledAt) === times.dayKey(now));
  const { why, mine: own } = lead
    ? reason(atlas, lead, lead.id === picked)
    : { why: undefined, mine: false };

  if (asking) return <Welcome board={board} onDone={() => setAsking(false)} />;

  return (
    <>
      <h1 className="bx-only">Live</h1>
      {lead ? (
        <Front
          key={lead.id}
          view={board.view(lead)}
          board={board}
          size={room ? "stage" : "row"}
          why={why}
          mine={own}
        />
      ) : (
        <Moment
          title="Clear horizon."
          action={
            <Link to="/schedule" className="bx-ghost">
              See the schedule
            </Link>
          }
        >
          Nothing is live and nothing is scheduled.
        </Moment>
      )}

      {following ? null : (
        <p className="bx-quiet">
          You are not following anything yet, so this is the biggest of what is on. Follow a team, a
          player or an event to make this page yours.
        </p>
      )}

      {cards.length || soonest ? (
        <>
          <h2 className="bx-h2">
            {cards.length ? (lead?.status === "live" ? "Also live" : "Live now") : "Next for you"}
            {cards.some((c) => c.kind === "match") ? (
              <small>tap one to bring it to the front</small>
            ) : null}
            {live.length > cards.length ? (
              <Link to="/schedule">
                All {live.length + (lead?.status === "live" ? 1 : 0)} live
                <ChevronRight size={15} aria-hidden />
              </Link>
            ) : null}
          </h2>
          <div className="bx-chan">
            {cards.map((item) => (
              <LiveCard
                key={item.kind === "match" ? item.match.id : item.key}
                item={item}
                board={board}
                onPick={(id) => {
                  setPicked(id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            ))}
            {soonest ? <NextCard item={soonest} board={board} /> : null}
          </div>
        </>
      ) : lead ? (
        <p className="bx-quiet">Nothing else is live right now.</p>
      ) : null}

      <div className="bx-two">
        <div>
          <h2 className="bx-h2">{tonight && next.length ? "Today" : "Coming up"}</h2>
          <div className="bx-rows">
            {next.map((u) => (
              <MatchRow
                key={`${u.match.id}${u.conditional?.competitorId ?? ""}`}
                match={u.match}
                board={board}
                day
                note={condition(atlas, u)}
              />
            ))}
            {others.map((item) => (
              <ListedRow
                key={item.kind === "match" ? item.match.id : item.key}
                item={item}
                board={board}
              />
            ))}
            {next.length || others.length ? null : (
              <p className="bx-quiet" style={{ margin: "4px" }}>
                {following
                  ? "Nothing more is scheduled for what you follow."
                  : "Nothing is scheduled."}
              </p>
            )}
          </div>
        </div>
        <div>
          <h2 className="bx-h2">Results</h2>
          <div className="bx-rows">
            {results.map((m) => (
              <MatchRow key={m.id} match={m} board={board} day />
            ))}
            {results.length ? null : (
              <p className="bx-quiet" style={{ margin: "4px" }}>
                No results yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
