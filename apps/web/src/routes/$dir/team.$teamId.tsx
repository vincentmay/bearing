import { createFileRoute } from "@tanstack/react-router";
import { TeamPage } from "../../pages/team";

export const Route = createFileRoute("/$dir/team/$teamId")({
  component: function Page() {
    const { teamId } = Route.useParams();
    return <TeamPage key={teamId} teamId={teamId} />;
  },
});
