import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "../bearing/shell";

export const Route = createFileRoute("/_app")({ component: Shell });
