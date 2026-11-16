import type { Match, Tournament } from "@bearing/domain";
import {
  champion,
  countryName,
  dateRange,
  dayKey,
  dayLabel,
  money,
  relative,
  tournamentStatus,
} from "@bearing/domain";
import { useNavigate } from "@tanstack/react-router";
import { Calendar, MapPin, Trophy, Users } from "lucide-react";
import { useState } from "react";
import { StageView } from "../components/formats/views";
import { CompetitorLink } from "../components/links";
import { LiveCard } from "../components/live-card";
import { Country, Mark } from "../components/mark";
import { MatchRow } from "../components/match-row";
import {
  Countdown,
  Empty,
  FollowButton,
  GameBadge,
  LiveBadge,
  Section,
  Tabs,
} from "../components/ui";
import { useDir } from "../lib/dir";
import { useSetMood } from "../lib/mood";
import { eventDeck } from "../lib/story";
import { useAtlas, useMinute } from "../lib/world";

export const EVENT_TABS = ["overview", "bracket", "matches", "field", "prizes"] as const;
export type EventTab = (typeof EVENT_TABS)[number];

export function EventPage({ eventId, tab }: { eventId: string; tab?: EventTab }) {
  const atlas = useAtlas();
  const dir = useDir();
  const navigate = useNavigate();
  const t = atlas.tournament(eventId);
  useSetMood({ discipline: t?.discipline, tint: t?.colors.primary });
  if (!t) return <Empty title="Event not found" />;
  const ms = atlas.matchesOf(t.id);
  const hasStages = t.stages.some((s) => s.rounds.some((r) => r.matchIds.length));
  const formatLabel = t.stages.some((s) => s.format === "round-robin") ? "Standings" : "Bracket";
  const tabs = [
    { id: "overview" as const, label: "Overview" },
    ...(hasStages ? [{ id: "bracket" as const, label: formatLabel }] : []),
    ...(ms.length ? [{ id: "matches" as const, label: "Matches", count: ms.length }] : []),
    ...(t.participantIds.length
      ? [
          {
            id: "field" as const,
            label: atlas.discipline(t.discipline).competitor === "team" ? "Teams" : "Players",
            count: t.participantIds.length,
          },
        ]
      : []),
    ...(t.placements?.length ? [{ id: "prizes" as const, label: "Prizes" }] : []),
  ];
  const active = tabs.find((x) => x.id === tab)?.id ?? "overview";
  const setTab = (id: EventTab) =>
    void navigate({
      to: "/$dir/event/$eventId",
      params: { dir, eventId: t.id },
      search: id === "overview" ? {} : { tab: id },
      replace: true,
      resetScroll: false,
    });

  return (
    <div className="space-y-10">
      <EventHeader t={t} />
      <Tabs tabs={tabs} value={active} onChange={setTab} label="Event sections" />
      {active === "overview" && <Overview t={t} onTab={setTab} />}
      {active === "bracket" && <Stages t={t} />}
      {active === "matches" && <Matches t={t} />}
      {active === "field" && <Field t={t} />}
      {active === "prizes" && <Prizes t={t} />}
    </div>
  );
}

function EventHeader({ t }: { t: Tournament }) {
  const atlas = useAtlas();
  const now = useMinute();
  const status = tournamentStatus(atlas, t, now);
  const d = atlas.discipline(t.discipline);
  const winner = champion(t);
  return (
    <header className="ui-hero rise-in">
      <div className="flex flex-wrap items-center gap-3">
        <GameBadge id={t.discipline} link />
        <span className="ui-kicker">
          {t.tier}-tier{t.series ? ` · ${t.series}` : ""}
        </span>
        {status === "live" && <LiveBadge label="In progress" />}
        {status === "completed" && (
          <span className="text-[12px] font-semibold text-muted">Completed</span>
        )}
      </div>
      <h1 className="ui-h1 mt-4 max-w-[980px]">{t.name}</h1>
      <p className="mt-4 max-w-[680px] text-[17px] leading-relaxed text-muted">
        {status === "live" ? eventDeck(atlas, t, now) : t.blurb}
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-[14px]">
        <span className="flex items-center gap-2">
          <Calendar className="size-4 text-muted" /> {dateRange(t.start, t.end)}
        </span>
        <span className="flex items-center gap-2">
          <MapPin className="size-4 text-muted" />
          {t.location
            ? `${t.location.venue ? `${t.location.venue}, ` : ""}${t.location.city}, ${countryName(t.location.country)}`
            : "Online"}
        </span>
        {t.prize && (
          <span className="flex items-center gap-2">
            <Trophy className="size-4 text-muted" /> {money(t.prize.amount, t.prize.currency)}
          </span>
        )}
        {t.participantIds.length > 0 && (
          <span className="flex items-center gap-2">
            <Users className="size-4 text-muted" /> {t.participantIds.length}{" "}
            {d.competitor === "team" ? "teams" : "players"}
          </span>
        )}
        <span className="ml-auto">
          <FollowButton follow={{ kind: "tournament", id: t.id }} />
        </span>
      </div>
      {status === "completed" && winner && (
        <CompetitorLink
          id={winner}
          className="ui-card mt-8 flex max-w-[520px] items-center gap-4 p-5"
        >
          <Trophy className="size-8 text-accent" />
          <Mark id={winner} size={44} />
          <div>
            <div className="text-[12.5px] text-muted">Champion</div>
            <div className="ui-h2">{atlas.name(winner)}</div>
          </div>
        </CompetitorLink>
      )}
      {status === "upcoming" && (
        <div className="ui-card mt-8 inline-flex items-center gap-5 p-5">
          <div>
            <div className="text-[12.5px] text-muted">Starts in</div>
            <Countdown to={`${t.start}T09:00:00Z`} className="text-[34px]" />
          </div>
          <div className="text-[13px] text-muted">{relative(`${t.start}T09:00:00Z`, now)}</div>
        </div>
      )}
    </header>
  );
}

function Overview({ t, onTab }: { t: Tournament; onTab: (id: EventTab) => void }) {
  const atlas = useAtlas();
  const now = useMinute();
  const ms = atlas.matchesOf(t.id);
  const live = ms.filter((m) => m.status === "live");
  const next = ms
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const nextDay = next[0] ? dayKey(next[0].scheduledAt) : undefined;
  const recent = ms
    .filter((m) => m.status === "finished")
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
    .slice(0, 5);

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-12">
        {live.length > 0 && (
          <Section kicker="Live" title="In play">
            <div className="grid gap-4 md:grid-cols-2">
              {live.map((m) => (
                <LiveCard key={m.id} match={m} />
              ))}
            </div>
          </Section>
        )}
        {t.stages.length > 0 && (
          <Section kicker="Format" title="How it works">
            <ol className="space-y-3">
              {t.stages.map((s, i) => {
                const sm = atlas.stageMatches(s);
                const state = sm.some((m) => m.status === "live")
                  ? "Live"
                  : sm.length && sm.every((m) => m.status === "finished")
                    ? "Complete"
                    : Date.parse(`${s.start}T00:00:00Z`) <= now
                      ? "In progress"
                      : "Upcoming";
                return (
                  <li key={s.id} className="ui-card grid gap-4 p-5 sm:grid-cols-[180px_1fr]">
                    <div>
                      <div className="text-[12px] text-faint">Stage {i + 1}</div>
                      <div className="ui-h3 mt-0.5">{s.name}</div>
                      <div className="mt-1 text-[12.5px] text-muted">
                        {dateRange(s.start, s.end)}
                      </div>
                      <div
                        className={`mt-2 text-[12px] font-semibold ${state === "Live" ? "text-live" : state === "Complete" ? "text-win" : "text-muted"}`}
                      >
                        {state === "Live" ? "● Live" : state}
                      </div>
                    </div>
                    <p className="text-[14.5px] leading-relaxed text-ink/85">{s.explainer}</p>
                  </li>
                );
              })}
            </ol>
            {t.stages.some((s) => s.rounds.some((r) => r.matchIds.length)) && (
              <button type="button" className="ui-btn mt-4" onClick={() => onTab("bracket")}>
                {t.stages.some((s) => s.format === "round-robin")
                  ? "Open standings"
                  : "Open the bracket"}
              </button>
            )}
          </Section>
        )}
        {next.length > 0 && (
          <Section kicker="Up next" title={dayLabel(next[0]!.scheduledAt, now)}>
            <div className="ui-card ui-divide overflow-hidden">
              {next
                .filter((m) => dayKey(m.scheduledAt) === nextDay)
                .map((m) => (
                  <MatchRow key={m.id} match={m} showEvent={false} />
                ))}
            </div>
          </Section>
        )}
        {recent.length > 0 && (
          <Section kicker="Results" title="Latest">
            <div className="ui-card ui-divide overflow-hidden">
              {recent.map((m) => (
                <MatchRow key={m.id} match={m} showEvent={false} />
              ))}
            </div>
          </Section>
        )}
      </div>
      <aside className="space-y-8">
        {t.placements && t.placements.length > 0 && <PrizeTable t={t} compact />}
        <div className="ui-card ui-card-pad text-[13px] text-muted">
          <div className="ui-kicker mb-2">Source</div>
          {t.provenance.source}. {t.provenance.note}
        </div>
      </aside>
    </div>
  );
}

function Stages({ t }: { t: Tournament }) {
  const atlas = useAtlas();
  const withMatches = t.stages.filter((s) => atlas.stageMatches(s).length);
  const active =
    withMatches.find((s) => atlas.stageMatches(s).some((m) => m.status !== "finished")) ??
    withMatches.at(-1) ??
    t.stages[0]!;
  const [stageId, setStageId] = useState(active.id);
  const stage = t.stages.find((s) => s.id === stageId)!;
  return (
    <div className="space-y-6">
      {t.stages.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Stage">
          {t.stages.map((s) => (
            <button
              key={s.id}
              type="button"
              className="ui-chip"
              aria-pressed={s.id === stageId}
              onClick={() => setStageId(s.id)}
            >
              <span>
                {s.name} <span className="opacity-60">· {dateRange(s.start, s.end)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="max-w-[720px] text-[14.5px] leading-relaxed text-muted">{stage.explainer}</p>
      <StageView t={t} stage={stage} />
    </div>
  );
}

function Matches({ t }: { t: Tournament }) {
  const atlas = useAtlas();
  const now = useMinute();
  const ms = [...atlas.matchesOf(t.id)].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const days = new Map<string, Match[]>();
  for (const m of ms)
    days.set(dayKey(m.scheduledAt), [...(days.get(dayKey(m.scheduledAt)) ?? []), m]);
  return (
    <div className="space-y-8">
      {[...days.values()].map((list) => (
        <section key={list[0]!.id}>
          <div className="ui-label mb-2">
            {dayLabel(list[0]!.scheduledAt, now)} ·{" "}
            {[...new Set(list.map((m) => atlas.roundOf(m)?.name))].join(", ")}
          </div>
          <div className="ui-card ui-divide overflow-hidden">
            {list.map((m) => (
              <MatchRow key={m.id} match={m} showEvent={false} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Field({ t }: { t: Tournament }) {
  const atlas = useAtlas();
  const placed = new Map<string, string>();
  for (const p of t.placements ?? []) for (const id of p.competitorIds) placed.set(id, p.place);
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {t.participantIds.map((id) => {
        const c = atlas.competitor(id)!;
        const roster =
          c.kind === "team" ? atlas.roster(id).filter((r) => r.stint.role !== "Coach") : [];
        return (
          <CompetitorLink
            key={id}
            id={id}
            className="ui-card flex flex-col p-5 transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3">
              <Mark id={id} size={40} />
              <div className="min-w-0">
                <div className="ui-h3 truncate">{atlas.name(id)}</div>
                <div className="text-[12.5px] text-muted">
                  {c.kind === "team"
                    ? c.region
                    : `${c.title ?? ""} ${c.rating?.value ?? ""}`.trim()}{" "}
                  {c.kind === "player" && <Country code={c.country} className="ml-1" />}
                </div>
              </div>
            </div>
            {roster.length > 0 && (
              <div className="mt-4 text-[12.5px] leading-relaxed text-muted">
                {roster.map((r) => r.player.handle).join(" · ")}
              </div>
            )}
            {placed.get(id) && (
              <div className="mt-auto pt-4 text-[12.5px] font-semibold text-accent">
                Finished {placed.get(id)}
              </div>
            )}
          </CompetitorLink>
        );
      })}
    </div>
  );
}

function Prizes({ t }: { t: Tournament }) {
  return (
    <div className="max-w-[760px]">
      <PrizeTable t={t} />
    </div>
  );
}

function PrizeTable({ t, compact = false }: { t: Tournament; compact?: boolean }) {
  const atlas = useAtlas();
  return (
    <div className="ui-card overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
        <span className="ui-h3">Prize money</span>
        {t.prize && (
          <span className="ui-num text-[15px]">{money(t.prize.amount, t.prize.currency)}</span>
        )}
      </div>
      <table className="w-full text-[14px]">
        <tbody>
          {(t.placements ?? []).map((p) => (
            <tr key={p.place} className="border-t border-line first:border-0">
              <td className="w-20 px-4 py-2.5 align-top font-semibold">{p.place}</td>
              <td className="py-2.5">
                {p.competitorIds.length ? (
                  <span className="flex flex-col gap-1.5">
                    {p.competitorIds.slice(0, compact ? 4 : 99).map((id) => (
                      <CompetitorLink
                        key={id}
                        id={id}
                        className="flex items-center gap-2 hover:text-accent"
                      >
                        <Mark id={id} size={18} />
                        <span className="truncate">{atlas.name(id)}</span>
                      </CompetitorLink>
                    ))}
                  </span>
                ) : (
                  <span className="text-faint">To be decided</span>
                )}
              </td>
              <td className="ui-num px-4 py-2.5 text-right align-top text-[14px] text-muted">
                {p.prize && t.prize ? money(p.prize, t.prize.currency) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
