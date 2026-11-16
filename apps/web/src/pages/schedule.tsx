import type { DisciplineId, Match } from "@bearing/domain";
import { dayKey, dayLabel, longDate } from "@bearing/domain";
import { useEffect, useMemo, useRef, useState } from "react";
import { EventLink } from "../components/links";
import { MatchRow } from "../components/match-row";
import { Empty, GameBadge } from "../components/ui";
import { useAtlas, useMinute } from "../lib/world";

const DAY = 86_400_000;

export function SchedulePage() {
  const atlas = useAtlas();
  const now = useMinute();
  const [game, setGame] = useState<DisciplineId | "all">("all");
  const [mine, setMine] = useState(false);
  const [day, setDay] = useState(() => dayKey(now));

  const filtered = useMemo(
    () =>
      atlas.world.matches.filter(
        (m) =>
          (game === "all" || atlas.tournamentOf(m).discipline === game) &&
          (!mine || atlas.isFollowed(m)),
      ),
    [atlas, game, mine],
  );

  const days = useMemo(() => {
    const times = atlas.world.matches.map((m) => Date.parse(m.scheduledAt));
    const start = new Date(Math.min(...times));
    start.setHours(12, 0, 0, 0);
    const end = Math.max(...times);
    const out: { key: string; at: number; count: number; live: boolean }[] = [];
    for (let t = start.getTime(); t <= end + DAY; t += DAY) {
      const key = dayKey(t);
      const ms = filtered.filter((m) => dayKey(m.scheduledAt) === key);
      out.push({ key, at: t, count: ms.length, live: ms.some((m) => m.status === "live") });
    }
    return out;
  }, [atlas, filtered]);

  const selected = days.find((d) => d.key === day) ?? days[0]!;
  const matches = filtered
    .filter((m) => dayKey(m.scheduledAt) === day)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const groups = new Map<string, Match[]>();
  for (const m of matches) groups.set(m.tournamentId, [...(groups.get(m.tournamentId) ?? []), m]);
  const nextDay = days.find((d) => d.at > selected.at && d.count > 0);

  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    el?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [day]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="ui-kicker">Schedule</div>
          <h1 className="ui-h1 mt-2 !text-[40px] sm:!text-[60px]">{longDate(selected.at)}</h1>
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 text-[14px] font-medium select-none">
          <span
            className={`relative h-6 w-10 rounded-full transition-colors ${mine ? "bg-accent" : "bg-raised"}`}
          >
            <span
              className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${mine ? "translate-x-[18px]" : "translate-x-0.5"}`}
            />
          </span>
          <input
            type="checkbox"
            className="sr-only"
            checked={mine}
            onChange={(e) => setMine(e.target.checked)}
          />
          Only what I follow
        </label>
      </header>

      <div
        ref={strip}
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
        role="group"
        aria-label="Day"
      >
        {days.map((d) => {
          const isToday = d.key === dayKey(now);
          const on = d.key === day;
          return (
            <button
              key={d.key}
              type="button"
              aria-pressed={on}
              onClick={() => setDay(d.key)}
              className={`flex w-[64px] shrink-0 flex-col items-center gap-1 rounded-[var(--radius-sm)] border py-2.5 transition-colors ${
                on ? "border-ink bg-ink text-paper" : "border-line hover:border-muted"
              } ${d.count === 0 && !on ? "opacity-45" : ""}`}
            >
              <span className={`text-[11px] font-semibold uppercase ${on ? "" : "text-muted"}`}>
                {isToday
                  ? "Today"
                  : new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d.at)}
              </span>
              <span className="ui-num text-[22px] leading-none">{new Date(d.at).getDate()}</span>
              <span className="flex h-2 items-center gap-0.5">
                {d.live ? (
                  <span className="size-1.5 rounded-full bg-live" />
                ) : (
                  Array.from({ length: Math.min(4, Math.ceil(d.count / 3)) }, (_, i) => (
                    <span
                      key={i}
                      className={`size-1 rounded-full ${on ? "bg-paper/70" : "bg-muted"}`}
                    />
                  ))
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        role="group"
        aria-label="Game"
      >
        <button
          type="button"
          className="ui-chip"
          aria-pressed={game === "all"}
          onClick={() => setGame("all")}
        >
          <span>All games</span>
        </button>
        {atlas.world.disciplines.map((d) => (
          <button
            key={d.id}
            type="button"
            className="ui-chip"
            aria-pressed={game === d.id}
            onClick={() => setGame(d.id)}
          >
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: d.palette.accent }} />
              {d.name}
            </span>
          </button>
        ))}
      </div>

      {groups.size === 0 ? (
        <Empty
          title={`Nothing ${mine ? "you follow " : ""}on ${dayLabel(selected.at, now).toLowerCase()}`}
        >
          {nextDay ? (
            <button
              type="button"
              className="text-accent underline underline-offset-4"
              onClick={() => setDay(nextDay.key)}
            >
              Next: {dayLabel(nextDay.at, now)}, {nextDay.count}{" "}
              {nextDay.count === 1 ? "match" : "matches"}
            </button>
          ) : (
            "Nothing further is scheduled yet."
          )}
        </Empty>
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([tid, list]) => {
            const t = atlas.tournament(tid)!;
            const rounds = [...new Set(list.map((m) => atlas.roundOf(m)?.name))].join(", ");
            return (
              <section key={tid}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <EventLink id={tid} className="flex items-center gap-3 hover:text-accent">
                    <GameBadge id={t.discipline} />
                    <span className="ui-h3">{t.name}</span>
                  </EventLink>
                  <span className="text-[13px] text-muted">{rounds}</span>
                </div>
                <div className="ui-card ui-divide overflow-hidden">
                  {list.map((m) => (
                    <MatchRow key={m.id} match={m} showEvent={false} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
