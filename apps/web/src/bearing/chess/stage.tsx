import type { GameResult, Match } from "@bearing/domain";
import { formatPoints } from "@bearing/domain";
import { useState } from "react";
import { useAtlas } from "../../lib/world";
import type { MatchView, SideView } from "../model";
import { Ping } from "../ui";
import { ChessGame, type Seat } from "./game";

/** What one game gave the side that had White and the side that had Black, as it is written. */
function scoreOf(game: GameResult): string {
  if (game.status !== "finished" || game.winner === undefined) return "";
  if (game.winner === "draw") return "½–½";
  return game.winner === (game.firstSide ?? 0) ? "1–0" : "0–1";
}

/** "Game 6 | Rapid" is game 6, a rapid game; "Board 3" is itself. */
function nameOf(label: string, index: number): { number: string; kind?: string } {
  const [first, kind] = label.split("|").map((part) => part.trim());
  const number = /^(?:Game|Round|Partie)\s+(\d+)$/i.exec(first ?? "")?.[1];
  return { number: number ?? String(index + 1), kind: kind || (number ? undefined : first) };
}

/**
 * Chess on a match's page: one board, as large as the page allows, for the game being
 * played or the last one that was. A match of several games has them in a row above the
 * board, each with its result, to pick from; the board then shows the one picked.
 */
export function ChessStage({ view, match }: { view: MatchView; match: Match }) {
  const atlas = useAtlas();
  const { sides } = view;
  const games = match.games;
  // The game that matters now: the one being played, or the latest that has begun.
  const live = games.findIndex((g) => g.status === "live");
  const begun = games.findLastIndex((g) => g.status !== "scheduled");
  const current = live >= 0 ? live : Math.max(begun, 0);
  const [picked, setPicked] = useState<number>();
  const index = picked ?? current;
  const game = games[index];
  if (!game) return null;

  const first = game.firstSide ?? 0;
  const seat = (side: SideView | undefined): Seat => {
    const player = side?.id ? atlas.player(side.id) : undefined;
    return {
      side: side ?? sides[0]!,
      title: player?.title,
      rating: player?.rating?.value,
      country: player?.country,
    };
  };
  const parts = game.detail?.split(" · ") ?? [];
  const opening =
    parts.length > 1 || !/^\d+ moves$|^move \d+$/.test(parts[0] ?? "") ? parts[0] : undefined;
  const length = game.status === "finished" ? parts.find((p) => /^\d+ moves$/.test(p)) : undefined;
  const winner = typeof game.winner === "number" ? sides[game.winner]?.label : undefined;
  const outcome =
    game.status === "live"
      ? `move ${game.chess?.move ?? 1}`
      : game.status === "scheduled"
        ? "to come"
        : `${game.winner === "draw" ? "Draw" : `${winner ?? ""} won`}${length ? ` · ${length}` : ""}`;
  const result =
    game.status !== "finished" || game.winner === undefined
      ? undefined
      : game.winner === "draw"
        ? ("draw" as const)
        : game.winner === first
          ? 0
          : 1;

  return (
    <section className="bx-stage">
      {games.length > 1 ? (
        <nav className="bx-stage-games" aria-label="The games of the match">
          {games.map((g, i) => {
            const name = nameOf(g.label, i);
            const points = g.scores && g.status === "finished" ? g.scores : undefined;
            return (
              <button
                key={i}
                type="button"
                aria-current={i === index ? "true" : undefined}
                data-status={g.status}
                disabled={g.status === "scheduled"}
                onClick={() => setPicked(i)}
              >
                <b>
                  {name.number}
                  {name.kind ? <i>{name.kind}</i> : null}
                </b>
                <span className="bx-num">
                  {g.status === "live" ? (
                    <Ping />
                  ) : points && (points[0]! > 1 || points[1]! > 1) ? (
                    `${formatPoints(points[0]!)}–${formatPoints(points[1]!)}`
                  ) : (
                    scoreOf(g) || "·"
                  )}
                </span>
              </button>
            );
          })}
        </nav>
      ) : null}
      <div className="bx-stage-head">
        <b>{game.label}</b>
        <span className="bx-sub bx-mono">{outcome}</span>
      </div>
      {game.moves?.length ? (
        <ChessGame
          // A game picked from the row is another game: the board starts on it afresh.
          key={index}
          moves={game.moves}
          evals={game.evals}
          clocks={game.clocks}
          live={game.status === "live"}
          movedAt={game.chess?.movedAt}
          result={result}
          white={seat(sides[first])}
          black={seat(sides[1 - first])}
          opening={opening}
        />
      ) : (
        <p className="bx-stage-none bx-sub">
          {opening ? `${opening} · ` : ""}
          {sides[first]?.name} {game.status === "finished" ? "had" : "has"} the white pieces.
          {game.status === "live" ? " The moves are on their way." : ""}
        </p>
      )}
    </section>
  );
}
