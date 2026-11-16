import { type GameResult, type Provenance, form, playerTotals } from "@bearing/domain";
import { type Board, useBoard, useWide } from "./board";
import { Back, Go } from "./links";
import { ChessLanes, CupPlaces, CupStandings, GameRow, Stops } from "./forms";
import { type Dot, type MatchView, type SideView, placeOf, stopsOf } from "./model";
import { type Times, until } from "./time";
import { Disc, Dots, Ping, Problem, Score, Section } from "./ui";

/** Where a fact comes from and when it was last checked: shown for every match and event. */
export function Source({
  provenance,
  now,
  times,
}: {
  provenance: Provenance;
  now: number;
  times: Times;
}) {
  return (
    <p className="bx-source">
      Source: {provenance.source}, checked {times.day(provenance.checkedAt, now).toLowerCase()} at{" "}
      {times.clock(provenance.checkedAt)}.{provenance.note ? ` ${provenance.note}` : ""}
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
  const state = (
    <div className="bx-state">
      {view.live ? <Ping /> : null}
      <span>
        {scheduled
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

  const big = view.headline.length === 1 && !scheduled ? "bx-big bx-solo" : "bx-big bx-num";
  // Both names are set at the same size, the smaller one if either is long.
  const long = Math.max(a.name.length, b.name.length) > (wide ? 16 : 11);
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
        <Stops view={view} stops={stopsOf(board.atlas, view, board.times)} />
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
        {known.map((side) => {
          const results = form(board.atlas, side.id);
          const dots: Dot[] = results.map((r) =>
            r === "W"
              ? { k: "won", side: 0, label: "Won" }
              : r === "D"
                ? { k: "shared", label: "Draw" }
                : { k: "open" },
          );
          return (
            <Go key={side.id} to={target(board, side.id)} className="bx-result">
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
              <Dots
                dots={dots}
                sides={[side, { ...side, color: "var(--surface)" }]}
                size={11}
                fix
              />
            </Go>
          );
        })}
      </div>
    </Section>
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
        const roster = board.atlas.roster(side.id).filter((r) => r.stint.role !== "Coach");
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
                  <span>
                    <b>{player.handle}</b>
                    <span className="bx-sub">{stint.role}</span>
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

export function MatchPage({ matchId }: { matchId: string }) {
  const board = useBoard();
  const wide = useWide();
  const { atlas, now, times } = board;
  const match = atlas.match(matchId);
  const back = <Back />;
  if (!match) {
    return (
      <>
        {back}
        <Problem title="This match could not be found">
          It may have been removed, or the link is wrong.
        </Problem>
      </>
    );
  }
  const view = board.view(match);
  const scheduled = match.status === "scheduled";
  const games = ordered(match.games);
  const started = games.some((o) => o.game.status !== "scheduled");
  const explainAt = games.find((o) => o.game.status !== "scheduled")?.index;
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

      <div className="bx-cols bx-cols-main">
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
                <p className="bx-note">A filled dot is a round they won.</p>
              </Section>
            </>
          ) : null}
          {!view.solo && started ? (
            <div className="bx-list" style={{ marginTop: 20 }}>
              {view.discipline.id === "chess" && match.bestOf > 1 ? (
                <ChessLanes view={view} />
              ) : null}
              {games.map(({ game, index }) => (
                <GameRow
                  key={index}
                  game={game}
                  index={index}
                  view={view}
                  explain={index === explainAt}
                />
              ))}
            </div>
          ) : null}
          {scheduled ? <Form view={view} board={board} /> : null}
        </div>
        <div>
          <Section label="In the event">
            <div className="bx-list">
              <p className="bx-empty" style={{ color: "var(--ink)" }}>
                {placeOf(atlas, view, now, times)}
              </p>
            </div>
          </Section>
          <Lineups view={view} board={board} />
        </div>
      </div>

      <Source provenance={view.tournament.provenance} now={now} times={times} />
    </>
  );
}
