/**
 * A chess position drawn from FEN. Pieces are Slate's own simple silhouettes drawn as SVG
 * paths on a 100×100 grid, so they look the same on every platform (no emoji fonts).
 */
const BASE = "M24 92 H76 V84 Q76 80 72 80 H28 Q24 80 24 84 Z";
const PIECES: Record<string, string[]> = {
  p: [
    BASE,
    "M36 80 Q38 62 44 54 H56 Q62 62 64 80 Z",
    "M50 24 A13 13 0 1 1 49.9 24 Z M40 52 H60 V46 H40 Z",
  ],
  r: [BASE, "M33 80 L35 46 H65 L67 80 Z", "M30 46 H70 V24 H62 V31 H55 V24 H45 V31 H38 V24 H30 Z"],
  b: [
    BASE,
    "M34 80 Q36 66 44 62 H56 Q64 66 66 80 Z",
    "M50 16 C66 28 68 48 58 60 H42 C32 48 34 28 50 16 Z",
    "M50 6 A5 5 0 1 1 49.9 6 Z",
  ],
  n: [
    BASE,
    "M30 80 C30 66 42 60 44 52 C38 54 31 55 27 50 C24 45 31 38 37 32 C42 24 49 17 59 17 C72 19 75 40 72 56 C70 66 68 72 69 80 Z",
  ],
  q: [
    BASE,
    "M30 80 L24 34 L38 52 L44 26 L50 50 L56 26 L62 52 L76 34 L70 80 Z",
    "M24 30 A4 4 0 1 1 23.9 30 Z M44 22 A4 4 0 1 1 43.9 22 Z M56 22 A4 4 0 1 1 55.9 22 Z M76 30 A4 4 0 1 1 75.9 30 Z",
  ],
  k: [
    BASE,
    "M30 80 L28 50 Q28 38 40 38 H60 Q72 38 72 50 L70 80 Z",
    "M46 8 H54 V16 H62 V24 H54 V38 H46 V24 H38 V16 H46 Z",
  ],
};

export function parseFen(fen: string): (string | null)[][] {
  const rows = fen.split(" ")[0]!.split("/");
  return rows.map((row) => {
    const out: (string | null)[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) out.push(...Array<null>(Number(ch)).fill(null));
      else out.push(ch);
    }
    return out;
  });
}

export function Chessboard({
  fen,
  size = 280,
  light = "#ece4d2",
  dark = "#9c7b57",
  coords = true,
  className = "",
}: {
  fen: string;
  size?: number;
  light?: string;
  dark?: string;
  coords?: boolean;
  className?: string;
}) {
  const board = parseFen(fen);
  const sq = size / 8;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`block max-w-full ${className}`}
      role="img"
      aria-label="Chess position"
      style={{ height: "auto" }}
    >
      {board.map((row, r) =>
        row.map((piece, f) => {
          const isLight = (r + f) % 2 === 0;
          return (
            <g key={`${r}-${f}`}>
              <rect x={f * sq} y={r * sq} width={sq} height={sq} fill={isLight ? light : dark} />
              {coords && f === 0 && (
                <text
                  x={2.5}
                  y={r * sq + 10}
                  fontSize={Math.max(7, sq * 0.2)}
                  fill={isLight ? dark : light}
                  fontFamily="var(--mono)"
                >
                  {8 - r}
                </text>
              )}
              {coords && r === 7 && (
                <text
                  x={f * sq + sq - 7}
                  y={size - 3}
                  fontSize={Math.max(7, sq * 0.2)}
                  fill={isLight ? dark : light}
                  fontFamily="var(--mono)"
                >
                  {"abcdefgh"[f]}
                </text>
              )}
              {piece && (
                <g
                  transform={`translate(${f * sq + sq * 0.07} ${r * sq + sq * 0.05}) scale(${(sq * 0.86) / 100})`}
                  fill={piece === piece.toUpperCase() ? "#fbfaf6" : "#1b1814"}
                  stroke={piece === piece.toUpperCase() ? "#1b1814" : "#f3efe6"}
                  strokeWidth={piece === piece.toUpperCase() ? 3.2 : 2.2}
                  strokeLinejoin="round"
                >
                  {PIECES[piece.toLowerCase()]?.map((d, i) => (
                    <path key={i} d={d} />
                  ))}
                  {piece.toLowerCase() === "n" && (
                    <circle
                      cx="50"
                      cy="32"
                      r="3.2"
                      fill={piece === piece.toUpperCase() ? "#1b1814" : "#f3efe6"}
                      stroke="none"
                    />
                  )}
                </g>
              )}
            </g>
          );
        }),
      )}
    </svg>
  );
}

/** Engine evaluation bar, white's view: +1.0 means white is a pawn better. */
export function EvalBar({
  value,
  height = 280,
  horizontal = false,
}: {
  value: number;
  height?: number;
  horizontal?: boolean;
}) {
  const clamped = Math.max(-5, Math.min(5, value));
  const white = 50 + clamped * 9;
  const label = `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
  if (horizontal) {
    return (
      <div
        className="relative h-2 w-full overflow-hidden rounded-full bg-[#16130f]"
        title={`Evaluation ${label}`}
      >
        <div className="h-full bg-[#fbfaf6]" style={{ width: `${white}%` }} />
      </div>
    );
  }
  return (
    <div
      className="relative w-3 overflow-hidden rounded-sm bg-[#16130f]"
      style={{ height }}
      title={`Evaluation ${label}`}
    >
      <div className="absolute inset-x-0 bottom-0 bg-[#fbfaf6]" style={{ height: `${white}%` }} />
      <span className="absolute inset-x-0 top-1/2 h-px bg-[#c0392b]/60" />
    </div>
  );
}

export function sideToMove(fen: string): "white" | "black" {
  return fen.split(" ")[1] === "b" ? "black" : "white";
}
