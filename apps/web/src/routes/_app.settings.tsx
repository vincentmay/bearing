import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "../bearing/settings";

export const Route = createFileRoute("/_app/settings")({ component: Settings });
