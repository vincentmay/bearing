import { dayKey, dayLabel, longDate } from "@bearing/domain";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { EventCard } from "../components/event-card";
import { GameLink, MatchLink, SectionLink } from "../components/links";
import { LiveCard } from "../components/live-card";
import { Mark } from "../components/mark";
import { MatchRow } from "../components/match-row";
import { Timeline } from "../components/timeline";
import { Section } from "../components/ui";
import { MatchHero } from "../directions/heroes";
import { useDir } from "../lib/dir";
import { useSetMood } from "../lib/mood";
import {
  featuredLive,
  followStatus,
  followTarget,
  recentForYou,
  upcomingForYou,
  type Upcoming,
} from "../lib/view";
import { useAtlas, useMinute } from "../lib/world";

export function NowPage() {
  const dir = useDir();
  const atlas = useAtlas();
  const featured = featuredLive(atlas);
  const [selected, setSelected] = useState<string | undefined>(featured?.id);
  const focus = (selected && atlas.match(selected)) || featured;
  useSetMood({ discipline: featured ? atlas.tournamentOf(featured).discipline : undefined });

  return (
    <div className="space-y-14 sm:space-y-16">
      {dir !== "arena" && <Intro />}
      {dir === "signal" ? (
        <div className="space-y-4">
          <Timeline selected={focus?.id} onSelect={setSelected} />
          {focus && <MatchHero match={focus} mode="feature" />}
        </div>
      ) : dir === "almanac" ? (
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          {featured && <MatchHero match={featured} mode="feature" />}
          <TodayList />
        </div>
      ) : (
        featured && <MatchHero match={featured} mode="feature" />
      )}
      <AlsoLive exclude={dir === "signal" ? undefined : featured?.id} />
      <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
        <YourSchedule />
        <div className="space-y-12">
          <Following />
          <Results />
        </div>
      </div>
      <Events />
    </div>
  );
}

function Intro() {
  const atlas = useAtlas();
  const dir = useDir();
  const now = useMinute();
  const live = atlas.live().length;
  const today = atlas.upcoming().filter((m) => dayKey(m.scheduledAt) === dayKey(now)).length;
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {dir !== "almanac" && <div className="ui-kicker">{longDate(now)}</div>}
        <h1 className="ui-h1 mt-2 !text-[40px] sm:!text-[56px]">
          {live} live{today ? `, ${today} more today` : ""}
        </h1>
      </div>
      <nav
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        aria-label="Games"
      >
        {atlas.world.disciplines.map((d) => {
          const n = atlas.live().filter((m) => atlas.tournamentOf(m).discipline === d.id).length;
          return (
            <GameLink key={d.id} id={d.id} className="ui-chip">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: d.palette.accent }} />
                {d.name}
                {n > 0 && <span className="text-live">● {n}</span>}
              </span>
            </GameLink>
          );
        })}
      </nav>
    </div>
  );
}

function TodayList() {
  const atlas = useAtlas();
  const now = useMinute();
  const rows = [
    ...atlas.live(),
    ...atlas.upcoming().filter((m) => dayKey(m.scheduledAt) === dayKey(now)),
  ];
  const seen = new Set<string>();
  const list = rows.filter((m) => {
    const individual =
      atlas.discipline(atlas.tournamentOf(m).discipline).competitor === "player" &&
      m.sides.length === 2;
    const key = individual ? `${m.tournamentId}|${m.roundId}` : m.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return (
    <aside className="lg:border-l lg:border-line lg:pl-8">
      <h2 className="ui-h2 border-t-2 border-ink pt-2">On the slate today</h2>
      <ol className="mt-3 divide-y divide-line">
        {list.map((m) => {
          const t = atlas.tournamentOf(m);
          const chessRound = t.discipline === "chess";
          return (
            <li key={m.id}>
              <MatchLink
                id={m.id}
                className="grid grid-cols-[52px_1fr] gap-3 py-3 hover:text-accent"
              >
                <span className="font-mono text-[13px] whitespace-nowrap">
                  {m.status === "live" ? (
                    <span className="text-live">Live</span>
                  ) : (
                    new Intl.DateTimeFormat(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(Date.parse(m.scheduledAt))
                  )}
                </span>
                <span>
                  <span className="block text-[14.5px] leading-snug font-medium">
                    {chessRound
                      ? `${atlas.roundOf(m)?.name}, four boards`
                      : m.sides.length > 2
                        ? m.sides.map((s) => atlas.short(s.competitorId)).join(", ")
                        : m.sides
                            .map((s) => atlas.name(s.competitorId).replace(/^Team /, ""))
                            .join(" v ")}
                  </span>
                  <span className="text-[12px] text-muted">{t.short}</span>
                </span>
              </MatchLink>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function AlsoLive({ exclude }: { exclude?: string }) {
  const atlas = useAtlas();
  const live = atlas.live().filter((m) => m.id !== exclude);
  if (!live.length) return null;
  return (
    <Section kicker="Live now" title="Also happening" action={`${live.length} in play`}>
      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-4">
        {live.map((m) => (
          <LiveCard key={m.id} match={m} className="snap-start" />
        ))}
      </div>
    </Section>
  );
}

function YourSchedule() {
  const atlas = useAtlas();
  const now = useMinute();
  const items = upcomingForYou(atlas).slice(0, 12);
  const days = new Map<string, Upcoming[]>();
  for (const it of items) {
    const k = dayKey(it.match.scheduledAt);
    days.set(k, [...(days.get(k) ?? []), it]);
  }
  return (
    <Section
      kicker="Coming up for you"
      title="Your schedule"
      action={
        <SectionLink to="schedule" className="flex items-center gap-1 hover:text-ink">
          Full schedule <ArrowRight className="size-3.5" />
        </SectionLink>
      }
    >
      <div className="space-y-7">
        {[...days.values()].map((list) => (
          <div key={list[0]!.match.id}>
            <div className="ui-label mb-2">{dayLabel(list[0]!.match.scheduledAt, now)}</div>
            <div className="ui-card ui-divide overflow-hidden">
              {list.map((it) => (
                <MatchRow
                  key={it.match.id + (it.conditional?.competitorId ?? "")}
                  match={it.match}
                  conditional={it.conditional}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Following() {
  const atlas = useAtlas();
  const now = useMinute();
  return (
    <Section
      kicker="Following"
      title="Where they stand"
      action={
        <SectionLink to="following" className="hover:text-ink">
          Manage
        </SectionLink>
      }
    >
      <div className="ui-card ui-divide overflow-hidden">
        {atlas.world.follows.map((f) => {
          const target = followTarget(atlas, f);
          const st = followStatus(atlas, f, now);
          const body = (
            <div className="ui-row flex items-center gap-3 px-4 py-3">
              {f.kind === "team" || f.kind === "player" ? (
                <Mark id={f.id} size={34} />
              ) : (
                <span
                  className="grid size-[34px] shrink-0 place-items-center rounded-[10px] text-[11px] font-bold"
                  style={{ background: target.colors.primary, color: target.colors.secondary }}
                >
                  {target.name
                    .replace(/^Team /, "")
                    .slice(0, 3)
                    .toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-semibold">{target.name}</div>
                <div
                  className={`truncate text-[12.5px] ${st.state === "live" ? "text-live" : st.state === "out" ? "text-loss" : "text-muted"}`}
                >
                  {st.state === "live" && "● "}
                  {st.line}
                </div>
              </div>
            </div>
          );
          return st.matchId ? (
            <MatchLink key={`${f.kind}-${f.id}`} id={st.matchId} className="block">
              {body}
            </MatchLink>
          ) : (
            <div key={`${f.kind}-${f.id}`}>{body}</div>
          );
        })}
      </div>
    </Section>
  );
}

function Results() {
  const atlas = useAtlas();
  const list = recentForYou(atlas, 6);
  return (
    <Section kicker="While you were away" title="Results">
      <div className="ui-card ui-divide overflow-hidden">
        {list.map((m) => (
          <MatchRow key={m.id} match={m} dense showEvent />
        ))}
      </div>
    </Section>
  );
}

function Events() {
  const atlas = useAtlas();
  const now = useMinute();
  const list = atlas.world.tournaments
    .filter((t) => Date.parse(`${t.end}T23:59:59Z`) >= now - 86_400_000 * 2)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 8);
  return (
    <Section
      kicker="Events"
      title="On now and next"
      action={
        <SectionLink to="events" className="flex items-center gap-1 hover:text-ink">
          All events <ArrowRight className="size-3.5" />
        </SectionLink>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {list.map((t) => (
          <EventCard key={t.id} t={t} />
        ))}
      </div>
    </Section>
  );
}
