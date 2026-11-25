import "@fontsource-variable/zalando-sans/wdth.css";
import "../bearing/bearing.css";

import type { QueryClient } from "@tanstack/react-query";
import { Link, Outlet, createRootRouteWithContext, useRouter } from "@tanstack/react-router";
import { ShellProblem, ShellWaiting } from "../bearing/shell";
import { Problem } from "../bearing/ui";
import { loadWorld } from "../lib/world";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: ({ context }) => loadWorld(context.queryClient),
  // The world is loaded when the app opens and kept current by the store from then on; no
  // move between pages is a reason to load it again.
  staleTime: Infinity,
  // The frame is there from the first moment; a page on its way arrives into it.
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: ShellWaiting,
  errorComponent: function RootError() {
    const router = useRouter();
    return (
      <ShellProblem>
        <Problem title="Kiming could not load" onRetry={() => void router.invalidate()}>
          The schedule did not arrive. Nothing is wrong on your side that we know of.
        </Problem>
      </ShellProblem>
    );
  },
  component: () => <Outlet />,
  notFoundComponent: () => (
    <ShellProblem>
      <Problem title="There is nothing at this address">
        The address may be mistyped, or what it led to is no longer kept.{" "}
        <Link to="/" style={{ textDecoration: "underline" }}>
          Today
        </Link>{" "}
        shows what is on, and{" "}
        <Link to="/search" style={{ textDecoration: "underline" }}>
          Search
        </Link>{" "}
        finds a team, a player or an event.
      </Problem>
    </ShellProblem>
  ),
});
