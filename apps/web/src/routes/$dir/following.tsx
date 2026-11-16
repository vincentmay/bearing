import { createFileRoute } from "@tanstack/react-router";
import { FollowingPage } from "../../pages/following";

export const Route = createFileRoute("/$dir/following")({ component: FollowingPage });
