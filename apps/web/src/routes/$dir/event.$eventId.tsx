import { createFileRoute } from "@tanstack/react-router";
import { EventPage, EVENT_TABS, type EventTab } from "../../pages/event";

export const Route = createFileRoute("/$dir/event/$eventId")({
  validateSearch: (s: Record<string, unknown>): { tab?: EventTab } =>
    typeof s.tab === "string" && (EVENT_TABS as readonly string[]).includes(s.tab)
      ? { tab: s.tab as EventTab }
      : {},
  component: function Page() {
    const { eventId } = Route.useParams();
    const { tab } = Route.useSearch();
    return <EventPage key={eventId} eventId={eventId} tab={tab} />;
  },
});
