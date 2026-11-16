import { type GameResult, clock, formatPoints, relative } from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { roundLabel } from "../lib/view";
import { useAtlas, useMinute } from "../lib/world";
import { type MatchView, type SideView, roundRows, summarize } from "./model";
import { Disc, Dots, Ping } from "./ui";

/** Rounds above the line for one side and below it for the other: the full form of a Counter-Strike map. */
function Momentum({ game, sides }: { game: GameResult; sides: SideView[] }) {
  const rounds = game.rounds ?? [];
  const slots = Array.from({ length: 24 }, (_, i) => rounds[i]?.winner);
  const row = (side: number) =>
    slots.flatMap((winner, i) => [
      i === 12 ? <span key={`gap-${side}`} /> : null,
      <i
        key={`${side}-${i}`}
        className={winner === side ? "bx-on" : undefined}
        style={winner === side ? { background: sides[side]?.color } : undefined}
      />,
    ]);
  return (
    <>
      <div className="bx-plot">
        {row(0)}
        <i className="bx-axis" />
        {row(1)}
      </div>
      <p className="bx-sub" style={{ margin: "7px 0 0" }}>
        Momentum: {sides[0]?.name} above the line, {sides[1]?.name} below
      </p>
    </>
  );
}

function scoreOf(game: GameResult): string {
  if (game.winner === "draw") return "½–½";
  return game.scores ? game.scores.map(formatPoints).join("–") : "";
}

function Game({ game, index, view }: { game: GameResult; index: number; view: MatchView }) {
  const live = game.status === "live";
  const { sides, discipline } = view;
  const right = game.cup
    ? live
      ? "LIVE"
      : ""
    : game.status === "scheduled"
      ? "TO COME"
      : live
        ? `LIVE${scoreOf(game) ? ` · ${scoreOf(game)}` : ""}`
        : scoreOf(game) ||
          (game.winner !== undefined && game.winner !== "draw" ? sides[game.winner]?.name : "");
  return (
    <div className="bx-game">
      <div className="bx-gamehead">
        <b>{game.label}</b>
        <span className="bx-sub bx-mono">
          {discipline.unit.one.toUpperCase()} {index + 1}
          {right ? ` · ${right}` : ""}
        </span>
      </div>
      {game.rounds?.length ? (
        <>
          <Dots rows={roundRows(game, sides)} sides={sides} />
          {live ? <Momentum game={game} sides={sides} /> : null}
        </>
      ) : null}
      {game.objectives ? (
        <p className="bx-sub" style={{ margin: "6px 0 0" }}>
          Towers {game.objectives.towers.join("–")} · Dragons {game.objectives.dragons.join("–")} ·
          Barons {game.objectives.barons.join("–")}
        </p>
      ) : null}
      {game.chess ? (
        <p className="bx-sub" style={{ margin: "6px 0 0" }}>
          Move {game.chess.move}
          {game.chess.lastMove ? ` · last move ${game.chess.lastMove}` : ""}
        </p>
      ) : null}
      {game.cup ? (
        <p className="bx-sub" style={{ margin: "6px 0 0" }}>
          Round {game.cup.round} · first to {game.cup.limit} points becomes a finalist
        </p>
      ) : game.detail && !game.rounds?.length ? (
        <p className="bx-sub" style={{ margin: "6px 0 0" }}>
          {game.detail}
        </p>
      ) : null}
    </div>
  );
}

export function MatchPage({ matchId }: { matchId: string }) {
  const atlas = useAtlas();
  const now = useMinute();
  const match = atlas.match(matchId);
  if (!match) {
    return (
      <p className="bx-empty">
        This match could not be found. <Link to="/">Back to today.</Link>
      </p>
    );
  }
  const view = summarize(atlas, match, now);
  const [a, b] = view.sides;
  const tournament = atlas.tournamentOf(match);
  const scheduled = match.status === "scheduled";
  // The game being played leads; finished ones follow, newest first; the rest wait at the end.
  const order = match.games
    .map((game, index) => ({ game, index }))
    .sort((x, y) => {
      const rank = (g: GameResult) => (g.status === "live" ? 0 : g.status === "finished" ? 1 : 2);
      return (
        rank(x.game) - rank(y.game) ||
        (x.game.status === "finished" ? y.index - x.index : x.index - y.index)
      );
    });

  return (
    <>
      <div className="bx-row bx-btw">
        <Link to="/" className="bx-back">
          <ChevronLeft size={18} />
          Today
        </Link>
        <span className="bx-sub">
          {tournament.short} · {roundLabel(atlas, match)}
        </span>
      </div>

      {view.solo || !a || !b ? (
        <div className="bx-matchhead">
          <span>
            <span>
              <b className="bx-name">{tournament.name}</b>
              <br />
              <span className="bx-sub">{view.discipline.name}</span>
            </span>
          </span>
        </div>
      ) : (
        <div className="bx-matchhead">
          <span>
            <Disc side={a} size={38} />
            <span>
              <b className="bx-name">{a.name}</b>
              <br />
              <span className="bx-sub">{view.subs[0]}</span>
            </span>
          </span>
          <span style={{ textAlign: "right" }}>
            <span>
              <b className="bx-name">{b.name}</b>
              <br />
              <span className="bx-sub">{view.subs[2]}</span>
            </span>
            <Disc side={b} size={38} />
          </span>
        </div>
      )}

      <p className={view.solo ? "bx-big bx-solo" : "bx-big bx-num"}>
        {scheduled ? (
          clock(match.scheduledAt, true)
        ) : view.headline.length > 1 ? (
          <span className="bx-score" style={{ fontSize: "inherit" }}>
            {view.headline[0]}
            <i />
            {view.headline[1]}
          </span>
        ) : (
          view.headline[0]
        )}
      </p>
      <div className="bx-state">
        {view.live ? <Ping /> : null}
        {scheduled ? relative(match.scheduledAt, now) : view.status}
        {view.subs[1] && !view.solo ? ` · ${view.subs[1]}` : ""}
      </div>

      {view.solo ? (
        <section className="bx-section">
          <h2 className="bx-label">Standings</h2>
          <div className="bx-list">
            {view.standings.map(({ side, points }) => (
              <div key={side.id ?? side.name} className="bx-lane">
                <span className="bx-row" style={{ gap: 9 }}>
                  <Disc side={side} size={24} />
                  {side.name}
                </span>
                <span />
                <span className="bx-mono bx-num">{formatPoints(points)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {order.some((o) => o.game.status !== "scheduled") ? (
        <div className="bx-list" style={{ marginTop: 18 }}>
          {order.map(({ game, index }) => (
            <Game key={index} game={game} index={index} view={view} />
          ))}
        </div>
      ) : null}
    </>
  );
}
