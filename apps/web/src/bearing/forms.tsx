import type { GameResult, PlayerLine } from "@bearing/domain";
import { formatPoints, seriesScore } from "@bearing/domain";
import { ChessGame } from "./chessboard";
import type { CSSProperties } from "react";
import {
  type Dot,
  type MatchView,
  type SideView,
  type Stop,
  cupDots,
  rocketClock,
  roundDots,
  roundSlots,
} from "./model";
import { useAtlas } from "../lib/world";
import { Go } from "./links";
import { gameClock } from "./time";
import { Champ, Clockline, Disc, Dots, Role } from "./ui";

/** How much of a League game the line shows: thirty-six minutes, or more once a game runs long. */
function lolSpan(game: GameResult): number {
  return Math.max(36 * 60, (game.clock ?? 0) * 1.04);
}

function rocketSpan(game: GameResult): number {
  return Math.max(300, game.clock ?? 0);
}

const NOW_WIDTH: Record<string, string> = {
  cs2: "2.2fr",
  lol: "2.4fr",
  "rocket-league": "3.2fr",
  chess: "0.62fr",
  trackmania: "1fr",
};

function fill(winner: Stop["winner"], sides: SideView[]): string | undefined {
  if (winner === undefined) return undefined;
  if (winner === "draw")
    return `linear-gradient(90deg, ${sides[0]?.color ?? "var(--ink)"} 50%, ${sides[1]?.color ?? "var(--surface)"} 50%)`;
  return sides[winner]?.color;
}

/**
 * The series as a line of stops. A stop is a map or a game, filled with the colour of whoever
 * won it; the one being played opens into its detail.
 */
export function Stops({ view, stops }: { view: MatchView; stops: Stop[] }) {
  const { sides, discipline } = view;
  const d = discipline.id;
  if (!stops.length) return null;
  const columns = stops
    .map((s) =>
      s.kind === "now" ? (NOW_WIDTH[d] ?? "2fr") : s.kind === "end" ? "0.7fr" : "0.62fr",
    )
    .join(" ");
  return (
    <div className="bx-stops" style={{ gridTemplateColumns: columns }}>
      {stops.map((s, i) => {
        // The stop opens into its detail only when the inside of the game is known.
        const inside =
          s.game && (s.game.rounds || s.game.events || s.game.cup) ? s.game : undefined;
        const g = inside;
        const cls = [
          "bx-stop",
          `bx-stop-${s.kind}`,
          s.kind === "now" && !inside && "bx-stop-tight",
          i === stops.length - 1 && s.kind !== "end" && "bx-stop-last",
        ]
          .filter(Boolean)
          .join(" ");
        const colour =
          s.kind === "now" && !view.solo
            ? fill("draw", sides)
            : s.kind === "done"
              ? fill(s.winner, sides)
              : undefined;
        return (
          <div key={i} className={cls} style={{ "--sf": colour } as CSSProperties}>
            {g && d === "cs2" ? (
              <Dots
                dots={[
                  ...roundDots(g, sides, 0, 12),
                  { k: "gap" },
                  ...roundDots(g, sides, 12, roundSlots(g)),
                ]}
                sides={sides}
              />
            ) : null}
            {g && d === "lol" ? (
              <Clockline
                events={g.events ?? []}
                sides={sides}
                span={lolSpan(g)}
                at={g.clock ?? 0}
                live
              />
            ) : null}
            {g && d === "rocket-league" ? (
              <Clockline
                events={g.events ?? []}
                sides={sides}
                span={rocketSpan(g)}
                at={g.clock ?? 0}
                live
              />
            ) : null}
            {g && view.solo ? <Dots dots={cupDots(g, sides)} sides={sides} size={15} fix /> : null}
            <b>{s.label}</b>
            <span className="bx-stop-sub">{s.sub}</span>
          </div>
        );
      })}
    </div>
  );
}

function tally(dots: Dot[]): string {
  const won = (side: number) => dots.filter((x) => x.k === "won" && x.side === side).length;
  return `${won(0)}–${won(1)}`;
}

/** Rounds above the line for one side and below it for the other: the momentum of a map. */
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
      <div className="bx-plot" aria-hidden>
        {row(0)}
        <i className="bx-axis" />
        {row(1)}
      </div>
      <span className="bx-sub">
        Momentum: {sides[0]?.name} above the line, {sides[1]?.name} below
      </span>
    </>
  );
}

/** A game not yet played is either certain to come or only needed if the series goes on. */
function toCome(view: MatchView, index: number): string {
  if (view.match.status === "finished") return "not needed";
  const played = view.match.games.filter((g) => g.status === "finished").length;
  const need = Math.floor(view.match.bestOf / 2) + 1;
  const lead = Math.max(0, ...seriesScore(view.match));
  return index < played + (need - lead) ? "to come" : "if needed";
}

const LANE = ["top", "jungle", "mid", "bot", "support"];
const lane = (line: PlayerLine) => {
  const at = LANE.indexOf((line.role ?? "").toLowerCase());
  return at < 0 ? LANE.length : at;
};
const thousands = (n: number) => `${(n / 1000).toFixed(1)}k`;

/**
 * A game of League of Legends as it was played: lane against lane, each player with the
 * champion they took and their kills, deaths and assists, and beneath them what each side
 * denied the other.
 */
function Scoreboard({ game }: { game: GameResult }) {
  const atlas = useAtlas();
  const { draft, lines } = game;
  if (!draft && !lines?.length) return null;
  const patch = draft?.patch;
  const of = (side: number) =>
    (lines ?? []).filter((l) => l.side === side).sort((x, y) => lane(x) - lane(y));
  const [left, right] = [of(0), of(1)];
  const rows = Math.max(left.length, right.length, lines?.length ? 0 : 5);
  const half = (line: PlayerLine | undefined, side: number, row: number) => {
    const name = line?.champion ?? draft?.picks[side]?.[row]?.name;
    const champion = name
      ? (draft?.picks[side]?.find((c) => c.name === name) ?? { name })
      : undefined;
    const who = (line?.playerId ? atlas.player(line.playerId)?.handle : undefined) ?? line?.handle;
    return (
      <span className="bx-score-half" data-side={side}>
        {champion ? <Champ champion={champion} patch={patch} /> : <span className="bx-champ" />}
        {line ? (
          <>
            {line.playerId ? (
              <Go to={{ kind: "player", id: line.playerId }} className="bx-score-name">
                {who ?? champion?.name}
              </Go>
            ) : (
              <span className="bx-score-name">{who ?? champion?.name}</span>
            )}
            {line.gold !== undefined ? (
              <span className="bx-score-gold">{thousands(line.gold)}</span>
            ) : null}
            <span className="bx-score-kda">
              <b>{line.kills}</b>–{line.deaths}–{line.assists}
            </span>
          </>
        ) : (
          <span className="bx-score-name">{champion?.name}</span>
        )}
      </span>
    );
  };
  return (
    <div className="bx-score">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="bx-score-row">
          {half(left[row], 0, row)}
          <Role role={left[row]?.role ?? right[row]?.role ?? LANE[row]} bare />
          {half(right[row], 1, row)}
        </div>
      ))}
      {draft?.bans.some((b) => b.length) ? (
        <div className="bx-score-row bx-score-bans">
          {[0, 1].flatMap((side) => [
            side ? <span key="mid" /> : null,
            <span key={side} className="bx-score-half" data-side={side}>
              {(draft.bans[side] ?? []).map((c) => (
                <Champ key={c.name} champion={c} patch={patch} size={20} out />
              ))}
            </span>,
          ])}
        </div>
      ) : null}
    </div>
  );
}

/** One map or game of a series, in the full form for its game. */
export function GameRow({
  game,
  index,
  view,
}: {
  game: GameResult;
  index: number;
  view: MatchView;
}) {
  const { sides, discipline } = view;
  const d = discipline.id;
  const live = game.status === "live";
  const done = game.status === "finished";
  const unit = `${discipline.unit.one} ${index + 1}`;
  const winner = typeof game.winner === "number" ? sides[game.winner]?.label : undefined;

  if (game.status === "scheduled") {
    return (
      <div className="bx-game">
        <div className="bx-gamehead">
          <b>{game.label}</b>
          <span className="bx-sub bx-mono">
            {d === "cs2" ? `${unit} · ` : ""}
            {toCome(view, index)}
          </span>
        </div>
      </div>
    );
  }

  // Only the result of the game is known, not what happened in it.
  if (!game.rounds && !game.events && !game.scores && !game.chess && !game.cup) {
    const length = game.clock ? ` · ${Math.round(game.clock / 60)} min` : "";
    return (
      <div className="bx-game">
        <div className="bx-gamehead">
          <b>{game.label}</b>
          <span className="bx-sub bx-mono">
            {live ? "being played" : winner ? `${winner} won${length}` : "played"}
            {game.detail ? ` · ${game.detail}` : ""}
          </span>
        </div>
      </div>
    );
  }

  if (d === "cs2") {
    const halves: Dot[][] = [];
    for (let i = 0; i < roundSlots(game); i += 12) {
      const row = roundDots(game, sides, i, i + 12);
      if (row.length) halves.push(row);
    }
    return (
      <div className="bx-game">
        <div className="bx-gamehead">
          <b>{game.label}</b>
          <span className="bx-sub bx-mono">
            {unit} · {live ? "first to 13" : (game.scores?.join("–") ?? "")}
            {game.detail && done ? ` · ${game.detail}` : ""}
          </span>
        </div>
        {halves.map((row, i) => (
          <div key={i} className="bx-half">
            <Dots dots={row} sides={sides} gap={4} />
            <span>{tally(row)}</span>
          </div>
        ))}
        {live ? <Momentum game={game} sides={sides} /> : null}
      </div>
    );
  }

  if (d === "lol") {
    const span = lolSpan(game);
    const marks = Array.from({ length: Math.floor(span / 600) + 1 }, (_, i) => ({
      at: i * 600,
      text: String(i * 10),
    }));
    const minutes = Math.round((game.clock ?? 0) / 60);
    return (
      <div className="bx-game">
        <div className="bx-gamehead">
          <b>{game.label}</b>
          <span className="bx-sub bx-mono">
            {live ? gameClock(game.clock ?? 0) : `${winner ?? ""} · ${minutes} min`}
            {game.scores ? ` · kills ${game.scores.join("–")}` : ""}
          </span>
        </div>
        {game.events ? (
          <Clockline
            events={game.events}
            sides={sides}
            span={span}
            at={game.clock ?? 0}
            live={live}
            two
            labels={marks}
          />
        ) : null}
        <Scoreboard game={game} />
      </div>
    );
  }

  if (d === "rocket-league") {
    if (live) {
      const overtime = (game.clock ?? 0) > 300;
      return (
        <div className="bx-game">
          <div className="bx-gamehead">
            <b>{game.label}</b>
            <span className="bx-sub bx-mono">
              {overtime ? `overtime ${rocketClock(game)}` : `${rocketClock(game)} left`}
            </span>
          </div>
          <Clockline
            events={game.events ?? []}
            sides={sides}
            span={rocketSpan(game)}
            at={game.clock ?? 0}
            live
            labels={[
              { at: 0, text: "5:00" },
              { at: 150, text: "2:30" },
              { at: 300, text: "0:00", end: !overtime },
            ]}
          />
        </div>
      );
    }
    const goals: Dot[] = (game.events ?? []).map((e) => ({
      k: "won",
      side: e.side,
      label: `${sides[e.side]?.name ?? ""} · ${e.at > 300 ? "overtime" : gameClock(300 - e.at)}`,
    }));
    return (
      <div className="bx-game">
        <div className="bx-gamehead">
          <span>
            <b>{game.label}</b>{" "}
            <span className="bx-sub bx-mono">
              {game.scores?.join("–")}
              {game.detail ? ` · ${game.detail}` : ""}
            </span>
          </span>
          <Dots dots={goals} sides={sides} size={10} gap={3} fix />
        </div>
      </div>
    );
  }

  if (d === "chess") {
    const white = sides[game.firstSide ?? 0];
    const parts = game.detail?.split(" · ") ?? [];
    const opening = parts.length > 1 ? parts[0] : undefined;
    const length = done ? parts.at(-1) : undefined;
    const result = game.winner === "draw" ? "draw" : `${winner ?? ""} won`;
    return (
      <div className="bx-game">
        <div className="bx-gamehead">
          <b>{game.label}</b>
          <span className="bx-sub bx-mono">
            {live ? `move ${game.chess?.move ?? 1}` : `${result}${length ? ` · ${length}` : ""}`}
          </span>
        </div>
        {opening ? <span className="bx-sub">{opening}</span> : null}
        {game.moves?.length ? (
          <ChessGame
            moves={game.moves}
            live={live}
            white={white?.name ?? "White"}
            black={sides[1 - (game.firstSide ?? 0)]?.name ?? "Black"}
          />
        ) : (
          <span className="bx-sub">
            {white?.name} {live ? "has" : "had"} the white pieces.
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bx-game">
      <div className="bx-gamehead">
        <b>{game.label}</b>
        <span className="bx-sub bx-mono">{live ? "live" : (winner ?? "")}</span>
      </div>
    </div>
  );
}

/** Chess: a row per player, so the points can be read off. A full dot is a win, a small one a draw. */
export function ChessLanes({ view }: { view: MatchView }) {
  const { sides, match } = view;
  const games = match.games.filter((g) => g.status === "finished");
  const points = (side: number) =>
    games.reduce((sum, g) => sum + (g.winner === side ? 1 : g.winner === "draw" ? 0.5 : 0), 0);
  return (
    <div className="bx-game">
      <div className="bx-gamehead">
        <b>The match</b>
        <span className="bx-sub bx-mono">
          {games.length} of {match.bestOf} played
        </span>
      </div>
      {sides.map((side, s) => (
        <div key={s} className="bx-lane">
          <span>{side.name}</span>
          <span
            className="bx-dots bx-fix"
            style={{ "--ds": "13px", "--dg": "5px" } as CSSProperties}
          >
            {games.map((g, i) => (
              <i
                key={i}
                className={
                  g.winner === s ? undefined : g.winner === "draw" ? "bx-dot-half" : "bx-dot-none"
                }
                style={
                  g.winner === s || g.winner === "draw" ? { background: side.color } : undefined
                }
                title={`Game ${i + 1} · ${g.winner === s ? "won" : g.winner === "draw" ? "draw" : "lost"}`}
              />
            ))}
          </span>
          <span>{formatPoints(points(s))}</span>
        </div>
      ))}
      <span className="bx-sub" style={{ marginTop: 8 }}>
        A full dot is a win, a small one a draw.
      </span>
    </div>
  );
}

/** A field of drivers: a row each, with the rounds they have won and their points. */
export function CupStandings({ view }: { view: MatchView }) {
  const game = view.game ?? view.match.games.at(-1);
  const rounds = game?.cup?.rounds ?? [];
  const limit = game?.cup?.limit;
  const atLimit = view.standings.filter((s) => s.finalist).map((s) => s.side.name);
  return (
    <div className="bx-game">
      <div className="bx-gamehead">
        <b>{game?.label ?? "Standings"}</b>
        <span className="bx-sub bx-mono">
          {limit ? `first to ${limit}, then one round` : "points"}
        </span>
      </div>
      {view.standings.map(({ side, index, points }) => (
        <div key={index} className="bx-lane">
          <Go to={{ kind: "player", id: side.id ?? "" }}>
            <Disc side={side} size={18} />
            {side.name}
          </Go>
          <Dots
            dots={rounds
              .filter((order) => order[0] === index)
              .map((): Dot => ({ k: "won", side: index, label: "Round won" }))}
            sides={view.sides}
            gap={4}
            fix
          />
          <span>{formatPoints(points)}</span>
        </div>
      ))}
      {atLimit.length && view.live ? (
        <span className="bx-sub" style={{ marginTop: 9 }}>
          {atLimit.join(" and ")} {atLimit.length === 1 ? "is" : "are"} at the limit and{" "}
          {atLimit.length === 1 ? "wins" : "win"} the match with a round win.
        </span>
      ) : null}
    </div>
  );
}

/** The places one driver took, round by round. Filled when they won the round. */
export function CupPlaces({ view, index }: { view: MatchView; index: number }) {
  const game = view.game ?? view.match.games.at(-1);
  const rounds = game?.cup?.rounds ?? [];
  const side = view.sides[index];
  if (!side || !rounds.length) return null;
  return (
    <div className="bx-game">
      <div className="bx-gamehead">
        <b>{side.name}, round by round</b>
        <span className="bx-sub bx-mono">place</span>
      </div>
      <span
        className="bx-dots bx-fix bx-wrap"
        style={{ "--ds": "18px", "--dg": "4px" } as CSSProperties}
      >
        {rounds.map((order, i) => {
          const place = order.indexOf(index) + 1;
          return (
            <i
              key={i}
              className={place === 1 ? "bx-dot-num" : "bx-dot-num bx-dot-open"}
              style={place === 1 ? { background: side.color } : undefined}
              title={`Round ${i + 1} · place ${place}`}
            >
              {place}
            </i>
          );
        })}
        {game?.status === "live" ? <i className="bx-dot-now" /> : null}
      </span>
    </div>
  );
}
