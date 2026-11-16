import { createFileRoute } from "@tanstack/react-router";
import { PlayerPage } from "../../pages/player";

export const Route = createFileRoute("/$dir/player/$playerId")({
  component: function Page() {
    const { playerId } = Route.useParams();
    return <PlayerPage key={playerId} playerId={playerId} />;
  },
});
