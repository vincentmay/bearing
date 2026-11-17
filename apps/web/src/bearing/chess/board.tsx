import { chessSquare } from "@bearing/domain";
import { Crown } from "lucide-react";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import type { Man } from "./men";

const FILES = "abcdefgh";
const NAME: Record<string, string> = {
  k: "king",
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
  p: "pawn",
};

/** An arrow from one square to another, or a ring around one when both are the same. */
export interface Shape {
  from: number;
  to: number;
}

/** A mark on a king's square once the game is over. */
export interface Verdict {
  square: number;
  mark: "won" | "drew";
}

/**
 * The board. Every piece is one element for as long as the game lasts and is moved, never
 * replaced, so each change of position is seen to happen: a move travels, a capture fades
 * where it fell, castling moves king and rook together, and going back twenty moves sends
 * every piece home at once.
 *
 * Where it is told where the pieces may go, they can be moved: dragged with a pointer, or
 * picked and placed with two presses, which is how a finger does it without taking the page's
 * scrolling away. The right button draws: an arrow from square to square, a ring on one.
 */
export function Board({
  men,
  set,
  turned,
  last,
  check,
  dests,
  onMove,
  hint,
  verdicts,
  label,
}: {
  men: Man[];
  /** Which pieces are drawn: the name of a folder under /pieces. */
  set: string;
  turned: boolean;
  last?: Shape;
  /** The square of a king that stands in check. */
  check?: number;
  dests?: Map<number, number[]>;
  onMove?: (from: number, to: number, promote?: "q" | "r" | "b" | "n") => void;
  /** The move the engine would make, drawn as an arrow. */
  hint?: Shape;
  verdicts?: Verdict[];
  label: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<number>();
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [drawing, setDrawing] = useState<Shape>();
  const [promoting, setPromoting] = useState<Shape>();
  const drag = useRef<{
    from: number;
    el: HTMLElement;
    home: string;
    x: number;
    y: number;
    moved: boolean;
  }>(undefined);

  // What was picked or drawn belongs to the position it was picked or drawn on.
  const position = men.map((man) => (man.gone ? "" : `${man.id}:${man.square}`)).join();
  useEffect(() => {
    setPicked(undefined);
    setShapes([]);
    setPromoting(undefined);
  }, [position]);

  const col = (square: number) => (turned ? 7 - (square % 8) : square % 8);
  const row = (square: number) => (turned ? 7 - (square >> 3) : square >> 3);
  const squareAt = (event: { clientX: number; clientY: number }) => {
    const box = root.current!.getBoundingClientRect();
    const c = Math.max(0, Math.min(7, Math.floor(((event.clientX - box.left) / box.width) * 8)));
    const r = Math.max(0, Math.min(7, Math.floor(((event.clientY - box.top) / box.height) * 8)));
    return turned ? 63 - (r * 8 + c) : r * 8 + c;
  };
  const reach = picked === undefined ? undefined : dests?.get(picked);
  const standing = new Map(men.filter((man) => !man.gone).map((man) => [man.square, man]));

  const move = (from: number, to: number) => {
    setPicked(undefined);
    const piece = standing.get(from)?.piece.toLowerCase();
    // A pawn arriving on the last rank is asked what it becomes.
    if (piece === "p" && (to < 8 || to >= 56)) setPromoting({ from, to });
    else onMove?.(from, to);
  };

  const down = (event: PointerEvent<HTMLDivElement>) => {
    const square = squareAt(event);
    if (event.button === 2) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrawing({ from: square, to: square });
      return;
    }
    if (event.button !== 0) return;
    if (shapes.length) setShapes([]);
    if (promoting) return setPromoting(undefined);
    if (!dests || !onMove) return;
    if (picked !== undefined && reach?.includes(square)) return move(picked, square);
    if (!dests.has(square)) return setPicked(undefined);
    setPicked(square);
    // A finger picks and places; dragging is left to the pointer, so the page still scrolls.
    if (event.pointerType === "touch") return;
    const el = root.current?.querySelector<HTMLElement>(`[data-man="${standing.get(square)?.id}"]`);
    if (!el) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      from: square,
      el,
      home: el.style.transform,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
  };

  const travel = (event: PointerEvent<HTMLDivElement>) => {
    if (drawing) {
      const to = squareAt(event);
      if (to !== drawing.to) setDrawing({ from: drawing.from, to });
      return;
    }
    const held = drag.current;
    if (!held) return;
    if (!held.moved && Math.hypot(event.clientX - held.x, event.clientY - held.y) < 5) return;
    held.moved = true;
    const box = root.current!.getBoundingClientRect();
    const size = box.width / 8;
    held.el.dataset.held = "";
    held.el.style.transform = `translate(${event.clientX - box.left - size / 2}px, ${event.clientY - box.top - size / 2}px)`;
  };

  const up = (event: PointerEvent<HTMLDivElement>) => {
    if (drawing) {
      const shape = { from: drawing.from, to: squareAt(event) };
      setDrawing(undefined);
      // Drawn twice, a shape is taken away again.
      setShapes((now) =>
        now.some((s) => s.from === shape.from && s.to === shape.to)
          ? now.filter((s) => s.from !== shape.from || s.to !== shape.to)
          : [...now, shape],
      );
      return;
    }
    const held = drag.current;
    drag.current = undefined;
    if (!held) return;
    delete held.el.dataset.held;
    if (!held.moved) return;
    const to = squareAt(event);
    // Set down where it may not go, it returns to its square.
    held.el.style.transform = held.home;
    if (dests?.get(held.from)?.includes(to)) move(held.from, to);
  };

  const centre = (square: number) => [col(square) + 0.5, row(square) + 0.5] as const;
  const arrow = (shape: Shape, kind: string, key: string) => {
    const [x1, y1] = centre(shape.from);
    const [x2, y2] = centre(shape.to);
    if (shape.from === shape.to)
      return <circle key={key} data-kind={kind} cx={x1} cy={y1} r="0.43" />;
    const length = Math.hypot(x2 - x1, y2 - y1);
    const [ux, uy] = [(x2 - x1) / length, (y2 - y1) / length];
    // The shaft stops short of the square's centre, where the head takes over.
    const [sx, sy] = [x2 - ux * 0.36, y2 - uy * 0.36];
    const head = [
      [x2 - ux * 0.08, y2 - uy * 0.08],
      [sx - uy * 0.2, sy + ux * 0.2],
      [sx + uy * 0.2, sy - ux * 0.2],
    ]
      .map((p) => p.map((n) => n.toFixed(3)).join(","))
      .join(" ");
    return (
      <g key={key} data-kind={kind}>
        <line x1={x1 + ux * 0.28} y1={y1 + uy * 0.28} x2={sx} y2={sy} />
        <polygon points={head} />
      </g>
    );
  };

  const order = Array.from({ length: 64 }, (_, i) => (turned ? 63 - i : i));
  const taking = (square: number) => standing.has(square);

  return (
    <div
      className="bx-board"
      ref={root}
      role="img"
      aria-label={label}
      data-live={dests && onMove ? "" : undefined}
      onPointerDown={down}
      onPointerMove={travel}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="bx-squares">
        {order.map((i) => (
          <i
            key={i}
            data-dark={((i >> 3) + (i % 8)) % 2 === 1 ? "" : undefined}
            data-from={last?.from === i ? "" : undefined}
            data-to={last?.to === i ? "" : undefined}
            data-picked={picked === i ? "" : undefined}
            data-check={check === i ? "" : undefined}
            data-reach={reach?.includes(i) ? (taking(i) ? "take" : "go") : undefined}
          >
            {col(i) === 0 ? <u data-rank="">{8 - (i >> 3)}</u> : null}
            {row(i) === 7 ? <u data-file="">{FILES[i % 8]}</u> : null}
          </i>
        ))}
      </div>
      {/* Turning the board sets the pieces down afresh; they do not all fly across it. */}
      <div className="bx-men" key={turned ? "turned" : "upright"}>
        {men.map((man) => {
          const white = man.piece === man.piece.toUpperCase();
          return (
            <img
              key={man.id}
              data-man={man.id}
              data-gone={man.gone ? "" : undefined}
              data-moved={last?.to === man.square && !man.gone ? "" : undefined}
              src={`/chessmen/${set}/${white ? "w" : "b"}${man.piece.toUpperCase()}.svg`}
              alt=""
              draggable={false}
              title={
                man.gone
                  ? undefined
                  : `${white ? "White" : "Black"} ${NAME[man.piece.toLowerCase()]} on ${chessSquare(man.square)}`
              }
              style={{
                transform: `translate(${col(man.square) * 100}%, ${row(man.square) * 100}%)`,
              }}
            />
          );
        })}
      </div>
      {verdicts?.map((verdict) => (
        <span
          key={verdict.square}
          className="bx-verdict"
          data-mark={verdict.mark}
          style={{ left: `${col(verdict.square) * 12.5}%`, top: `${row(verdict.square) * 12.5}%` }}
        >
          {verdict.mark === "won" ? <Crown size={11} strokeWidth={2.6} /> : "½"}
        </span>
      ))}
      <svg className="bx-shapes" viewBox="0 0 8 8" aria-hidden>
        {hint ? arrow(hint, "hint", "hint") : null}
        {shapes.map((shape) => arrow(shape, "drawn", `${shape.from}-${shape.to}`))}
        {drawing ? arrow(drawing, "drawn", "drawing") : null}
      </svg>
      {promoting ? (
        <div
          className="bx-promote"
          data-low={row(promoting.to) === 7 ? "" : undefined}
          style={{ left: `${col(promoting.to) * 12.5}%` }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {(["q", "n", "r", "b"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-label={`Promote to a ${NAME[kind]}`}
              onClick={() => {
                onMove?.(promoting.from, promoting.to, kind);
                setPromoting(undefined);
              }}
            >
              <img
                src={`/chessmen/${set}/${promoting.to < 8 ? "w" : "b"}${kind.toUpperCase()}.svg`}
                alt=""
                draggable={false}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
