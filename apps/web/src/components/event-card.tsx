import type { Tournament } from "@bearing/domain";
import {
  champion,
  clock,
  dateRange,
  dayLabel,
  money,
  relative,
  tournamentStatus,
} from "@bearing/domain";
import { Trophy } from "lucide-react";
import { EventLink } from "./links";
import { Mark } from "./mark";
import { GameBadge, LiveBadge, Meter } from "./ui";
import { useAtlas, useMinute } from "../lib/world";

/** An event as a card: where it stands, when, for how much. */
export function EventCard({ t, className = "" }: { t: Tournament; className?: string }) {
  const atlas = useAtlas();
  const now = useMinute();
  const status = tournamentStatus(atlas, t, now);
  const ms = atlas.matchesOf(t.id);
  const live = ms.some((m) => m.status === "live");
  const next = ms
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
  const start = Date.parse(`${t.start}T00:00:00Z`);
  const end = Date.parse(`${t.end}T23:59:59Z`);
  const progress = Math.min(1, Math.max(0, (now - start) / (end - start)));
  const winner = champion(t);
  return (
    <EventLink
      id={t.id}
      className={`ui-card group relative flex min-h-[200px] flex-col overflow-hidden p-5 transition-transform hover:-translate-y-0.5 ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60 transition-opacity group-hover:opacity-100"
        style={{
          background: `radial-gradient(120% 90% at 100% 0%, color-mix(in oklab, ${t.colors.primary} 22%, transparent), transparent 60%)`,
        }}
      />
      <div className="relative flex items-center justify-between gap-2">
        <GameBadge id={t.discipline} />
        {live ? <LiveBadge /> : <span className="text-[11.5px] text-faint">{t.tier}-tier</span>}
      </div>
      <div className="relative mt-auto pt-8">
        <h3 className="ui-h3 text-[20px] leading-tight">{t.name}</h3>
        <div className="mt-1.5 flex flex-wrap gap-x-3 text-[12.5px] text-muted">
          <span>{dateRange(t.start, t.end)}</span>
          <span>{t.location?.city ?? "Online"}</span>
          {t.prize && <span>{money(t.prize.amount, t.prize.currency)}</span>}
        </div>
      </div>
      <div className="relative mt-4">
        {status === "completed" ? (
          <div className="flex items-center gap-2 text-[13px]">
            <Trophy className="size-4 text-accent" />
            {winner ? (
              <>
                <Mark id={winner} size={20} />
                <span className="font-semibold">{atlas.name(winner)}</span>
              </>
            ) : (
              "Complete"
            )}
          </div>
        ) : status === "upcoming" ? (
          <div className="text-[13px] text-muted">
            Starts {relative(`${t.start}T12:00:00Z`, now)}
          </div>
        ) : (
          <>
            <Meter value={progress} color={t.colors.primary} />
            <div className="mt-2 text-[12px] text-muted">
              {live
                ? "Matches in progress"
                : next
                  ? `Next: ${dayLabel(next.scheduledAt, now).toLowerCase()}, ${clock(next.scheduledAt)}`
                  : "Wrapping up"}
            </div>
          </>
        )}
      </div>
    </EventLink>
  );
}
