import { createFileRoute } from "@tanstack/react-router";
import { Schedule } from "../bearing/lists";

export const Route = createFileRoute("/_app/schedule")({ component: Schedule });
