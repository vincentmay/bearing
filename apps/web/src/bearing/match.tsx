import "./pages-match.css";
import { type GameResult, type Provenance, form, playerTotals, winnerOf } from "@bearing/domain";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronRight, Flag, Play, Trophy } from "lucide-react";
import { useHistory, useMeetings } from "../lib/meetings";
import { type Board, useBoard } from "./board";
import { ChessStage } from "./chess/stage";
import { Front, useRoom } from "./front";
import { Back, Go } from "./links";
import { lineupOf } from "./team";
import { CupPlaces, CupStandings, GameRow } from "./forms";
import { type Dot, type MatchView, type SideView, bestOf, placeOf, sideOf } from "./model";
import type { Times } from "./time";
import { Disc, Dots, Problem, Waiting } from "./ui";

/**
 * Where a fact comes from and when it was last checked, for every match and event: one quiet
 * line. It speaks up only when a match still open has not been confirmed for hours.
 */
export function Source({
  provenance,
  now,
  times,
  also,
  pending,
}: {
  provenance: Provenance;
  now: number;
  times: Times;
  /** Further sources that added to what the first one gave, each led by its comma. */
  also?: ReactNode;
  /** Still to be played or being played: what is shown can go out of date. */
  pending?: boolean;
}) {
  if (provenance.source === "Bearing sample data") {
    return <p className="bx-src">Sample data</p>;
  }
  const link = provenance.note?.startsWith("http") ? provenance.note : undefined;
  // The sources are asked every hour. Three hours without an answer is worth saying.
  const hours = Math.floor((now - Date.parse(provenance.checkedAt)) / 3_600_000);
  const day = times.day(provenance.checkedAt, now);
  return (
    <p className="bx-src">
      {pending && hours >= 3 ? (
        <b>
          Not confirmed for {hours < 48 ? `${hours} hours` : `${Math.floor(hours / 24)} days`}.{" "}
        </b>
      ) : null}
      {link ? (
        <a href={link} target="_blank" rel="noreferrer">
          {provenance.source}
        </a>
      ) : (
        provenance.source
      )}
      {also} · {day === "Today" ? "" : `${day} `}
      {times.clock(provenance.checkedAt)}
    </p>
  );
}

/** A block of the page: the small line over it, and its panel. */
function Block({
  cap,
  aside,
  children,
}: {
  cap: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="bx-cap">
        <span className="bx-mp-cap">{cap}</span>
        {aside ? <span>{aside}</span> : null}
      </div>
      <div className="bx-panel">{children}</div>
    </section>
  );
}

/** A side's colour as a small dot, beside its name over a panel. */
function Mark({ side }: { side: SideView }) {
  return <i className="bx-mp-dot" style={{ background: side.color }} aria-hidden />;
}

/** The game being played leads; finished ones follow, newest first; the rest wait at the end. */
function ordered(games: GameResult[]) {
  const rank = (g: GameResult) => (g.status === "live" ? 0 : g.status === "finished" ? 1 : 2);
  return games
    .map((game, index) => ({ game, index }))
    .sort(
      (x, y) =>
        rank(x.game) - rank(y.game) ||
        (x.game.status === "finished" ? y.index - x.index : x.index - y.index),
    );
}

/** Before the start: how each side has done lately. */
function Form({ view, board }: { view: MatchView; board: Board }) {
  const known = view.sides.filter((s): s is SideView & { id: string } => !!s.id);
  if (!known.length) return null;
  return (
    <Block cap="Form" aside="last five">
      {known.map((side) => (
        <FormRow key={side.id} side={side} board={board} />
      ))}
    </Block>
  );
}

/** The page of a side: a team's, or a player's for those who play alone. */
function target(board: Board, id: string) {
  return { kind: board.atlas.competitor(id)?.kind ?? "discipline", id } as const;
}

/**
 * One side's last five, the latest at the right. For a team the count reaches back past the
 * weeks Bearing keeps as matches, to its earlier series, where those have been looked up.
 */
function FormRow({ side, board }: { side: SideView & { id: string }; board: Board }) {
  const past = useHistory(side.id);
  const own = form(board.atlas, side.id);
  // The history has the same series the store has, and the ones before them.
  const earlier = past
    .filter((p) => !board.atlas.match(p.id) && p.won !== undefined)
    .slice(0, Math.max(0, 5 - own.length))
    .map((p): "W" | "L" => (p.won ? "W" : "L"));
  const results = [...own, ...earlier].reverse();
  const dots: Dot[] = results.map((r) =>
    r === "W"
      ? { k: "won", side: 0, label: "Won" }
      : r === "D"
        ? { k: "shared", label: "Draw" }
        : { k: "open" },
  );
  return (
    <Go to={target(board, side.id)} className="bx-mp-li">
      <Disc side={side} size={30} />
      <span className="bx-mp-t">
        <b>{side.name}</b>
        <small>
          {results.length > 1
            ? `Won ${results.filter((r) => r === "W").length} of the last ${results.length}`
            : results.length
              ? `${results[0] === "W" ? "Won" : results[0] === "D" ? "Drew" : "Lost"} the one match on record`
              : "No results on record"}
        </small>
      </span>
      <Dots dots={dots} sides={[side, { ...side, color: "var(--surface)" }]} size={11} fix />
    </Go>
  );
}

/** Who is playing for each side, with their line across the series where the data has one. */
function lineups(view: MatchView, board: Board): ReactNode {
  if (view.discipline.competitor !== "team") return null;
  const lol = view.discipline.id === "lol";
  const blocks = view.sides.flatMap((side) => {
    if (!side.id) return [];
    // In the order of their positions, those who wait behind the five after them.
    const { playing, bench } = lineupOf(
      board.atlas.roster(side.id),
      board.atlas.matchesFor(side.id),
    );
    const waiting = new Set(bench.map((r) => r.player.id));
    const roster = [...playing, ...bench];
    if (!roster.length) return [];
    const lines = roster.map((r) => ({
      ...r,
      totals: playerTotals([view.match], r.player.id),
    }));
    const any = lines.some((l) => l.totals);
    return [
      <Block
        key={side.id}
        cap={
          <>
            <Mark side={side} />
            {side.name}
          </>
        }
        aside={any ? (lol ? "K–D–A" : "K–D · Rating") : undefined}
      >
        {lines.map(({ player, stint, totals }) => (
          <Go key={player.id} to={{ kind: "player", id: player.id }} className="bx-mp-li bx-mp-pl">
            <Disc side={sideOf(board.atlas, player.id)} size={30} />
            <span className="bx-mp-t">
              <b>{player.handle}</b>
              <small>
                {[stint.role, waiting.has(player.id) ? "substitute" : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </span>
            {totals ? (
              <em>
                {totals.kills}–{totals.deaths}
                {lol ? `–${totals.assists}` : ""}
              </em>
            ) : (
              <em />
            )}
            {totals?.rating !== undefined && !lol ? (
              <em className="bx-mp-rt">{totals.rating.toFixed(2)}</em>
            ) : (
              <em />
            )}
          </Go>
        ))}
      </Block>,
    ];
  });
  if (!blocks.length) return null;
  return <div className="bx-mp-lu">{blocks}</div>;
}

/**
 * How the two sides have done against each other before: the count of who won, and their
 * latest meetings. For teams it reaches back years; for players, as far as Bearing's own
 * matches do.
 */
function Meetings({ view, board }: { view: MatchView; board: Board }) {
  const [a, b] = view.sides;
  const list = useMeetings(board.atlas, a?.id ?? null, b?.id ?? null, view.match.id);
  if (view.sides.length !== 2 || !a || !b || !list.length) return null;
  const wins = [0, 1].map((i) => list.filter((m) => m.winner === i).length) as [number, number];
  const draws = list.length - wins[0] - wins[1];
  const year = String(new Date(board.now).getFullYear());
  const when = (at: string) =>
    at.startsWith(year) ? board.times.date(at) : `${board.times.date(at)} ${at.slice(0, 4)}`;
  const since = list.at(-1)!.at.slice(0, 4);
  // Two sides drawn in the same ink are told apart by the second one stepping back.
  const second = b.color === a.color || b.color.includes("--surface") ? "var(--ink3)" : b.color;
  return (
    <Block
      cap="Head to head"
      aside={`${list.length} ${list.length === 1 ? "meeting" : "meetings"}${
        since === year ? "" : ` since ${since}`
      }`}
    >
      <div className="bx-mp-h2h">
        <b>{wins[0]}</b>
        <span aria-hidden>
          <i style={{ flexGrow: wins[0], background: a.color }} />
          <i style={{ flexGrow: draws, background: "var(--sunk)" }} />
          <i style={{ flexGrow: wins[1], background: second }} />
        </span>
        <b>{wins[1]}</b>
      </div>
      {list.slice(0, 6).map((m) => {
        const w = m.winner === 1 ? 1 : 0;
        const [first, other] = w === 1 ? [b, a] : [a, b];
        const body = (
          <>
            {m.winner === undefined ? (
              <span className="bx-mp-even" aria-hidden>
                ½
              </span>
            ) : (
              <Disc side={first} size={30} />
            )}
            <span className="bx-mp-t">
              <b>
                {first.name} {m.score[w]}–{m.score[1 - w]} {other.name}
              </b>
              <small>{m.event || "Meeting"}</small>
            </span>
            <em>{when(m.at)}</em>
          </>
        );
        return m.matchId ? (
          <Link
            key={m.at}
            to="/match/$matchId"
            params={{ matchId: m.matchId }}
            className="bx-mp-li"
          >
            {body}
          </Link>
        ) : (
          <div key={m.at} className="bx-mp-li">
            {body}
          </div>
        );
      })}
    </Block>
  );
}

/**
 * Where the match sits in its event: in a sentence, then the event itself, the match the winner
 * goes on to, and where to watch.
 */
function InEvent({ view, board }: { view: MatchView; board: Board }) {
  const { atlas, now, times } = board;
  const { match } = view;
  const ahead = match.next?.winner ? atlas.match(match.next.winner) : undefined;
  const over = match.status === "finished";
  const won = over ? winnerOf(match) : undefined;
  const through = typeof won === "number" ? view.sides[won] : undefined;
  const stream = match.stream && match.stream.url !== "#" ? match.stream : undefined;
  return (
    <Block cap="In the event">
      <p className="bx-mp-note">{placeOf(atlas, view, now, times)}</p>
      <Go to={{ kind: "tournament", id: view.tournament.id }} className="bx-mp-li">
        <span className="bx-mp-ic">
          <Trophy size={16} aria-hidden />
        </span>
        <span className="bx-mp-t">
          <b>{view.tournament.name}</b>
          <small>
            {view.discipline.name} · {view.where}
          </small>
        </span>
        <ChevronRight size={18} className="bx-mp-go" aria-hidden />
      </Go>
      {ahead ? (
        <Link to="/match/$matchId" params={{ matchId: ahead.id }} className="bx-mp-li">
          <span className="bx-mp-ic">
            <Flag size={16} aria-hidden />
          </span>
          <span className="bx-mp-t">
            <b>{atlas.roundOf(ahead)?.name ?? "Next"}</b>
            <small>
              {through
                ? `${through.name} went on`
                : `Next · ${times.day(ahead.scheduledAt, now)}, ${times.clock(ahead.scheduledAt)}`}
            </small>
          </span>
          <ChevronRight size={18} className="bx-mp-go" aria-hidden />
        </Link>
      ) : null}
      {/* While the match is live the top card has the way to watch it. */}
      {stream && !view.live ? (
        <a href={stream.url} target="_blank" rel="noreferrer" className="bx-mp-li">
          <span className="bx-mp-ic" data-k="watch">
            <Play size={14} strokeWidth={2.6} aria-hidden />
          </span>
          <span className="bx-mp-t">
            <b>{over ? "Watch it again" : "Watch"}</b>
            <small>{stream.label}</small>
          </span>
          <ArrowUpRight size={17} className="bx-mp-go" aria-hidden />
        </a>
      ) : null}
    </Block>
  );
}

export function MatchPage({ matchId }: { matchId: string }) {
  const board = useBoard(undefined, { match: matchId });
  const room = useRoom();
  const { atlas, now, times } = board;
  const match = atlas.match(matchId);
  const back = <Back parent={match ? { kind: "tournament", id: match.tournamentId } : undefined} />;
  if (!match) {
    // A match from before the weeks a list reaches back arrives a moment after the page.
    if (board.loading) return <Waiting inner at="match" />;
    return (
      <>
        {back}
        <Problem title="This match could not be found.">
          It may have been removed, or the link is wrong.
        </Problem>
      </>
    );
  }
  const view = board.view(match);
  const scheduled = match.status === "scheduled";
  const games = ordered(match.games);
  const started = games.some((o) => o.game.status !== "scheduled");
  // Only who won each game is known, of none of them what happened in it.
  const bare =
    !view.solo &&
    started &&
    match.status === "finished" &&
    !board.loading &&
    match.games.every(
      (g) => !g.rounds && !g.events && !g.scores && !g.chess && !g.cup && !g.lines && !g.moves,
    );
  // Chess has its board under the top card, across the page's whole width.
  const chess = view.discipline.id === "chess" && !view.solo && started && !bare;
  // Round by round for a driver the viewer follows, or failing that for whoever leads.
  const followed = view.sides.findIndex((s) => atlas.world.follows.some((f) => f.id === s.id));
  const featured = followed >= 0 ? followed : (view.standings[0]?.index ?? 0);
  const unit = view.discipline.unit.many;

  // On the left how the match went and who plays it; on the right what surrounds it.
  const left: ReactNode[] = [];
  if (view.solo && started) {
    left.push(
      <Block key="standings" cap="Standings">
        <CupStandings view={view} />
      </Block>,
      <Block
        key="places"
        cap={followed >= 0 ? "The driver you follow" : "The leader, round by round"}
      >
        <CupPlaces view={view} index={featured} />
      </Block>,
    );
  }
  if (started && !chess && (!view.solo || match.games.length > 1)) {
    left.push(
      <Block
        key="games"
        cap={unit.charAt(0).toUpperCase() + unit.slice(1)}
        aside={match.bestOf > 1 ? bestOf(match.bestOf) : undefined}
      >
        {games.map(({ game, index }) => (
          <GameRow key={index} game={game} index={index} view={view} />
        ))}
      </Block>,
    );
  }
  const people = lineups(view, board);
  if (people) left.push(<div key="lineups">{people}</div>);

  const event = <InEvent key="event" view={view} board={board} />;
  const around = [
    <Meetings key="meetings" view={view} board={board} />,
    scheduled || bare ? <Form key="form" view={view} board={board} /> : null,
  ];
  // With nothing of its own to show on the left (chess, under its board), the event takes it.
  const [one, two] = left.length ? [left, [event, ...around]] : [[event], around];

  return (
    <>
      {back}
      <Front view={view} board={board} size={room ? "stage" : "row"} page />
      {chess ? (
        <div className="bx-mp-chess">
          <ChessStage view={view} match={match} board={board} />
        </div>
      ) : null}
      <div className="bx-cols2 bx-mp-cols">
        <div>{one}</div>
        <div>{two}</div>
      </div>
      <Source
        provenance={view.tournament.provenance}
        now={now}
        times={times}
        pending={match.status !== "finished"}
        also={
          view.discipline.id === "lol" ? (
            <>
              {match.games.some((g) => g.events) ? ", lolesports.com" : ""}
              {match.games.some((g) => g.draft) ? (
                <>
                  ,{" "}
                  <a href="https://lol.fandom.com" target="_blank" rel="noreferrer">
                    Leaguepedia
                  </a>{" "}
                  (CC BY-SA 3.0)
                </>
              ) : null}
            </>
          ) : undefined
        }
      />
    </>
  );
}
