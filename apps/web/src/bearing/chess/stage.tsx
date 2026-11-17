import type { Match } from "@bearing/domain";
import { useState } from "react";
import { useAtlas } from "../../lib/world";
import type { Board } from "../board";
import type { MatchView, SideView } from "../model";
import { roundOf, useRoundGames } from "../../lib/chess-live";
import { ChessGame, type Seat } from "./game";
import { SeriesTable } from "./series";

/**
 * Chess on a match's page: one board, as large as the page allows, for the game being
 * played or the last one that was. A match of several games is written out above the board
 * the way chess writes a match, and a press on one of its games puts that game on the board.
 */
export function ChessStage({
  view,
  match,
  board,
}: {
  view: MatchView;
  match: Match;
  board: Board;
}) {
  const atlas = useAtlas();
  const { sides } = view;
  const games = match.games;
  // The game that matters now: the one being played, or the latest that has begun.
  const live = games.findIndex((g) => g.status === "live");
  const begun = games.findLastIndex((g) => g.status !== "scheduled");
  const current = live >= 0 ? live : Math.max(begun, 0);
  const [picked, setPicked] = useState<number>();
  const index = picked ?? current;
  const stored = games[index];
  // A game that is over and whose moves the store has not kept yet is read from Lichess.
  const missing = stored?.status === "finished" && !stored.moves?.length && !!stored.ref;
  const read = useRoundGames(missing ? roundOf(stored) : undefined, missing ? "once" : undefined);
  const said = missing ? read[stored.ref!.split("/").at(-1)!] : undefined;
  const game =
    stored && said ? { ...stored, ...said, result: undefined, movedAt: undefined } : stored;
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
        <div className="bx-series bx-series-pick">
          <SeriesTable
            match={match}
            sides={sides}
            board={board}
            picked={index}
            onPick={setPicked}
          />
        </div>
      ) : null}
      <div className="bx-stage-head">
        <b>{game.label.replace(" | ", " · ")}</b>
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
          {game.status === "live" ? " No move has been made yet." : ""}
        </p>
      )}
    </section>
  );
}
