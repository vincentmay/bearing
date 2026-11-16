import { tournamentStatus } from "@bearing/domain";
import { EventCard } from "../components/event-card";
import { CompetitorLink } from "../components/links";
import { LiveCard } from "../components/live-card";
import { Mark } from "../components/mark";
import { MatchRow } from "../components/match-row";
import { Empty, FollowButton, Section } from "../components/ui";
import { useSetMood } from "../lib/mood";
import { useAtlas, useMinute } from "../lib/world";

export function GamePage({ gameId }: { gameId: string }) {
  const atlas = useAtlas();
  const now = useMinute();
  const d = atlas.world.disciplines.find((x) => x.id === gameId);
  useSetMood({ discipline: d?.id, tint: d?.palette.accent });
  if (!d) return <Empty title="Game not found" />;
  const ms = atlas.world.matches.filter((m) => atlas.tournamentOf(m).discipline === d.id);
  const live = ms.filter((m) => m.status === "live");
  const next = ms
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .slice(0, 6);
  const events = atlas.world.tournaments.filter((t) => t.discipline === d.id);
  const groups = (["live", "upcoming", "completed"] as const).map((s) => ({
    s,
    list: events.filter((t) => tournamentStatus(atlas, t, now) === s),
  }));
  const ranking = atlas.world.rankings.find((r) => r.discipline === d.id);
  return (
    <div className="space-y-14">
      <header className="ui-hero rise-in">
        <div className="ui-kicker">Game</div>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h1 className="ui-h1">{d.name}</h1>
          <FollowButton follow={{ kind: "discipline", id: d.id }} />
        </div>
        <p className="mt-3 text-[16px] text-muted">
          {live.length} live ·{" "}
          {next.length
            ? `${ms.filter((m) => m.status === "scheduled").length} upcoming`
            : "nothing upcoming"}{" "}
          · {events.length} events this season
        </p>
      </header>
      {live.length > 0 && (
        <Section kicker="Live now" title="In play">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {live.map((m) => (
              <LiveCard key={m.id} match={m} />
            ))}
          </div>
        </Section>
      )}
      <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-12">
          {next.length > 0 && (
            <Section kicker="Up next" title="Coming up">
              <div className="ui-card ui-divide overflow-hidden">
                {next.map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </div>
            </Section>
          )}
          {groups.map(
            ({ s, list }) =>
              list.length > 0 && (
                <Section
                  key={s}
                  kicker="Events"
                  title={
                    s === "live" ? "Happening now" : s === "upcoming" ? "Coming up" : "Completed"
                  }
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    {list.map((t) => (
                      <EventCard key={t.id} t={t} />
                    ))}
                  </div>
                </Section>
              ),
          )}
        </div>
        {ranking && (
          <aside>
            <Section kicker="Sample ranking" title={ranking.title}>
              <div className="ui-card ui-divide overflow-hidden">
                {ranking.entries.map((e, i) => (
                  <CompetitorLink
                    key={e.competitorId}
                    id={e.competitorId}
                    className="ui-row flex items-center gap-3 px-4 py-2.5 text-[14px]"
                  >
                    <span className="ui-num w-6 text-[14px] text-muted">{i + 1}</span>
                    <Mark id={e.competitorId} size={24} />
                    <span className="flex-1 truncate font-medium">
                      {atlas.name(e.competitorId)}
                    </span>
                    <span
                      className={`w-8 text-right text-[12px] ${e.change > 0 ? "text-win" : e.change < 0 ? "text-loss" : "text-faint"}`}
                    >
                      {e.change > 0 ? `▲${e.change}` : e.change < 0 ? `▼${-e.change}` : "–"}
                    </span>
                    <span className="ui-num w-12 text-right text-[13px] text-muted">
                      {e.points}
                    </span>
                  </CompetitorLink>
                ))}
              </div>
            </Section>
          </aside>
        )}
      </div>
    </div>
  );
}
