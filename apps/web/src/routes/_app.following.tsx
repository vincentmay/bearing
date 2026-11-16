import { createFileRoute } from "@tanstack/react-router";
import { Following } from "../bearing/lists";

export const Route = createFileRoute("/_app/following")({ component: Following });
