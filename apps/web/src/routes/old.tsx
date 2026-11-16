import { createFileRoute } from "@tanstack/react-router";
import { Explore } from "../pages/explore";

// The six earlier design directions, kept for reference. The app itself now starts at "/".
export const Route = createFileRoute("/old")({ component: Explore });
