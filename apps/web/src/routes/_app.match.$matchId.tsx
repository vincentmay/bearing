import { createFileRoute } from "@tanstack/react-router";
import { MatchPage } from "../bearing/match";

export const Route = createFileRoute("/_app/match/$matchId")({
  component: function MatchRoute() {
    const { matchId } = Route.useParams();
    return <MatchPage matchId={matchId} />;
  },
});
