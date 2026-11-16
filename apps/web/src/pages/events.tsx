import type { DisciplineId } from "@bearing/domain";
import { tournamentStatus } from "@bearing/domain";
import { useState } from "react";
import { EventCard } from "../components/event-card";
import { Empty, Section } from "../components/ui";
import { useAtlas, useMinute } from "../lib/world";

export function EventsPage() {
  const atlas = useAtlas();
  const now = useMinute();
  const [game, setGame] = useState<DisciplineId | "all">("all");
  const events = atlas.world.tournaments.filter((t) => game === "all" || t.discipline === game);
  const groups = [
    {
      id: "live",
      title: "Happening now",
      list: events.filter((t) => tournamentStatus(atlas, t, now) === "live"),
    },
    {
      id: "upcoming",
      title: "Coming up",
      list: events
        .filter((t) => tournamentStatus(atlas, t, now) === "upcoming")
        .sort((a, b) => a.start.localeCompare(b.start)),
    },
    {
      id: "completed",
      title: "Completed",
      list: events
        .filter((t) => tournamentStatus(atlas, t, now) === "completed")
        .sort((a, b) => b.end.localeCompare(a.end)),
    },
  ];
  return (
    <div className="space-y-12">
      <header>
        <div className="ui-kicker">Events</div>
        <h1 className="ui-h1 mt-2 !text-[44px] sm:!text-[64px]">Every event, one place</h1>
        <div
          className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
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
      </header>
      {groups.every((g) => g.list.length === 0) && <Empty title="No events for this game yet" />}
      {groups.map(
        (g) =>
          g.list.length > 0 && (
            <Section
              key={g.id}
              kicker={`${g.list.length} ${g.list.length === 1 ? "event" : "events"}`}
              title={g.title}
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {g.list.map((t) => (
                  <EventCard key={t.id} t={t} />
                ))}
              </div>
            </Section>
          ),
      )}
    </div>
  );
}
