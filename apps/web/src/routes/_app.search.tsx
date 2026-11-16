import { createFileRoute } from "@tanstack/react-router";
import { Search } from "../bearing/lists";

export const Route = createFileRoute("/_app/search")({ component: Search });
