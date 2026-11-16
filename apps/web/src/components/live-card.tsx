import type { Match } from "@bearing/domain";
import { liveGame, seriesScore } from "@bearing/domain";
import { Chessboard } from "./chessboard";
import { MatchLink } from "./links";
import { Country, Mark } from "./mark";
import { GameBadge, LiveBadge } from "./ui";
import { roundLabel } from "../lib/view";
import { useAtlas } from "../lib/world";

/** A live match at a glance, shaped by what the game needs: series, board or cup race. */
export function LiveCard({ match, className = "" }: { match: Match; className?: string }) {
  const atlas = useAtlas();
  const t = atlas.tournamentOf(match);
  return (
    <MatchLink
      id={match.id}
      className={`ui-card group flex min-w-[272px] flex-col overflow-hidden transition-transform hover:-translate-y-0.5 ${className}`}
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5">
        <div className="flex min-w-0 items-center gap-2 text-[12px] text-muted">
          <GameBadge id={t.discipline} />
          <span className="truncate">
            {t.short} · {roundLabel(atlas, match)}
          </span>
        </div>
        <LiveBadge label={match.status === "live" ? "Live" : "Final"} />
      </div>
      <div className="flex-1 px-4 pt-3 pb-4">
        {t.discipline === "chess" ? (
          <ChessBody match={match} />
        ) : match.sides.length > 2 ? (
          <CupBody match={match} />
        ) : (
          <SeriesBody match={match} />
        )}
      </div>
    </MatchLink>
  );
}

function SeriesBody({ match }: { match: Match }) {
  const atlas = useAtlas();
  const score = seriesScore(match);
  const g = liveGame(match);
  return (
    <>
      <div className="space-y-2">
        {match.sides.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <Mark id={s.competitorId} size={30} />
            <span
              className={`ui-h3 flex-1 truncate ${score[i]! < score[1 - i]! ? "text-muted" : ""}`}
            >
              {atlas.name(s.competitorId)}
            </span>
            <span
              className={`ui-num text-[30px] leading-none ${score[i]! > score[1 - i]! ? "" : "text-muted"}`}
            >
              {score[i]}
            </span>
          </div>
        ))}
      </div>
      {g && (
        <div className="mt-4 flex items-center justify-between rounded-[var(--radius-sm)] bg-raised px-3 py-2 text-[13px]">
          <span className="font-medium">{g.label}</span>
          {g.scores && (
            <span className="ui-num text-[15px]">
              {g.scores[0]} – {g.scores[1]}
            </span>
          )}
          <span className="text-[12px] text-muted">
            Map {match.games.indexOf(g) + 1} of {match.bestOf}
          </span>
        </div>
      )}
    </>
  );
}

function ChessBody({ match }: { match: Match }) {
  const atlas = useAtlas();
  const g = match.games[0]!;
  return (
    <div className="flex gap-4">
      {g.chess ? (
        <Chessboard
          fen={g.chess.fen}
          size={112}
          coords={false}
          className="shrink-0 rounded-[4px]"
        />
      ) : (
        <div className="grid size-[112px] shrink-0 place-items-center rounded-[4px] bg-raised text-[22px] font-semibold">
          {g.winner === "draw" ? "½–½" : g.winner === 0 ? "1–0" : "0–1"}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        {match.sides.map((s, i) => {
          const p = atlas.player(s.competitorId ?? "");
          return (
            <div key={i} className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`size-2.5 shrink-0 rounded-[2px] border border-ink/30 ${i === 0 ? "bg-[#fbfaf6]" : "bg-[#16130f]"}`}
                />
                <span className="truncate text-[14.5px] font-semibold">{p?.handle}</span>
                <span className="text-[11.5px] text-faint">{p?.rating?.value}</span>
              </div>
              {g.chess?.clocks && (
                <div className="ui-num mt-0.5 pl-[18px] text-[13px] text-muted">
                  {g.chess.clocks[i]}
                </div>
              )}
            </div>
          );
        })}
        <div className="truncate text-[11.5px] text-faint">{g.detail}</div>
      </div>
    </div>
  );
}

function CupBody({ match }: { match: Match }) {
  const atlas = useAtlas();
  const g = match.games[0]!;
  const limit = g.cup?.limit ?? 100;
  const order = match.sides
    .map((s, i) => ({ s, i, pts: g.scores?.[i] ?? 0 }))
    .sort((a, b) => b.pts - a.pts);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[12px] text-muted">
        <span>{g.label}</span>
        <span>
          {g.detail} · limit {limit}
        </span>
      </div>
      <div className="space-y-1.5">
        {order.map(({ s, i, pts }) => {
          const finalist = g.cup?.finalists.includes(i);
          const p = atlas.player(s.competitorId ?? "");
          return (
            <div
              key={i}
              className="grid grid-cols-[88px_1fr_34px] items-center gap-2.5 text-[13.5px]"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-semibold">{p?.handle}</span>
                <Country code={p?.country} className="text-faint" />
              </span>
              <span className="relative h-2 overflow-hidden rounded-full bg-raised">
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${(pts / limit) * 100}%`,
                    background: finalist ? "var(--accent)" : "var(--muted)",
                  }}
                />
              </span>
              <span className={`ui-num text-right text-[13px] ${finalist ? "text-accent" : ""}`}>
                {pts}
              </span>
            </div>
          );
        })}
      </div>
      {g.cup?.finalists.length ? (
        <div className="mt-2 text-[12px] text-accent">
          {g.cup.finalists.map((i) => atlas.short(match.sides[i]!.competitorId)).join(", ")} at the
          limit: one round win from first
        </div>
      ) : null}
    </div>
  );
}
