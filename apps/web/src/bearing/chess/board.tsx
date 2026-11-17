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

/** What a drawing is drawn in. The plain one is amber; a held key picks another. */
export type Tint = "amber" | "green" | "blue" | "red";

/** An arrow from one square to another, or a mark on one when both are the same. */
export interface Shape {
  from: number;
  to: number;
  tint?: Tint;
}

/** A mark on a king's square once the game is over. */
export interface Verdict {
  square: number;
  mark: "won" | "drew";
}

// An arrow, in squares: how thick its shaft is, how wide and long its head, and how far from
// the middle of the square it leaves from it begins.
const SHAFT = 0.16;
const HEAD_WIDTH = 0.44;
const HEAD_LENGTH = 0.38;
const START = 0.38;

/**
 * The board. Every piece is one element for as long as the game lasts and is moved, never
 * replaced, so each change of position is seen to happen: a move travels, the piece it takes
 * is gone as it lands, castling moves king and rook together, and going back twenty moves
 * sends every piece home at once.
 *
 * Where it is told where the pieces may go, they can be moved. A pointer picks a piece up
 * the moment it is pressed, carries it under itself, and sets it down where it is let go; two
 * presses do the same, which is how a finger does it without taking the page's scrolling
 * away. The right button draws: an arrow from square to square (a knight's goes round the
 * corner), a mark on one square. Shift, Alt and Ctrl draw in green, blue and red.
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
  /** Which pieces are drawn: the name of a folder under /chessmen. */
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
  /** The square a carried piece is over. */
  const [over, setOver] = useState<number>();
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
    /** It was picked before this press: letting it go where it stands puts it down again. */
    again: boolean;
  }>(undefined);

  // What was picked or drawn belongs to the position it was picked or drawn on.
  const position = men.map((man) => (man.gone ? "" : `${man.id}:${man.square}`)).join();
  useEffect(() => {
    setPicked(undefined);
    setOver(undefined);
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

  /** Put the carried piece under the pointer: its middle where the pointer is. */
  const carry = (el: HTMLElement, event: { clientX: number; clientY: number }) => {
    const box = root.current!.getBoundingClientRect();
    const size = box.width / 8;
    const x = Math.max(
      -size / 2,
      Math.min(box.width - size / 2, event.clientX - box.left - size / 2),
    );
    const y = Math.max(
      -size / 2,
      Math.min(box.height - size / 2, event.clientY - box.top - size / 2),
    );
    // The lift is part of the same transform, after the move, so that it grows the piece
    // about its own middle and does not shift where it is.
    el.style.transform = `translate(${x}px, ${y}px) scale(1.08)`;
  };

  const move = (from: number, to: number): boolean => {
    setPicked(undefined);
    const piece = standing.get(from)?.piece.toLowerCase();
    // A pawn arriving on the last rank is asked what it becomes.
    if (piece === "p" && (to < 8 || to >= 56)) {
      setPromoting({ from, to });
      return false;
    }
    onMove?.(from, to);
    return true;
  };

  const tintOf = (event: PointerEvent): Tint =>
    event.shiftKey
      ? "green"
      : event.altKey
        ? "blue"
        : event.ctrlKey || event.metaKey
          ? "red"
          : "amber";

  const down = (event: PointerEvent<HTMLDivElement>) => {
    const square = squareAt(event);
    if (event.button === 2) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setPicked(undefined);
      setDrawing({ from: square, to: square, tint: tintOf(event) });
      return;
    }
    if (event.button !== 0) return;
    if (shapes.length) setShapes([]);
    if (promoting) return setPromoting(undefined);
    if (!dests || !onMove) return;
    if (picked !== undefined && picked !== square && reach?.includes(square)) {
      move(picked, square);
      return;
    }
    if (!dests.has(square)) return setPicked(undefined);
    const again = picked === square;
    setPicked(square);
    // A finger picks and places; carrying is left to the pointer, so the page still scrolls.
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
      again,
    };
    // Picked up at once, and under the pointer from the first instant.
    el.dataset.held = "";
    el.style.transition = "none";
    carry(el, event);
    setOver(square);
  };

  const travel = (event: PointerEvent<HTMLDivElement>) => {
    if (drawing) {
      const to = squareAt(event);
      if (to !== drawing.to) setDrawing({ ...drawing, to });
      return;
    }
    const held = drag.current;
    if (!held) {
      // A hand over a piece that may move.
      if (dests && event.pointerType !== "touch")
        root.current?.toggleAttribute("data-grab", dests.has(squareAt(event)));
      return;
    }
    if (Math.hypot(event.clientX - held.x, event.clientY - held.y) >= 4) held.moved = true;
    carry(held.el, event);
    const square = squareAt(event);
    if (square !== over) setOver(square);
  };

  const up = (event: PointerEvent<HTMLDivElement>) => {
    if (drawing) {
      const shape = { ...drawing, to: squareAt(event) };
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
    setOver(undefined);
    delete held.el.dataset.held;
    const to = squareAt(event);
    const settle = () =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          held.el.style.transition = "";
        }),
      );
    if (to !== held.from && dests?.get(held.from)?.includes(to) && move(held.from, to)) {
      // Set down where it may go: it is there. It does not travel a second time.
      held.el.style.transform = `translate(${col(to) * 100}%, ${row(to) * 100}%)`;
      settle();
      return;
    }
    if (to === held.from) {
      // Let go where it stands: it is back on its square at once, and stays picked for a
      // second press, unless this was that second press.
      held.el.style.transform = held.home;
      settle();
      if (held.again && !held.moved) setPicked(undefined);
      return;
    }
    // Let go where it may not go: it returns to its square, and is seen to.
    held.el.style.transition = "";
    held.el.style.transform = held.home;
    setPicked(undefined);
  };

  const centre = (square: number) => [col(square) + 0.5, row(square) + 0.5] as const;
  const point = (p: readonly number[]) => p.map((n) => n.toFixed(3)).join(",");

  /** An arrow: a shaft and a head, drawn as one so that where they meet is not darker. */
  const arrow = (shape: Shape, kind: string, key: string) => {
    const [x1, y1] = centre(shape.from);
    const [x2, y2] = centre(shape.to);
    const [dx, dy] = [x2 - x1, y2 - y1];
    // A knight's move goes the long way first and then round the corner.
    const knight = Math.abs(dx) * Math.abs(dy) === 2;
    const corner: [number, number] | undefined = knight
      ? Math.abs(dx) === 2
        ? [x2, y1]
        : [x1, y2]
      : undefined;
    const [fx, fy]: [number, number] = corner ?? [x1, y1];
    const lastLeg = Math.hypot(x2 - fx, y2 - fy);
    const [ux, uy] = [(x2 - fx) / lastLeg, (y2 - fy) / lastLeg];
    // The first leg's direction, for where the shaft begins.
    const firstLeg = Math.hypot((corner?.[0] ?? x2) - x1, (corner?.[1] ?? y2) - y1);
    const [vx, vy] = [((corner?.[0] ?? x2) - x1) / firstLeg, ((corner?.[1] ?? y2) - y1) / firstLeg];
    const start = [x1 + vx * START, y1 + vy * START];
    const neck = [x2 - ux * HEAD_LENGTH, y2 - uy * HEAD_LENGTH];
    const head = [
      [x2, y2],
      [neck[0]! - uy * (HEAD_WIDTH / 2), neck[1]! + ux * (HEAD_WIDTH / 2)],
      [neck[0]! + uy * (HEAD_WIDTH / 2), neck[1]! - ux * (HEAD_WIDTH / 2)],
    ];
    const shaft = [
      start,
      ...(corner ? [corner] : []),
      [neck[0]! + ux * 0.01, neck[1]! + uy * 0.01],
    ];
    return (
      <g key={key} data-kind={kind} data-tint={shape.tint ?? "amber"}>
        <polyline points={shaft.map(point).join(" ")} strokeWidth={SHAFT} />
        <polygon points={head.map(point).join(" ")} />
      </g>
    );
  };

  const order = Array.from({ length: 64 }, (_, i) => (turned ? 63 - i : i));
  const marks = new Map(
    [...shapes, ...(drawing ? [drawing] : [])]
      .filter((shape) => shape.from === shape.to)
      .map((shape) => [shape.from, shape.tint ?? "amber"] as const),
  );
  const arrows = shapes.filter((shape) => shape.from !== shape.to);

  return (
    <div
      className="bx-board"
      ref={root}
      role="img"
      aria-label={label}
      onPointerDown={down}
      onPointerMove={travel}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={() => root.current?.removeAttribute("data-grab")}
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
            data-over={over === i && over !== picked ? "" : undefined}
            data-check={check === i ? "" : undefined}
            data-mark={marks.get(i)}
            data-reach={reach?.includes(i) ? (standing.has(i) ? "take" : "go") : undefined}
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
        {hint ? arrow({ ...hint, tint: "blue" }, "hint", "hint") : null}
        {arrows.map((shape) => arrow(shape, "drawn", `${shape.from}-${shape.to}`))}
        {drawing && drawing.from !== drawing.to ? arrow(drawing, "drawn", "drawing") : null}
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
