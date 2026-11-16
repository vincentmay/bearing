import { createFileRoute } from "@tanstack/react-router";
import { Today } from "../bearing/today";

export const Route = createFileRoute("/_app/")({ component: Today });
