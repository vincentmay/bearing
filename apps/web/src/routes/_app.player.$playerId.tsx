import { createFileRoute } from "@tanstack/react-router";
import { PlayerPage } from "../bearing/player";

export const Route = createFileRoute("/_app/player/$playerId")({
  component: function PlayerRoute() {
    const { playerId } = Route.useParams();
    return <PlayerPage playerId={playerId} />;
  },
});
