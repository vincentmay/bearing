import "./chess.css";

import {
  CHESS_START,
  CHESS_START_FEN,
  type ChessPly,
  MATE,
  chessDests,
  chessLine,
  chessMove,
  chessTurn,
  replayChess,
} from "@bearing/domain";
import {
  ArrowUpDown,
  Check,
  ChevronLeft,
  Clock,
  ChevronRight,
  Copy,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Undo2,
} from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useGameJudgements, useJudgement } from "../../lib/engine";
import { BOARDS, PIECES, setPrefs, usePrefs } from "../../lib/prefs";
import type { SideView } from "../model";
import { Disc, Flag, Ping } from "../ui";
import { Board, type Shape, type Verdict } from "./board";
import { MARKS, chances, clock, markOf, said, written } from "./judge";
import { follow, taken } from "./men";

/** Who sits on one side of the board, and what is known of them. */
export interface Seat {
  side: SideView;
  title?: string;
  rating?: number;
  country?: string;
}

/** A line of the viewer's own, leaving the game after so many of its moves. */
interface Own {
  from: number;
  plies: ChessPly[];
  at: number;
}

const BOARD_NAMES: Record<string, string> = {
  indigo: "Indigo",
  ink: "Ink",
  slate: "Slate",
  green: "Green",
  walnut: "Walnut",
};
const PIECE_NAMES: Record<string, string> = {
  mpchess: "Modern",
  cburnett: "Classic",
  merida: "Merida",
};

/** The board that the keyboard speaks to: the one last touched, or the first on the page. */
let spoken: symbol | undefined;

/** The last value that was not undefined: a figure that is being worked out keeps standing. */
function useHeld<T>(value: T | undefined, first: T): T {
  const held = useRef(first);
  if (value !== undefined) held.current = value;
  return held.current;
}

/** The number a move is written with: "12." for White, "12…" for Black where a line starts. */
function numbered(ply: number, first: boolean): string {
  if (ply % 2 === 0) return `${ply / 2 + 1}.`;
  return first ? `${(ply - 1) / 2 + 1}…` : "";
}

/**
 * A game of chess to follow and to look into.
 *
 * It opens on the latest position and stays with a game that is being played; stepping back,
 * or picking a move, lets go of that until the viewer returns. Beside the board stands how an
 * engine judges the position; under it the same judgement through the whole game, which can
 * be pointed at; around it the two players, what each has taken, and their clocks, which run
 * while the game does.
 *
 * The pieces can be moved. A move other than the one played starts a line of the viewer's
 * own, which the engine judges like any position, and from which one press leads back.
 */
export function ChessGame({
  moves,
  evals,
  clocks,
  live,
  movedAt,
  result,
  white,
  black,
  opening,
  name,
  state,
}: {
  /** The line over the board: which game it is, and where it stands. */
  name?: string;
  state?: string;
  moves: string[];
  evals?: number[];
  clocks?: number[];
  live: boolean;
  /** When the latest move was made, where that is known: the clocks run from then. */
  movedAt?: number;
  /** Who won, once it is over: White (0), Black (1), or nobody. */
  result?: 0 | 1 | "draw";
  white: Seat;
  black: Seat;
  opening?: string;
}) {
  const prefs = usePrefs();
  const plies = useMemo(() => replayChess(moves), [moves]);
  const tracks = useMemo(() => follow(plies), [plies]);
  const [at, setAt] = useState(plies.length);
  const [following, setFollowing] = useState(true);
  const [own, setOwn] = useState<Own>();
  const [playing, setPlaying] = useState(false);
  const [turned, setTurned] = useState(false);
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState<string>();
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const me = useRef(Symbol("board"));

  // A new move arrives: go with it, unless the viewer is looking at something else.
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
    }, 950);
    return () => clearInterval(timer);
  }, [playing, plies.length]);

  // ---- Where the board stands ----
  const base = own ? own.from : at;
  const ownTracks = useMemo(
    () =>
      own
        ? follow(own.plies, tracks[own.from], plies[own.from - 1]?.squares ?? CHESS_START)
        : undefined,
    [own, tracks, plies],
  );
  const shown = own && own.at > 0 ? own.plies[own.at - 1] : plies[base - 1];
  const men = (own ? ownTracks?.[own.at] : tracks[at]) ?? tracks[0]!;
  const fen = shown?.fen ?? CHESS_START_FEN;
  const squares = shown?.squares ?? CHESS_START;
  const played = base + (own?.at ?? 0);
  const toMove = played % 2;
  const dests = useMemo(() => chessDests(fen), [fen]);
  const atEnd = !own && at === plies.length;
  const over = !live && atEnd;

  // ---- Moving through it ----
  const go = (to: number) => {
    const next = Math.max(0, Math.min(plies.length, to));
    setPlaying(false);
    setOwn(undefined);
    setAt(next);
    setFollowing(next === plies.length);
  };
  const step = (by: number) => {
    if (!own) return go(at + by);
    const next = own.at + by;
    if (next <= 0) return setOwn(undefined);
    setOwn({ ...own, at: Math.min(own.plies.length, next) });
  };
  /** Add moves to the viewer's own line from the position shown. */
  const explore = (more: ChessPly[]) => {
    if (!more.length) return;
    setPlaying(false);
    setFollowing(false);
    setOwn(
      own
        ? { ...own, plies: [...own.plies.slice(0, own.at), ...more], at: own.at + more.length }
        : { from: at, plies: more, at: more.length },
    );
  };
  const move = (from: number, to: number, promote?: "q" | "r" | "b" | "n") => {
    const ply = chessMove(fen, from, to, promote);
    if (!ply) return;
    // The move the game itself made next is a step forward, not a line of one's own.
    const next = own ? own.plies[own.at] : plies[at];
    if (next?.san === ply.san) return step(1);
    explore([ply]);
  };

  // ---- The keyboard ----
  useEffect(() => {
    const mine = me.current;
    spoken ??= mine;
    return () => {
      if (spoken === mine) spoken = undefined;
    };
  }, []);
  const keys = useRef({ step, go, end: plies.length });
  keys.current = { step, go, end: plies.length };
  useEffect(() => {
    const press = (event: KeyboardEvent) => {
      if (spoken !== me.current || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      const now = keys.current;
      if (event.key === "ArrowLeft") now.step(-1);
      else if (event.key === "ArrowRight") now.step(1);
      else if (event.key === "ArrowUp" || event.key === "Home") now.go(0);
      else if (event.key === "ArrowDown" || event.key === "End") now.go(now.end);
      else if (event.key === "f") setTurned((on) => !on);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", press);
    return () => window.removeEventListener("keydown", press);
  }, []);

  // Keep the move being shown in sight within the list, without moving the page.
  useEffect(() => {
    const box = list.current;
    const el = box?.querySelector<HTMLElement>("[aria-current]");
    if (!el || !box) return;
    const [inner, outer] = [el.getBoundingClientRect(), box.getBoundingClientRect()];
    if (inner.top < outer.top || inner.bottom > outer.bottom)
      box.scrollTo({
        top: box.scrollTop + inner.top - outer.top - outer.height / 2,
        behavior: "smooth",
      });
    if (inner.left < outer.left || inner.right > outer.right)
      box.scrollTo({
        left: box.scrollLeft + inner.left - outer.left - outer.width / 2,
        behavior: "smooth",
      });
  }, [at]);

  // The menu closes on a press anywhere else, and on Escape.
  useEffect(() => {
    if (!menu) return;
    const away = (event: globalThis.PointerEvent) => {
      if (!(event.target as HTMLElement).closest(".bx-chess-menu, [data-menu]")) setMenu(false);
    };
    const key = (event: KeyboardEvent) => event.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [menu]);

  // ---- The engine ----
  const judgement = useJudgement(shown?.mate ? undefined : fen, prefs.engine);
  const fens = useMemo(() => plies.map((ply) => ply.fen), [plies]);
  const glance = useGameJudgements(fens, prefs.engine);
  /** The judgement after each move of the game: the game's own notes first, then the engine's. */
  const judged = useMemo(
    () => plies.map((_, i) => evals?.[i] ?? glance[i]),
    [plies, evals, glance],
  );
  const mated = shown?.mate ? (chessTurn(fen) === 0 ? -MATE : MATE) : undefined;
  const value =
    mated ??
    (!own && at > 0 ? evals?.[at - 1] : undefined) ??
    judgement?.pawns ??
    (!own && at > 0 ? glance[at - 1] : undefined);
  const now = useHeld(value, 0.2);
  const judging = prefs.engine || !!evals?.length;
  const share = 50 + 50 * chances(now);
  const expected = useMemo(
    () => (judgement && !mated ? chessLine(fen, judgement.line, 7) : []),
    [fen, judgement, mated],
  );
  const hint: Shape | undefined =
    prefs.engine && prefs.hint && expected[0]
      ? { from: expected[0].from, to: expected[0].to }
      : undefined;
  const marks = useMemo(
    () =>
      judged.map((after, i) => {
        const before = i === 0 ? 0.2 : judged[i - 1];
        return after === undefined || before === undefined
          ? undefined
          : markOf(before, after, i % 2 === 0);
      }),
    [judged],
  );
  const curve = useMemo(() => {
    if (judged.filter((v) => v !== undefined).length < 2 || judged.length < 3) return undefined;
    let last = 0.2;
    const points = judged.map((v, i) => {
      last = v ?? last;
      return `${i},${(20 - chances(last) * 19).toFixed(2)}`;
    });
    return {
      line: `M${points.join("L")}`,
      area: `M0,20L${points.join("L")}L${judged.length - 1},20Z`,
    };
  }, [judged]);

  // ---- The clocks ----
  const running = live && atEnd && !!movedAt && result === undefined;
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setTick(Date.now());
    const timer = setInterval(() => setTick(Date.now()), 500);
    return () => clearInterval(timer);
  }, [running, movedAt]);
  /** The clock of the player with White (0) or Black (1) as it stood at the move shown. */
  const left = (colour: number) => {
    if (!clocks) return undefined;
    for (let i = base - 1; i >= 0; i--) {
      if (i % 2 === colour && (clocks[i] ?? -1) >= 0) {
        const spent = running && toMove === colour ? Math.max(0, (tick - movedAt!) / 1000) : 0;
        return Math.max(0, clocks[i]! - spent);
      }
    }
    return undefined;
  };

  const material = taken(squares);
  const check = shown?.check ? squares.indexOf(toMove === 0 ? "K" : "k") : undefined;
  const verdicts: Verdict[] | undefined =
    over && result !== undefined
      ? result === "draw"
        ? [
            { square: squares.indexOf("K"), mark: "drew" },
            { square: squares.indexOf("k"), mark: "drew" },
          ]
        : [{ square: squares.indexOf(result === 0 ? "K" : "k"), mark: "won" }]
      : undefined;

  const seat = (who: Seat, colour: number) => {
    const time = left(colour);
    const mine = colour === 0 ? material.white : material.black;
    const ahead = colour === 0 ? material.lead : -material.lead;
    // Without a face, the disc is the colour of the pieces they have.
    const side: SideView = who.side.image
      ? who.side
      : { ...who.side, color: colour ? "#000" : "#fff", ink: colour ? "#fff" : "#000" };
    return (
      <div
        className="bx-seat"
        data-colour={colour ? "black" : "white"}
        data-face={who.side.image ? "" : undefined}
        data-turn={!over && toMove === colour ? "" : undefined}
      >
        <Disc side={side} size={30} />
        <span className="bx-seat-who">
          <b>
            {who.title ? <i>{who.title}</i> : null}
            {who.side.name}
          </b>
          <span className="bx-sub">
            <Flag country={who.country} />
            {who.rating ?? ""}
            {mine.length ? (
              <span className="bx-taken" aria-label={`Has taken ${mine.length}`}>
                {mine.map((piece, i) => (
                  <img
                    key={i}
                    data-new={piece !== mine[i - 1] ? "" : undefined}
                    src={`/chessmen/${prefs.pieces}/${colour ? "w" : "b"}${piece.toUpperCase()}.svg`}
                    alt=""
                  />
                ))}
                {ahead > 0 ? <em>+{ahead}</em> : null}
              </span>
            ) : null}
          </span>
        </span>
        {time !== undefined ? (
          <span
            className="bx-clock bx-num"
            data-on={!over && !own && toMove === colour ? "" : undefined}
            data-low={running && toMove === colour && time < 20 ? "" : undefined}
            aria-label={`${colour ? "Black" : "White"}'s clock`}
          >
            {!over && !own && toMove === colour ? <Clock size={15} strokeWidth={2.4} /> : null}
            {clock(time)}
          </span>
        ) : null}
      </div>
    );
  };

  const pick = (event: PointerEvent<SVGSVGElement>) => {
    if (event.type === "pointermove" && event.buttons !== 1) return;
    const box = event.currentTarget.getBoundingClientRect();
    const part = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
    go(Math.round(part * (judged.length - 1)) + 1);
  };

  const copy = (what: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(undefined), 1400);
    });
  };
  const record = () => {
    const words = plies.map((ply, i) => (i % 2 ? ply.san : `${i / 2 + 1}. ${ply.san}`));
    const end =
      result === undefined ? "*" : result === "draw" ? "1/2-1/2" : result === 0 ? "1-0" : "0-1";
    return `${words.join(" ")} ${end}`;
  };

  const [top, bottom] = turned ? [white, black] : [black, white];
  const pairs = Array.from({ length: Math.ceil(plies.length / 2) }, (_, n) => n);
  const code = /^[A-E]\d\d /.test(opening ?? "") ? opening!.slice(0, 3) : undefined;
  const label = shown
    ? `Position after ${Math.ceil(played / 2)}${played % 2 ? "." : "…"} ${shown.san}`
    : "The starting position";

  const key = (
    name: string,
    act: () => void,
    icon: ReactNode,
    more?: { disabled?: boolean; main?: boolean; pressed?: boolean; menu?: boolean },
  ) => (
    <button
      type="button"
      onClick={act}
      disabled={more?.disabled}
      aria-label={name}
      title={name}
      data-main={more?.main ? "" : undefined}
      data-menu={more?.menu ? "" : undefined}
      aria-pressed={more?.pressed}
      aria-expanded={more?.menu ? menu : undefined}
    >
      {icon}
    </button>
  );

  return (
    <div
      className="bx-chess"
      ref={root}
      data-board={prefs.board}
      data-judging={judging ? "" : undefined}
      onPointerDown={() => {
        spoken = me.current;
      }}
    >
      {name ? (
        <div className="bx-cap bx-chess-name">
          <span>{name}</span>
          {state ? <span>{state}</span> : null}
        </div>
      ) : null}
      <div className="bx-chess-main">
        {seat(top, turned ? 0 : 1)}
        <div className="bx-chess-table">
          {judging ? (
            <div
              className="bx-eval"
              data-turned={turned ? "" : undefined}
              data-ahead={now >= 0 ? "white" : "black"}
              data-thinking={judgement?.thinking ? "" : undefined}
              style={{ "--w": `${share}%` } as CSSProperties}
              role="img"
              aria-label={`The engine's judgement: ${written(now)} for ${now >= 0 ? "White" : "Black"}`}
            >
              <i />
            </div>
          ) : null}
          <Board
            men={men}
            set={prefs.pieces}
            turned={turned}
            last={shown ? { from: shown.from, to: shown.to } : undefined}
            check={check}
            dests={dests}
            onMove={move}
            hint={hint}
            verdicts={verdicts}
            label={label}
          />
        </div>
        {seat(bottom, turned ? 1 : 0)}
      </div>

      <div className="bx-chess-keys">
        {key("To the start", () => go(0), <SkipBack size={15} />, { disabled: played === 0 })}
        {key("One move back", () => step(-1), <ChevronLeft size={19} />, {
          disabled: played === 0,
        })}
        {key(
          playing ? "Pause" : "Play the game through",
          () => {
            if (playing) return setPlaying(false);
            setOwn(undefined);
            // From the end, playing starts over.
            if (at >= plies.length || own) setAt(own ? own.from : 0);
            setFollowing(false);
            setPlaying(true);
          },
          playing ? <Pause size={15} /> : <Play size={15} />,
          { main: true },
        )}
        {key("One move on", () => step(1), <ChevronRight size={19} />, {
          disabled: own ? own.at >= own.plies.length : at >= plies.length,
        })}
        {key(
          live ? "To the move being played" : "To the end",
          () => go(plies.length),
          <SkipForward size={15} />,
          { disabled: atEnd },
        )}
        <span className="bx-chess-keys-gap" />
        {key("Turn the board", () => setTurned((on) => !on), <ArrowUpDown size={15} />, {
          pressed: turned,
        })}
        {key(
          "Board, pieces and engine",
          () => setMenu((on) => !on),
          <SlidersHorizontal size={15} />,
          {
            menu: true,
          },
        )}
        {menu ? (
          <div className="bx-chess-menu" role="dialog" aria-label="Board, pieces and engine">
            <span className="bx-kicker">Board</span>
            <div className="bx-swatches">
              {BOARDS.map((name) => (
                <button
                  key={name}
                  type="button"
                  data-board={name}
                  aria-pressed={prefs.board === name}
                  onClick={() => setPrefs({ board: name })}
                >
                  <i />
                  {BOARD_NAMES[name]}
                </button>
              ))}
            </div>
            <span className="bx-kicker">Pieces</span>
            <div className="bx-swatches">
              {PIECES.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={prefs.pieces === name}
                  onClick={() => setPrefs({ pieces: name })}
                >
                  <img src={`/chessmen/${name}/wN.svg`} alt="" />
                  {PIECE_NAMES[name]}
                </button>
              ))}
            </div>
            <span className="bx-kicker">Engine</span>
            <button
              type="button"
              className="bx-chess-switch"
              role="switch"
              aria-checked={prefs.engine}
              onClick={() => setPrefs({ engine: !prefs.engine })}
            >
              Judge the position
              <i />
            </button>
            <button
              type="button"
              className="bx-chess-switch"
              role="switch"
              aria-checked={prefs.engine && prefs.hint}
              disabled={!prefs.engine}
              onClick={() => setPrefs({ hint: !prefs.hint })}
            >
              Draw the best move
              <i />
            </button>
            <span className="bx-kicker">Copy</span>
            <div className="bx-chess-copy">
              <button type="button" onClick={() => copy("fen", fen)}>
                {copied === "fen" ? <Check size={14} /> : <Copy size={14} />}
                Position
              </button>
              <button type="button" onClick={() => copy("pgn", record())}>
                {copied === "pgn" ? <Check size={14} /> : <Copy size={14} />}
                Moves
              </button>
            </div>
          </div>
        ) : null}
        {live ? (
          <button
            type="button"
            className="bx-chess-live"
            data-with={atEnd ? "" : undefined}
            onClick={() => go(plies.length)}
            aria-label={atEnd ? "Following the game as it is played" : "Back to the live move"}
          >
            <Ping />
            {atEnd
              ? `Live · ${toMove ? "Black" : "White"} to move`
              : `Back to live${plies.length - base > 0 ? ` · ${plies.length - base} on` : ""}`}
          </button>
        ) : null}
      </div>

      <div className="bx-chess-side">
        {judging || curve ? (
          <div className="bx-cap">
            <span>The engine</span>
            {judgement && !mated ? (
              <span>
                {judgement.by === "Stockfish" ? "Stockfish 19" : "Lichess"} · depth{" "}
                {judgement.depth}
              </span>
            ) : null}
          </div>
        ) : null}
        {judging || curve ? (
          <div className="bx-engine" data-ahead={now >= 0 ? "white" : "black"}>
            <div className="bx-engine-top">
              <b className="bx-num">{written(now)}</b>
              <span>{said(now)}</span>
            </div>
            <div
              className="bx-engine-bar"
              style={{ "--w": `${share}%` } as CSSProperties}
              aria-hidden
            >
              <i />
            </div>
            {prefs.engine && !mated && (expected.length || !judgement) ? (
              <span className="bx-engine-line">
                {expected.length ? (
                  expected.map((ply, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => explore(expected.slice(0, i + 1))}
                      title="Play this line on the board"
                    >
                      <i>{numbered(played + i, i === 0)}</i>
                      {ply.san}
                    </button>
                  ))
                ) : (
                  <span className="bx-engine-wait">Looking at the position…</span>
                )}
              </span>
            ) : null}
            {curve ? (
              <svg
                className="bx-evalgraph"
                viewBox={`0 0 ${judged.length - 1} 40`}
                preserveAspectRatio="none"
                onPointerDown={pick}
                onPointerMove={pick}
                role="img"
                aria-label="The engine's judgement through the game; point at it to go to a move"
              >
                <path data-area="" d={curve.area} />
                <path data-line="" d={curve.line} />
                {base > 0 ? (
                  <line
                    data-at=""
                    x1={Math.min(base, judged.length) - 1}
                    x2={Math.min(base, judged.length) - 1}
                    y1="0"
                    y2="40"
                  />
                ) : null}
              </svg>
            ) : null}
          </div>
        ) : null}
        {own ? (
          <div className="bx-cap">
            <span>Your line</span>
          </div>
        ) : null}
        {own ? (
          <div className="bx-ownline">
            <div>
              {own.plies.map((ply, i) => (
                <button
                  key={i}
                  type="button"
                  aria-current={own.at === i + 1 ? "step" : undefined}
                  onClick={() => setOwn({ ...own, at: i + 1 })}
                >
                  <i>{numbered(own.from + i, i === 0)}</i>
                  {ply.san}
                </button>
              ))}
            </div>
            <button type="button" className="bx-ownline-back" onClick={() => setOwn(undefined)}>
              <Undo2 size={14} />
              Back to the game
            </button>
          </div>
        ) : null}
        <div className="bx-cap">
          <span>Moves</span>
          {opening ? (
            <span className="bx-chess-opening" title={opening}>
              {code ? <i>{code}</i> : null}
              {code ? opening.slice(4) : opening}
            </span>
          ) : null}
        </div>
        <ol className="bx-moves" ref={list} data-dim={own ? "" : undefined}>
          {pairs.map((n) => (
            <li key={n}>
              <i className="bx-num">{n + 1}</i>
              {[0, 1].map((half) => {
                const index = n * 2 + half;
                const ply = plies[index];
                const mark = marks[index];
                return ply ? (
                  <button
                    key={half}
                    type="button"
                    aria-current={!own && at === index + 1 ? "step" : undefined}
                    data-branch={own && own.from === index + 1 ? "" : undefined}
                    onClick={() => go(index + 1)}
                  >
                    {ply.san}
                    {mark ? (
                      <em data-mark={mark} title={MARKS[mark]}>
                        {mark}
                      </em>
                    ) : null}
                  </button>
                ) : (
                  <span key={half} />
                );
              })}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
