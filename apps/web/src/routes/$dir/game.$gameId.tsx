import { createFileRoute } from "@tanstack/react-router";
import { GamePage } from "../../pages/game";

export const Route = createFileRoute("/$dir/game/$gameId")({
  component: function Page() {
    const { gameId } = Route.useParams();
    return <GamePage key={gameId} gameId={gameId} />;
  },
});
