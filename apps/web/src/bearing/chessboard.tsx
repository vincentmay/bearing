import { CHESS_START, replayChess } from "@bearing/domain";
import { ChevronLeft, ChevronRight, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

/** The filled shapes, for both colours; the colour is given by how they are painted. */
const SHAPE: Record<string, string> = {
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};
const NAME: Record<string, string> = {
  k: "king",
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
  p: "pawn",
};
const square = (i: number) => `${"abcdefgh"[i % 8]}${8 - (i >> 3)}`;

/**
 * A game of chess to look through: the board, White at the bottom, and the moves beside it.
 * It opens on the latest position and stays with a game that is still being played; stepping
 * back, or picking a move, lets go of that until the viewer returns to the end.
 */
export function ChessGame({
  moves,
  live,
  white,
  black,
}: {
  moves: string[];
  live: boolean;
  white: string;
  black: string;
}) {
  const plies = useMemo(() => replayChess(moves), [moves]);
  const [at, setAt] = useState(plies.length);
  const [following, setFollowing] = useState(true);
  const [playing, setPlaying] = useState(false);
  const list = useRef<HTMLOListElement>(null);

  // A new move arrives: go with it, unless the viewer is looking at an earlier one.
  useEffect(() => {
    if (following) setAt(plies.length);
  }, [plies.length, following]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setAt((now) => {
        if (now >= plies.length) {
          setPlaying(false);
          setFollowing(true);
          return now;
        }
        return now + 1;
      });
    }, 650);
    return () => clearInterval(timer);
  }, [playing, plies.length]);

  // Keep the move being shown in sight within the list, without moving the page.
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>("[aria-current]");
    const box = list.current;
    if (!el || !box) return;
    const top = el.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top + el.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = top - box.clientHeight / 2;
    }
  }, [at]);

  const go = (to: number) => {
    const next = Math.max(0, Math.min(plies.length, to));
    setPlaying(false);
    setAt(next);
    setFollowing(next === plies.length);
  };
  const shown = at > 0 ? plies[at - 1] : undefined;
  const squares = shown?.squares ?? CHESS_START;
  const pairs = Array.from({ length: Math.ceil(plies.length / 2) }, (_, n) => n);

  return (
    <div className="bx-chess">
      <div>
        <p className="bx-chess-name">{black}</p>
        <div
          className="bx-board"
          role="img"
          aria-label={
            shown
              ? `Position after move ${Math.ceil(at / 2)}, ${at % 2 ? "White" : "Black"} played ${shown.san}`
              : "The starting position"
          }
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") go(at - 1);
            else if (event.key === "ArrowRight") go(at + 1);
            else if (event.key === "Home") go(0);
            else if (event.key === "End") go(plies.length);
            else return;
            event.preventDefault();
          }}
        >
          {squares.split("").map((piece, i) => {
            const dark = ((i >> 3) + (i % 8)) % 2 === 1;
            const lower = piece.toLowerCase();
            return (
              <i
                key={i}
                data-dark={dark ? "" : undefined}
                data-from={shown?.from === i ? "" : undefined}
                data-to={shown?.to === i ? "" : undefined}
              >
                {piece === "." ? null : (
                  <span
                    // The piece that has just moved is set down again, so that it is seen to land.
                    key={shown?.to === i ? `${at}` : "still"}
                    data-white={piece !== lower ? "" : undefined}
                    data-landed={shown?.to === i ? "" : undefined}
                    title={`${piece !== lower ? "White" : "Black"} ${NAME[lower]} on ${square(i)}`}
                  >
                    {SHAPE[lower]}
                    {"︎"}
                  </span>
                )}
              </i>
            );
          })}
        </div>
        <p className="bx-chess-name">{white}</p>
        <div className="bx-chess-keys">
          <button type="button" onClick={() => go(0)} disabled={at === 0} aria-label="To the start">
            <SkipBack size={15} />
          </button>
          <button
            type="button"
            onClick={() => go(at - 1)}
            disabled={at === 0}
            aria-label="One move back"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            data-main=""
            onClick={() => {
              if (playing) return setPlaying(false);
              // From the end, playing starts over.
              if (at >= plies.length) setAt(0);
              setFollowing(false);
              setPlaying(true);
            }}
            aria-label={playing ? "Pause" : "Play the game through"}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button
            type="button"
            onClick={() => go(at + 1)}
            disabled={at >= plies.length}
            aria-label="One move on"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            onClick={() => go(plies.length)}
            disabled={at >= plies.length}
            aria-label={live ? "To the move being played" : "To the end"}
          >
            <SkipForward size={15} />
          </button>
        </div>
      </div>
      <ol className="bx-moves" ref={list}>
        {pairs.map((n) => (
          <li key={n}>
            <i className="bx-num">{n + 1}</i>
            {[0, 1].map((half) => {
              const index = n * 2 + half;
              const ply = plies[index];
              return ply ? (
                <button
                  key={half}
                  type="button"
                  aria-current={at === index + 1 ? "step" : undefined}
                  onClick={() => go(index + 1)}
                >
                  {ply.san}
                </button>
              ) : (
                <span key={half} />
              );
            })}
          </li>
        ))}
      </ol>
    </div>
  );
}
