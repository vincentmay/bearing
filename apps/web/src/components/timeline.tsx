import type { Atlas, Follow, Match } from "@bearing/domain";
import { clock, seriesScore } from "@bearing/domain";
import { useEffect, useMemo, useRef, useState } from "react";
import { followTarget } from "../lib/view";
import { estimatedMinutes, useAtlas, useMinute } from "../lib/world";

const RANGES = [
  { id: "12h", label: "12h", before: 3, after: 9, step: 1 },
  { id: "48h", label: "48h", before: 8, after: 40, step: 3 },
  { id: "7d", label: "7d", before: 24, after: 24 * 6, step: 12 },
] as const;

interface Block {
  key: string;
  matches: Match[];
  start: number;
  end: number;
  label: string;
  color: string;
  live: boolean;
  done: boolean;
}

function blockLabel(atlas: Atlas, matches: Match[]): string {
  const m = matches[0]!;
  if (matches.length > 1) return `${atlas.roundOf(m)?.short} · ${matches.length} boards`;
  if (m.sides.length > 2) return `${atlas.roundOf(m)?.short} ${m.id.split("-").at(-1)}`;
  const s = seriesScore(m);
  const names = m.sides.map((x) => (x.competitorId ? atlas.short(x.competitorId) : "?"));
  return m.status === "scheduled" ? names.join(" v ") : `${names[0]} ${s[0]}–${s[1]} ${names[1]}`;
}

function toBlocks(atlas: Atlas, list: Match[]): Block[] {
  const groups = new Map<string, Match[]>();
  for (const m of list) {
    const individual =
      atlas.discipline(atlas.tournamentOf(m).discipline).competitor === "player" &&
      m.sides.length === 2;
    const key = individual ? `${m.tournamentId}|${m.roundId}|${m.scheduledAt}` : m.id;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return [...groups.entries()].map(([key, ms]) => {
    const m = ms[0]!;
    const d = atlas.discipline(atlas.tournamentOf(m).discipline);
    const start = Date.parse(m.scheduledAt);
    return {
      key,
      matches: ms,
      start,
      end: start + estimatedMinutes(m, d.id) * 60_000,
      label: blockLabel(atlas, ms),
      color: d.palette.accent,
      live: ms.some((x) => x.status === "live"),
      done: ms.every((x) => x.status === "finished"),
    };
  });
}

/**
 * Everything you follow on one time axis: a lane per follow, then everything else by game,
 * with a now-line. Selecting a block focuses that match.
 */
export function Timeline({
  selected,
  onSelect,
}: {
  selected?: string;
  onSelect: (id: string) => void;
}) {
  const atlas = useAtlas();
  const now = useMinute();
  const [rangeId, setRangeId] = useState<(typeof RANGES)[number]["id"]>("48h");
  const range = RANGES.find((r) => r.id === rangeId)!;
  const hour = 3_600_000;
  const anchor = Math.floor(now / hour) * hour;
  const from = anchor - range.before * hour;
  const to = anchor + range.after * hour;
  const pct = (t: number) => ((t - from) / (to - from)) * 100;

  const lanes = useMemo(() => {
    const visible = atlas.world.matches.filter((m) => {
      const s = Date.parse(m.scheduledAt);
      return s + estimatedMinutes(m, atlas.tournamentOf(m).discipline) * 60_000 >= from && s <= to;
    });
    const used = new Set<string>();
    const out = atlas.world.follows.map((f: Follow) => {
      const own = visible.filter((m) => atlas.touches(m, f));
      own.forEach((m) => used.add(m.id));
      return {
        id: `${f.kind}:${f.id}`,
        label: followTarget(atlas, f).name.replace(/^Team /, ""),
        kind: f.kind,
        follow: true,
        blocks: toBlocks(atlas, own),
      };
    });
    for (const d of atlas.world.disciplines) {
      const rest = visible.filter(
        (m) => !used.has(m.id) && atlas.tournamentOf(m).discipline === d.id,
      );
      if (rest.length)
        out.push({
          id: `rest:${d.id}`,
          label: d.name,
          kind: "organization",
          follow: false,
          blocks: toBlocks(atlas, rest),
        });
    }
    return out;
  }, [atlas, from, to]);

  const ticks: number[] = [];
  for (
    let t = Math.ceil(from / (range.step * hour)) * range.step * hour;
    t <= to;
    t += range.step * hour
  )
    ticks.push(t);
  const fmtHour = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const fmtDay = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric" });
  const scroller = useRef<HTMLDivElement>(null);
  const nowPct = pct(now);
  useEffect(() => {
    const el = scroller.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    // The lane labels stay pinned, so place "now" a quarter of the way into the visible track.
    const label = el.querySelector<HTMLElement>("[data-lane-label]")?.offsetWidth ?? 168;
    const track = el.scrollWidth - label;
    const nowX = label + (nowPct / 100) * track;
    el.scrollLeft = Math.max(0, nowX - label - (el.clientWidth - label) * 0.25);
  }, [rangeId, nowPct]);

  return (
    <section className="ui-card overflow-hidden">
      <div className="flex h-11 items-center justify-between gap-3 border-b border-line px-4">
        <span className="ui-kicker">Timeline · you follow {atlas.world.follows.length}</span>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Range">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={r.id === rangeId}
              aria-pressed={r.id === rangeId}
              onClick={() => setRangeId(r.id)}
              className="ui-chip !h-7 !px-2.5"
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={scroller} className="no-scrollbar overflow-x-auto">
        <div className="relative min-w-[960px]">
          <div className="relative ml-[104px] sm:ml-[168px] h-9 border-b border-line">
            {ticks.map((t) => (
              <span
                key={t}
                className={`absolute top-2.5 -translate-x-1/2 font-mono text-[10.5px] whitespace-nowrap ${new Date(t).getHours() === 0 ? "text-ink" : "text-faint"}`}
                style={{ left: `${pct(t)}%` }}
              >
                {new Date(t).getHours() === 0 || rangeId === "7d"
                  ? fmtDay.format(t)
                  : fmtHour.format(t)}
              </span>
            ))}
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 right-0 left-[104px] sm:left-[168px]">
              {ticks.map((t) => (
                <span
                  key={t}
                  className={`absolute inset-y-0 w-px ${new Date(t).getHours() === 0 ? "bg-line" : "bg-line/50"}`}
                  style={{ left: `${pct(t)}%` }}
                />
              ))}
              <div
                className="absolute inset-y-0 left-0 bg-ink/[0.03]"
                style={{ width: `${nowPct}%` }}
              />
              <div
                className="absolute inset-y-0 z-20 w-0.5 bg-accent"
                style={{ left: `${nowPct}%` }}
              >
                <span className="absolute -top-[32px] left-1/2 -translate-x-1/2 rounded-sm bg-accent px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent-ink">
                  {fmtHour.format(now)}
                </span>
              </div>
            </div>
            {lanes.map((lane, li) => (
              <div
                key={lane.id}
                className={`flex h-12 items-center border-b border-line last:border-0 ${!lane.follow && lanes[li - 1]?.follow ? "border-t border-t-line" : ""}`}
              >
                <div
                  data-lane-label
                  className="sticky left-0 z-30 flex h-full w-[104px] shrink-0 items-center gap-2 border-r border-line bg-paper px-3 sm:w-[168px] sm:px-4"
                >
                  <span
                    className={`truncate text-[13px] ${lane.follow ? "font-semibold" : "text-muted"}`}
                  >
                    {lane.label}
                  </span>
                  {lane.follow && <span className="size-1.5 shrink-0 rounded-full bg-accent" />}
                </div>
                <div className="relative h-full flex-1">
                  {lane.blocks.length === 0 && (
                    <span className="absolute top-1/2 left-3 -translate-y-1/2 text-[12px] text-faint">
                      Nothing in this range
                    </span>
                  )}
                  {lane.blocks.map((b) => {
                    const left = Math.max(0, pct(b.start));
                    const right = Math.min(100, pct(b.end));
                    const isSel = b.matches.some((m) => m.id === selected);
                    return (
                      <button
                        key={b.key}
                        type="button"
                        onClick={() => onSelect(b.matches[0]!.id)}
                        title={`${b.label} · ${clock(b.matches[0]!.scheduledAt)}`}
                        className="absolute top-1/2 h-8 -translate-y-1/2 overflow-hidden rounded-[calc(var(--radius-sm)*0.5)] px-2 text-left text-[11.5px] font-medium whitespace-nowrap transition-[filter] hover:brightness-110"
                        style={{
                          left: `${left}%`,
                          width: `max(8px, ${right - left}%)`,
                          background: b.live
                            ? `repeating-linear-gradient(135deg, color-mix(in oklab, ${b.color} 38%, transparent) 0 6px, color-mix(in oklab, ${b.color} 22%, transparent) 6px 12px)`
                            : `color-mix(in oklab, ${b.color} ${b.done ? 12 : 24}%, transparent)`,
                          boxShadow: `inset 3px 0 0 ${b.color}${isSel ? ", 0 0 0 2px var(--accent)" : ""}`,
                          color: b.done ? "var(--muted)" : "var(--ink)",
                          zIndex: isSel ? 10 : 1,
                        }}
                      >
                        <span className="relative">{b.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
