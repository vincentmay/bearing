import { createFileRoute } from "@tanstack/react-router";
import { MatchPage } from "../../pages/match";

export const Route = createFileRoute("/$dir/match/$matchId")({
  component: function Page() {
    const { matchId } = Route.useParams();
    return <MatchPage key={matchId} matchId={matchId} />;
  },
});
