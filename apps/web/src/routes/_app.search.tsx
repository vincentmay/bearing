import { createFileRoute } from "@tanstack/react-router";
import { Finder } from "../bearing/find";

/** Search on a page of its own, for an address that leads here; everywhere else it opens over the page. */
export const Route = createFileRoute("/_app/search")({ component: () => <Finder page /> });
