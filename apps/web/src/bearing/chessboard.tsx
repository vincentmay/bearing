import { CHESS_START, MATE, replayChess } from "@bearing/domain";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { type CSSProperties, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import type { SideView } from "./model";
import { Disc, Flag } from "./ui";

const NAME: Record<string, string> = {
  k: "king",
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
  p: "pawn",
};
const FILES = "abcdefgh";
const square = (i: number) => `${FILES[i % 8]}${8 - (i >> 3)}`;

/** Who sits on one side of the board, and what is known of them. */
export interface Seat {
  side: SideView;
  title?: string;
  rating?: number;
  country?: string;
}

/**
 * How likely White is to win a position an engine judges at so many pawns, from -1 (lost) to
 * 1 (won): the curve chess sites use, under which a pawn early counts for much and the tenth
 * pawn for nothing.
 */
function chances(pawns: number): number {
  if (Math.abs(pawns) > MATE - 200) return Math.sign(pawns);
  return 2 / (1 + Math.exp(-0.368208 * pawns)) - 1;
}

/** A judgement as it is written: "+0.4", "−1.7", "M3". */
function written(pawns: number): string {
  if (Math.abs(pawns) > MATE - 200) return `M${MATE - Math.abs(pawns)}`;
  const text = Math.abs(pawns).toFixed(1);
  return text === "0.0" ? "0.0" : `${pawns > 0 ? "+" : "−"}${text}`;
}

/** Seconds as a clock shows them: "1:30:10", "4:05", "0:38". */
function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/**
 * A game of chess to look through. The board, with whoever has White at the bottom unless it
 * is turned; beside it how an engine judges the position, as a bar that fills from White's
 * side; under it the same judgement over the whole game, which can be pointed at to go to a
 * move; the two players with their clocks as they stood at the move shown; and the moves.
 *
 * It opens on the latest position and stays with a game that is still being played. Stepping
 * back, or picking a move, lets go of that until the viewer returns to the end.
 */
export function ChessGame({
  moves,
  evals,
  clocks,
  live,
  white,
  black,
  opening,
}: {
  moves: string[];
  evals?: number[];
  clocks?: number[];
  live: boolean;
  white: Seat;
  black: Seat;
  opening?: string;
}) {
  const plies = useMemo(() => replayChess(moves), [moves]);
  const [at, setAt] = useState(plies.length);
  const [following, setFollowing] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [turned, setTurned] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  // Where the board stood before this drawing of it: a single step is shown as a move.
  const before = useRef(at);
  const step = at - before.current;
  useEffect(() => {
    before.current = at;
  }, [at]);

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
    }, 700);
    return () => clearInterval(timer);
  }, [playing, plies.length]);

  // Keep the move being shown in sight within the list, without moving the page.
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>("[aria-current]");
    const box = list.current;
    if (!el || !box) return;
    const top = el.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top + el.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTo({ top: top - box.clientHeight / 2, behavior: "smooth" });
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

  // The piece that has just moved, and where it came from, in squares across and down.
  const col = (i: number) => (turned ? 7 - (i % 8) : i % 8);
  const row = (i: number) => (turned ? 7 - (i >> 3) : i >> 3);
  const undone = step === -1 ? plies[at] : undefined;
  const mover =
    step === 1 && shown
      ? { on: shown.to, from: shown.from }
      : undone
        ? { on: undone.from, from: undone.to }
        : undefined;

  const judged = evals?.length ? evals : undefined;
  const now = judged ? (at > 0 ? (judged[Math.min(at, judged.length) - 1] ?? 0) : 0.2) : undefined;
  const share = now === undefined ? undefined : 50 + 50 * chances(now);
  /** The clock of the player with White (0) or Black (1) as it stood at the move shown. */
  const left = (colour: number) => {
    if (!clocks) return undefined;
    for (let i = at - 1; i >= 0; i--) {
      if (i % 2 === colour && (clocks[i] ?? -1) >= 0) return clocks[i];
    }
    return undefined;
  };
  const toMove = at % 2;
  const over = !live && at === plies.length;

  const seat = (who: Seat, colour: number) => {
    const time = left(colour);
    // Without a face, the disc is the colour of the pieces they have.
    const side: SideView = who.side.image
      ? who.side
      : { ...who.side, color: colour ? "#000" : "#fff", ink: colour ? "#fff" : "#000" };
    return (
      <div
        className="bx-seat"
        data-colour={colour ? "black" : "white"}
        data-face={who.side.image ? "" : undefined}
      >
        <Disc side={side} size={28} />
        <span className="bx-seat-who">
          <b>
            {who.title ? <i>{who.title}</i> : null}
            {who.side.name}
          </b>
          <span className="bx-sub">
            <Flag country={who.country} />
            {who.rating ?? ""}
          </span>
        </span>
        <i className="bx-seat-piece" aria-label={colour ? "Black" : "White"} />
        {time !== undefined ? (
          <span
            className="bx-clock bx-num"
            data-on={!over && toMove === colour ? "" : undefined}
            aria-label={`${colour ? "Black" : "White"}'s clock`}
          >
            {clock(time)}
          </span>
        ) : null}
      </div>
    );
  };

  const pick = (event: PointerEvent<SVGSVGElement>) => {
    if (!judged || (event.type === "pointermove" && event.buttons !== 1)) return;
    const box = event.currentTarget.getBoundingClientRect();
    const part = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
    go(Math.round(part * (judged.length - 1)) + 1);
  };

  const order = Array.from({ length: 64 }, (_, i) => (turned ? 63 - i : i));
  const [top, bottom] = turned ? [white, black] : [black, white];

  return (
    <div className="bx-chess">
      <div className="bx-chess-main">
        {seat(top, turned ? 0 : 1)}
        <div className="bx-chess-table" data-judged={share === undefined ? undefined : ""}>
          {share === undefined ? null : (
            <div
              className="bx-eval"
              data-turned={turned ? "" : undefined}
              data-ahead={now! >= 0 ? "white" : "black"}
              style={{ "--w": `${share}%` } as CSSProperties}
              role="img"
              aria-label={`The engine's judgement: ${written(now!)} for ${now! >= 0 ? "White" : "Black"}`}
            >
              <i />
              <b className="bx-num">{written(now!).replace(/^[+−]/, "")}</b>
            </div>
          )}
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
              else if (event.key === " ") setPlaying((on) => !on);
              else return;
              event.preventDefault();
            }}
          >
            {order.map((i) => {
              const piece = squares[i] ?? ".";
              const dark = ((i >> 3) + (i % 8)) % 2 === 1;
              const lower = piece.toLowerCase();
              const moved = mover?.on === i;
              return (
                <i
                  key={i}
                  data-dark={dark ? "" : undefined}
                  data-from={shown?.from === i ? "" : undefined}
                  data-to={shown?.to === i ? "" : undefined}
                >
                  {col(i) === 0 ? <u data-rank="">{8 - (i >> 3)}</u> : null}
                  {row(i) === 7 ? <u data-file="">{FILES[i % 8]}</u> : null}
                  {piece === "." ? null : (
                    <img
                      // The piece that moved is set down again from where it came, so that it
                      // is seen to travel; the others stay as they are.
                      key={moved ? `moved-${at}` : "still"}
                      src={`/pieces/${piece === lower ? "b" : "w"}${piece.toUpperCase()}.svg`}
                      alt=""
                      draggable={false}
                      title={`${piece === lower ? "Black" : "White"} ${NAME[lower]} on ${square(i)}`}
                      data-moved={moved ? "" : undefined}
                      style={
                        moved
                          ? ({
                              "--dx": col(mover.from) - col(i),
                              "--dy": row(mover.from) - row(i),
                            } as CSSProperties)
                          : undefined
                      }
                    />
                  )}
                </i>
              );
            })}
          </div>
        </div>
        {seat(bottom, turned ? 1 : 0)}
        {judged && judged.length > 2 ? (
          <svg
            className="bx-evalgraph"
            viewBox={`0 0 ${judged.length - 1} 40`}
            preserveAspectRatio="none"
            onPointerDown={pick}
            onPointerMove={pick}
            role="img"
            aria-label="The engine's judgement through the game; point at it to go to a move"
          >
            <path
              data-area=""
              d={`M0,20${judged.map((v, i) => `L${i},${(20 - chances(v) * 19).toFixed(2)}`).join("")}L${judged.length - 1},20Z`}
            />
            <path
              data-line=""
              d={judged
                .map((v, i) => `${i ? "L" : "M"}${i},${(20 - chances(v) * 19).toFixed(2)}`)
                .join("")}
            />
            {at > 0 ? (
              <line
                data-at=""
                x1={Math.min(at, judged.length) - 1}
                x2={Math.min(at, judged.length) - 1}
                y1="0"
                y2="40"
              />
            ) : null}
          </svg>
        ) : null}
      </div>
      <div className="bx-chess-side">
        {opening ? <p className="bx-chess-opening">{opening}</p> : null}
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
          <button
            type="button"
            data-turn=""
            onClick={() => setTurned((on) => !on)}
            aria-label="Turn the board"
            aria-pressed={turned}
          >
            <ArrowUpDown size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
