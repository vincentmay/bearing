import { createFileRoute } from "@tanstack/react-router";
import { RankingPage } from "../bearing/ranking";

export const Route = createFileRoute("/_app/ranking/$discipline")({
  component: function RankingRoute() {
    const { discipline } = Route.useParams();
    return <RankingPage discipline={discipline} />;
  },
});
