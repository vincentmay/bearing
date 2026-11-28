import { createFileRoute } from "@tanstack/react-router";
import { FollowMore } from "../bearing/welcome";

/** More to follow: the top of each game and what is on, with search beside it. */
export const Route = createFileRoute("/_app/following_/add")({ component: FollowMore });
