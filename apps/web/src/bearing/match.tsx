import { type GameResult, type Provenance, form, playerTotals } from "@bearing/domain";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Play } from "lucide-react";
import { useHistory, useMeetings } from "../lib/meetings";
import { type Board, useBoard, useWide } from "./board";
import { ChessStage } from "./chess/stage";
import { Back, Go } from "./links";
import { lineupOf } from "./team";
import { CupPlaces, CupStandings, GameRow, Stops } from "./forms";
import { type Dot, type MatchView, type SideView, placeOf, sideOf, stopsOf } from "./model";
import { type Times, until } from "./time";
import { Disc, Dots, Ping, Problem, Score, Section, Waiting } from "./ui";

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
    return <p className="bx-source">Sample data</p>;
  }
  const link = provenance.note?.startsWith("http") ? provenance.note : undefined;
  // The sources are asked every hour. Three hours without an answer is worth saying.
  const hours = Math.floor((now - Date.parse(provenance.checkedAt)) / 3_600_000);
  const day = times.day(provenance.checkedAt, now);
  return (
    <p className="bx-source">
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

/** The page of a side: a team's, or a player's for those who play alone. */
function target(board: Board, id: string | null) {
  return { kind: board.atlas.competitor(id)?.kind ?? "discipline", id: id ?? "" } as const;
}

function Name({ text, long = false }: { text: string; long?: boolean }) {
  return (
    <b className="bx-name" data-long={long ? "" : undefined}>
      {text}
    </b>
  );
}

/** The heading lies on the page: who, the score set large, the status in words. */
function Heading({ view, board, wide }: { view: MatchView; board: Board; wide: boolean }) {
  const [a, b] = view.sides;
  const { match } = view;
  const scheduled = match.status === "scheduled";
  // A match of chess is written out game by game right under the heading.
  const written = view.discipline.id === "chess" && match.games.length > 1;
  const state = (
    <div className="bx-state">
      {view.live ? <Ping /> : null}
      <span>
        {view.resumes
          ? view.status
          : scheduled
            ? `${until(match.scheduledAt, board.now)} · ${board.times.day(match.scheduledAt, board.now)}`
            : view.headline.length === 1
              ? view.status.replace(/ · move \d+$/, "")
              : view.status}
        {view.subs[1] && !view.solo && !scheduled ? ` · ${view.subs[1]}` : ""}
      </span>
    </div>
  );

  if (view.solo || !a || !b) {
    return (
      <div className="bx-hero">
        <div className="bx-matchhead">
          <span>
            <span>
              <Name text={view.tournament.name} />
              <span className="bx-sub">
                {view.discipline.name} · {view.where}
              </span>
            </span>
          </span>
        </div>
        <p className="bx-big bx-solo">
          <Score view={view} times={board.times} />
        </p>
        {state}
        {wide ? <Stops view={view} stops={stopsOf(board.atlas, view, board.times)} /> : null}
      </div>
    );
  }

  const worded = view.headline.length === 1 && !scheduled;
  const big = worded ? "bx-big bx-solo" : "bx-big bx-num";
  // Both names are set at the same size, the smaller one if either is long. A score in words
  // ("Move 27") takes more of the middle than one in figures.
  const long = Math.max(a.name.length, b.name.length) > (wide ? (worded ? 12 : 16) : 11);
  if (wide) {
    return (
      <div className="bx-hero">
        <div className="bx-versus" style={{ marginTop: 26 }}>
          <Go to={target(board, a.id)} className="bx-press">
            <Disc side={a} />
            <span style={{ minWidth: 0 }}>
              <Name text={a.name} long={long} />
              <span className="bx-sub" style={{ display: "block", marginTop: 4 }}>
                {view.subs[0]}
              </span>
            </span>
          </Go>
          <span className="bx-score bx-num">
            <Score view={view} times={board.times} />
          </span>
          <Go to={target(board, b.id)} className="bx-press" style={{ textAlign: "right" }}>
            <span style={{ minWidth: 0 }}>
              <Name text={b.name} long={long} />
              <span className="bx-sub" style={{ display: "block", marginTop: 4 }}>
                {view.subs[2]}
              </span>
            </span>
            <Disc side={b} />
          </Go>
        </div>
        {state}
        {written ? null : <Stops view={view} stops={stopsOf(board.atlas, view, board.times)} />}
      </div>
    );
  }
  return (
    <div className="bx-hero">
      <div className="bx-matchhead">
        <Go to={target(board, a.id)} className="bx-press">
          <Disc side={a} size={38} />
          <span style={{ minWidth: 0 }}>
            <Name text={a.name} long={long} />
            <span className="bx-sub">{view.subs[0]}</span>
          </span>
        </Go>
        <Go to={target(board, b.id)} className="bx-press">
          <span style={{ minWidth: 0 }}>
            <Name text={b.name} long={long} />
            <span className="bx-sub">{view.subs[2]}</span>
          </span>
          <Disc side={b} size={38} />
        </Go>
      </div>
      <p className={big}>
        <Score view={view} times={board.times} />
      </p>
      {state}
    </div>
  );
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
    <Section label="Last five">
      <div className="bx-list">
        {known.map((side) => (
          <FormRow key={side.id} side={side} board={board} />
        ))}
      </div>
    </Section>
  );
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
    <Go to={target(board, side.id)} className="bx-result">
      <span className="bx-row" style={{ gap: 10 }}>
        <Disc side={side} size={26} />
        <span style={{ minWidth: 0 }}>
          <b>{side.name}</b>
          <span className="bx-sub">
            {results.length > 1
              ? `Won ${results.filter((r) => r === "W").length} of the last ${results.length}`
              : results.length
                ? `${results[0] === "W" ? "Won" : results[0] === "D" ? "Drew" : "Lost"} the one match on record`
                : "No results on record"}
          </span>
        </span>
      </span>
      <Dots dots={dots} sides={[side, { ...side, color: "var(--surface)" }]} size={11} fix />
    </Go>
  );
}

/** Who is playing for each side, with their line across the series where the data has one. */
function Lineups({ view, board }: { view: MatchView; board: Board }) {
  if (view.discipline.competitor !== "team") return null;
  const lol = view.discipline.id === "lol";
  return (
    <>
      {view.sides.map((side) => {
        if (!side.id) return null;
        // In the order of their positions, those who wait behind the five after them.
        const { playing, bench } = lineupOf(
          board.atlas.roster(side.id),
          board.atlas.matchesFor(side.id),
        );
        const waiting = new Set(bench.map((r) => r.player.id));
        const roster = [...playing, ...bench];
        if (!roster.length) return null;
        const lines = roster.map((r) => ({
          ...r,
          totals: playerTotals([view.match], r.player.id),
        }));
        const any = lines.some((l) => l.totals);
        return (
          <Section
            key={side.id}
            label={any ? `${side.name} · kills–deaths${lol ? "–assists" : " · rating"}` : side.name}
          >
            <div className="bx-list">
              {lines.map(({ player, stint, totals }) => (
                <Go key={player.id} to={{ kind: "player", id: player.id }} className="bx-line">
                  <span className="bx-who">
                    <Disc side={sideOf(board.atlas, player.id)} size={30} />
                    <span>
                      <b>{player.handle}</b>
                      <span className="bx-sub">
                        {[stint.role, waiting.has(player.id) ? "substitute" : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </span>
                  {totals ? (
                    <span>
                      {totals.kills}–{totals.deaths}
                      {lol ? `–${totals.assists}` : ""}
                    </span>
                  ) : (
                    <span />
                  )}
                  {totals?.rating !== undefined && !lol ? (
                    <span>{totals.rating.toFixed(2)}</span>
                  ) : (
                    <span style={{ minWidth: 0 }} />
                  )}
                </Go>
              ))}
            </div>
          </Section>
        );
      })}
    </>
  );
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
  return (
    <Section
      label={`Head to head · ${list.length} ${list.length === 1 ? "meeting" : "meetings"}${
        since === year ? "" : ` since ${since}`
      }`}
    >
      <div className="bx-list">
        <div className="bx-h2h">
          <Disc side={a} size={26} />
          <b className="bx-num">{wins[0]}</b>
          <span className="bx-h2h-bar" aria-hidden>
            <i style={{ flexGrow: wins[0], background: a.color }} />
            <i style={{ flexGrow: draws, background: "var(--rest)" }} />
            <i
              style={{
                flexGrow: wins[1],
                // Two sides drawn in the same ink are told apart by the second one stepping back.
                background:
                  b.color === a.color || b.color.includes("--surface") ? "var(--ink2)" : b.color,
              }}
            />
          </span>
          <b className="bx-num">{wins[1]}</b>
          <Disc side={b} size={26} />
        </div>
        {list.slice(0, 6).map((m) => {
          const body = (
            <>
              <span style={{ minWidth: 0 }}>
                <b>{m.event || "Meeting"}</b>
                <span className="bx-sub">{when(m.at)}</span>
              </span>
              <span className="bx-h2h-score bx-num">
                <b data-won={m.winner === 0 ? "" : undefined}>{m.score[0]}</b>
                <i className="bx-dash" />
                <b data-won={m.winner === 1 ? "" : undefined}>{m.score[1]}</b>
              </span>
            </>
          );
          return m.matchId ? (
            <Link
              key={m.at}
              to="/match/$matchId"
              params={{ matchId: m.matchId }}
              className="bx-line bx-h2h-row"
            >
              {body}
            </Link>
          ) : (
            <div key={m.at} className="bx-line bx-h2h-row">
              {body}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export function MatchPage({ matchId }: { matchId: string }) {
  const board = useBoard(undefined, { match: matchId });
  const wide = useWide();
  const { atlas, now, times } = board;
  const match = atlas.match(matchId);
  const back = <Back parent={match ? { kind: "tournament", id: match.tournamentId } : undefined} />;
  if (!match) {
    // A match from before the weeks a list reaches back arrives a moment after the page.
    if (board.loading) return <Waiting />;
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
  // Chess has its board at the head of the page, across its whole width.
  const chess = view.discipline.id === "chess" && !view.solo && started && !bare;
  // Round by round for a driver the viewer follows, or failing that for whoever leads.
  const followed = view.sides.findIndex((s) => atlas.world.follows.some((f) => f.id === s.id));
  const featured = followed >= 0 ? followed : (view.standings[0]?.index ?? 0);

  return (
    <>
      <div className="bx-row bx-btw" style={{ gap: 12 }}>
        {back}
        <Go
          to={{ kind: "tournament", id: view.tournament.id }}
          className="bx-sub bx-press"
          style={{ textAlign: "right" }}
        >
          {view.event} · {view.where}
        </Go>
      </div>

      <Heading view={view} board={board} wide={wide} />

      {chess ? <ChessStage view={view} match={match} board={board} /> : null}

      {/* Under a board, what the match is part of comes first and stands on the left. */}
      <div className={chess ? "bx-cols bx-cols-swap" : "bx-cols bx-cols-main"}>
        <div>
          {view.solo && started ? (
            <>
              <Section label="Standings">
                <div className="bx-list">
                  <CupStandings view={view} />
                </div>
              </Section>
              <Section
                label={followed >= 0 ? "The driver you follow" : "The leader, round by round"}
              >
                <div className="bx-list">
                  <CupPlaces view={view} index={featured} />
                </div>
              </Section>
            </>
          ) : null}
          {!view.solo && started && !bare && !chess ? (
            <div className="bx-list" style={{ marginTop: 20 }}>
              {games.map(({ game, index }) => (
                <GameRow key={index} game={game} index={index} view={view} />
              ))}
            </div>
          ) : null}
          {/* With nothing known of the inside of the games, the line above has said it all;
              the room goes to what the two sides have done before. */}
          {scheduled || bare || chess ? <Meetings view={view} board={board} /> : null}
          {scheduled || bare ? <Form view={view} board={board} /> : null}
        </div>
        <div>
          <Section label="In the event">
            <div className="bx-list">
              <p className="bx-empty" style={{ color: "var(--ink)" }}>
                {placeOf(atlas, view, now, times)}
              </p>
              {match.stream && match.stream.url !== "#" ? (
                <a
                  href={match.stream.url}
                  target="_blank"
                  rel="noreferrer"
                  className="bx-line bx-watch"
                >
                  <span className="bx-who">
                    <span className="bx-disc bx-disc-plain" style={{ "--s": "26px" } as never}>
                      <Play size={12} strokeWidth={2.6} aria-hidden />
                    </span>
                    <span>
                      <b>{match.status === "finished" ? "Watch it again" : "Watch"}</b>
                      <span className="bx-sub">{match.stream.label}</span>
                    </span>
                  </span>
                  <ArrowUpRight size={15} strokeWidth={2.2} aria-hidden />
                </a>
              ) : null}
            </div>
          </Section>
          {scheduled || bare || chess ? null : <Meetings view={view} board={board} />}
          <Lineups view={view} board={board} />
        </div>
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
