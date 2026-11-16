import { createFileRoute } from "@tanstack/react-router";
import { TeamPage } from "../bearing/team";

export const Route = createFileRoute("/_app/team/$teamId")({
  component: function TeamRoute() {
    const { teamId } = Route.useParams();
    return <TeamPage teamId={teamId} />;
  },
});
