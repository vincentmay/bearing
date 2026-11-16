import { createFileRoute } from "@tanstack/react-router";
import { TournamentPage } from "../bearing/tournament";

export const Route = createFileRoute("/_app/tournament/$tournamentId")({
  component: function TournamentRoute() {
    const { tournamentId } = Route.useParams();
    return <TournamentPage tournamentId={tournamentId} />;
  },
});
