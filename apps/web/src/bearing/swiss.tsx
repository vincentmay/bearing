import {
  type Match,
  type Stage,
  type SwissRecord,
  type Tournament,
  swissRecords,
  winnerOf,
} from "@bearing/domain";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Star } from "lucide-react";
import { type RefObject, useEffect, useState } from "react";
import { scoreLine } from "../lib/view";
import type { Board } from "./board";
import { Go } from "./links";
import { sideOf } from "./model";
import { Disc, Ping } from "./ui";

/** The width an element has been given, kept up to date. Zero until it has been measured. */
export function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const watch = new ResizeObserver(() => setWidth(el.clientWidth));
    watch.observe(el);
    return () => watch.disconnect();
  }, [ref]);
  return width;
}

const COUNT = ["None", "One", "Two", "Three", "Four", "Five", "Six"];
const count = (n: number) => COUNT[n] ?? String(n);

interface Rung {
  wins: number;
  losses: number;
  /** Teams at this record with no match drawn yet. */
  teams: SwissRecord[];
  /** The matches being played, or still to be played, between teams at this record. */
  pairs: Match[];
}

/** A team on the ladder: its mark, its name and its record. A tap tells its way through. */
function TeamChip({
  record,
  board,
  picked,
  onPick,
}: {
  record: SwissRecord;
  board: Board;
  picked: boolean;
  onPick: () => void;
}) {
  const side = sideOf(board.atlas, record.competitorId);
  return (
    <button
      type="button"
      className="bx-tcp"
      aria-pressed={picked}
      aria-label={`${side.name}, ${record.wins} won, ${record.losses} lost`}
      onClick={onPick}
    >
      <Disc side={side} size={24} />
      <b>{side.name}</b>
      <small>
        {record.wins}–{record.losses}
      </small>
    </button>
  );
}

/** A match that decides something on the ladder: both teams, and its score or its time. */
function PairChip({ match, board, picked }: { match: Match; board: Board; picked?: string }) {
  const view = board.view(match);
  const [a, b] = view.sides;
  if (!a || !b) return null;
  const { times, now } = board;
  const when =
    times.dayKey(match.scheduledAt) === times.dayKey(now)
      ? times.clock(match.scheduledAt)
      : `${times.weekday(match.scheduledAt)} ${times.clock(match.scheduledAt)}`;
  return (
    <Link
      to="/match/$matchId"
      params={{ matchId: match.id }}
      className="bx-tcp"
      data-pair=""
      data-live={view.live ? "" : undefined}
      data-on={picked && (a.id === picked || b.id === picked) ? "" : undefined}
      aria-label={`${a.name} against ${b.name}`}
    >
      <Disc side={a} size={24} />
      <b>{a.name}</b>
      <em>
        {view.live ? <Ping /> : null}
        {view.live || view.resumes ? scoreLine(match) : when}
      </em>
      <b>{b.name}</b>
      <Disc side={b} size={24} />
      {board.atlas.isFollowed(match) ? (
        <Star size={15} className="bx-starred" aria-label="You follow this" />
      ) : null}
    </Link>
  );
}

/**
 * A Swiss stage as a ladder: the teams through at the top, those out at the bottom, and between
 * them every record still in play with its teams and the matches that decide it. A tap on a team
 * tells its way through, result by result.
 */
export function SwissLadder({
  stage,
  tournament,
  board,
}: {
  stage: Stage;
  tournament: Tournament;
  board: Board;
}) {
  const { atlas } = board;
  const need = stage.rules?.winsToAdvance ?? 3;
  const out = stage.rules?.lossesToExit ?? 3;
  const records = swissRecords(atlas, stage, tournament.participantIds);
  const [picked, setPicked] = useState<string>();
  const byId = new Map(records.map((r) => [r.competitorId, r]));

  const rungs = new Map<string, Rung>();
  const rung = (wins: number, losses: number) => {
    const key = `${wins}-${losses}`;
    let r = rungs.get(key);
    if (!r) {
      r = { wins, losses, teams: [], pairs: [] };
      rungs.set(key, r);
    }
    return r;
  };
  // A match drawn between two teams at the same record stands on that record's rung.
  const paired = new Set<string>();
  const pending = atlas
    .stageMatches(stage)
    .filter((m) => m.status !== "finished" && m.sides.every((s) => s.competitorId))
    .sort((x, y) => Number(y.status === "live") - Number(x.status === "live"));
  for (const m of pending) {
    const [ra, rb] = m.sides.map((s) => byId.get(s.competitorId ?? ""));
    if (!ra || !rb || ra.wins !== rb.wins || ra.losses !== rb.losses) continue;
    if (paired.has(ra.competitorId) || paired.has(rb.competitorId)) continue;
    if (ra.wins >= need || ra.losses >= out) continue;
    rung(ra.wins, ra.losses).pairs.push(m);
    paired.add(ra.competitorId);
    paired.add(rb.competitorId);
  }
  const through: SwissRecord[] = [];
  const gone: SwissRecord[] = [];
  for (const r of records) {
    if (r.wins >= need || r.status === "advanced") through.push(r);
    else if (r.losses >= out || r.status === "eliminated") gone.push(r);
    else if (paired.has(r.competitorId)) rung(r.wins, r.losses);
    else rung(r.wins, r.losses).teams.push(r);
  }
  through.sort((x, y) => x.losses - y.losses);
  gone.sort((x, y) => y.wins - x.wins);
  const middle = [...rungs.values()].sort(
    (x, y) => y.wins - y.losses - (x.wins - x.losses) || y.wins - x.wins,
  );

  const pick = (id: string) => setPicked(picked === id ? undefined : id);
  const chips = (list: SwissRecord[]) =>
    list.map((r) => (
      <TeamChip
        key={r.competitorId}
        record={r}
        board={board}
        picked={picked === r.competitorId}
        onPick={() => pick(r.competitorId)}
      />
    ));
  const says = (r: Rung) =>
    r.wins === need - 1 && r.losses === out - 1
      ? "The winner goes through, the loser goes out"
      : r.wins === need - 1
        ? "The winner goes through"
        : r.losses === out - 1
          ? "The loser goes out"
          : `${r.teams.length + r.pairs.length * 2} teams`;

  // The picked team's results, in the order they were played.
  const shown = picked ? byId.get(picked) : undefined;
  const story = shown
    ? stage.rounds.flatMap((round) =>
        round.matchIds.flatMap((id) => {
          const match = atlas.match(id);
          if (!match || match.status !== "finished") return [];
          const mine = match.sides.findIndex((s) => s.competitorId === shown.competitorId);
          if (mine < 0) return [];
          const other = match.sides[1 - mine]?.competitorId;
          return [
            {
              id,
              won: winnerOf(match) === mine,
              other: other ? atlas.name(other).replace(/^Team /, "") : "",
            },
          ];
        }),
      )
    : [];

  if (!records.length) return <p className="bx-e-empty">This stage has not been drawn yet.</p>;

  return (
    <>
      <div className="bx-sw">
        {through.length ? (
          <div className="bx-rung" data-k="in">
            <div className="bx-rk">
              <b>Through</b>
              <span>{count(need)} wins</span>
            </div>
            <div className="bx-ts">{chips(through)}</div>
          </div>
        ) : null}
        {middle.map((r) => (
          <div key={`${r.wins}-${r.losses}`} className="bx-rung">
            <div className="bx-rk">
              <b>
                {r.wins}–{r.losses}
              </b>
              <span>{says(r)}</span>
            </div>
            <div className="bx-ts">
              {r.pairs.map((m) => (
                <PairChip key={m.id} match={m} board={board} picked={picked} />
              ))}
              {chips(r.teams)}
            </div>
          </div>
        ))}
        {gone.length ? (
          <div className="bx-rung" data-k="out">
            <div className="bx-rk">
              <b>Out</b>
              <span>{count(out)} losses</span>
            </div>
            <div className="bx-ts">{chips(gone)}</div>
          </div>
        ) : null}
      </div>
      {shown ? (
        <div className="bx-sw-story" aria-live="polite">
          <Go to={{ kind: "team", id: shown.competitorId }} className="bx-sw-team">
            <Disc side={sideOf(atlas, shown.competitorId)} size={30} />
            <b>{atlas.name(shown.competitorId).replace(/^Team /, "")}</b>
            <span>
              {shown.wins}–{shown.losses}
              {shown.status === "advanced"
                ? " · through"
                : shown.status === "eliminated"
                  ? " · out"
                  : ""}
            </span>
            <ChevronRight size={16} aria-hidden />
          </Go>
          {story.length ? (
            <ol>
              {story.map((s, i) => (
                <li key={s.id} data-won={s.won ? "" : undefined}>
                  <small>Round {i + 1}</small>
                  {s.won ? "Beat" : "Lost to"} {s.other}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
