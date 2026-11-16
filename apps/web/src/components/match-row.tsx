import type { Match } from "@bearing/domain";
import { clock, formatPoints, liveGame, relative, seriesScore, winnerOf } from "@bearing/domain";
import { MatchLink } from "./links";
import { Mark } from "./mark";
import { GameBadge, LiveBadge } from "./ui";
import { pendingSource, roundLabel } from "../lib/view";
import { useAtlas, useMinute } from "../lib/world";

/**
 * One match as a list row. Sides stack one per line with their score on the right, so a
 * glance down the right edge reads the results.
 */
export function MatchRow({
  match,
  showEvent = true,
  conditional,
  dense = false,
}: {
  match: Match;
  showEvent?: boolean;
  conditional?: { competitorId: string };
  dense?: boolean;
}) {
  const atlas = useAtlas();
  const now = useMinute();
  const t = atlas.tournamentOf(match);
  const d = atlas.discipline(t.discipline);
  const score = seriesScore(match);
  const w = winnerOf(match);
  const live = match.status === "live";
  const lg = liveGame(match);
  const multi = match.sides.length > 2;
  const isChess = d.id === "chess";

  return (
    <MatchLink
      id={match.id}
      className={`ui-row grid grid-cols-[64px_1fr_auto] items-center gap-x-4 px-4 ${dense ? "py-2.5" : "py-3.5"} sm:grid-cols-[76px_1fr_auto] sm:px-5`}
    >
      <div className="self-start pt-0.5 whitespace-nowrap">
        {live ? (
          <LiveBadge />
        ) : (
          <div className="ui-num text-[15px] leading-tight">{clock(match.scheduledAt)}</div>
        )}
        <div className="mt-1 text-[11px] text-faint">
          {live
            ? lg
              ? lg.label
              : ""
            : match.status === "finished"
              ? "Final"
              : relative(match.scheduledAt, now)}
        </div>
      </div>

      <div className="min-w-0">
        {showEvent && (
          <div className="mb-1.5 flex min-w-0 items-center gap-2 text-[12px] text-muted">
            <GameBadge id={d.id} />
            <span className="truncate">
              {t.short} · {roundLabel(atlas, match)}
            </span>
          </div>
        )}
        {multi ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[14.5px]">
            {match.sides.map((s, i) =>
              s.competitorId ? (
                <span
                  key={i}
                  className={
                    atlas.followsCompetitor(s.competitorId)
                      ? "font-semibold text-accent"
                      : "font-medium"
                  }
                >
                  {atlas.short(s.competitorId)}
                </span>
              ) : (
                <span key={i} className="text-[12.5px] text-faint">
                  {s.placeholder}
                </span>
              ),
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {match.sides.map((s, i) => {
              const pending = !s.competitorId ? pendingSource(atlas, match, i) : undefined;
              const lost = typeof w === "number" && w !== i;
              const won = w === i;
              const followed = atlas.followsCompetitor(s.competitorId);
              return (
                <div key={i} className="flex min-w-0 items-center gap-2.5">
                  {isChess ? (
                    <span
                      className={`size-3 shrink-0 rounded-[3px] border border-ink/30 ${i === 0 ? "bg-[#fbfaf6]" : "bg-[#16130f]"}`}
                    />
                  ) : (
                    <Mark
                      id={
                        s.competitorId ??
                        (conditional && i === match.sides.findIndex((x) => !x.competitorId)
                          ? conditional.competitorId
                          : null)
                      }
                      size={dense ? 20 : 22}
                      tone={s.competitorId ? "solid" : "ghost"}
                    />
                  )}
                  <span
                    className={`truncate text-[14.5px] ${won ? "font-semibold" : lost ? "text-muted" : "font-medium"} ${followed ? "underline decoration-accent decoration-2 underline-offset-4" : ""}`}
                  >
                    {s.competitorId ? (
                      atlas.name(s.competitorId)
                    ) : conditional && i === match.sides.findIndex((x) => !x.competitorId) ? (
                      <span className="text-muted">{atlas.name(conditional.competitorId)}?</span>
                    ) : pending ? (
                      <span className="text-[13px] text-muted">
                        {pending.sides.map((x) => atlas.short(x.competitorId)).join(" or ")}
                      </span>
                    ) : (
                      <span className="text-[13px] text-faint">{s.placeholder}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {conditional && (
          <div className="mt-1.5 text-[12px] font-medium text-accent">
            If {atlas.short(conditional.competitorId)} win tonight
          </div>
        )}
      </div>

      <div className="text-right">
        {match.status === "scheduled" ? (
          <span className="text-[11.5px] text-faint">Bo{match.bestOf}</span>
        ) : multi ? (
          <span className="text-[12px] text-muted">{lg?.detail ?? ""}</span>
        ) : (
          <div className="space-y-1">
            {match.sides.map((_, i) => (
              <div
                key={i}
                className={`ui-num text-[16px] leading-[22px] ${w === i || (live && score[i]! > score[1 - i]!) ? "" : "text-muted"}`}
              >
                {isChess ? (match.status === "live" ? "·" : formatPoints(score[i]!)) : score[i]}
              </div>
            ))}
          </div>
        )}
      </div>
    </MatchLink>
  );
}
