import "@fontsource-variable/zalando-sans/wdth.css";
import "../bearing/bearing.css";

import type { QueryClient } from "@tanstack/react-query";
import { Link, Outlet, createRootRouteWithContext, useRouter } from "@tanstack/react-router";
import { ShellProblem, ShellWaiting } from "../bearing/shell";
import { Moment } from "../bearing/sky";
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
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    return (
      <ShellProblem>
        <Moment
          alert
          className="bx-problem"
          title={offline ? "You're offline." : "Couldn't reach the schedule."}
          action={
            <button type="button" className="bx-ghost" onClick={() => void router.invalidate()}>
              Try again
            </button>
          }
        >
          {offline
            ? "The schedule comes back as soon as the connection does."
            : "Nothing is wrong on your side that we know of. Try again in a moment."}
        </Moment>
      </ShellProblem>
    );
  },
  component: () => <Outlet />,
  notFoundComponent: () => (
    <ShellProblem>
      <Moment
        className="bx-problem"
        title="Past the horizon."
        action={
          <Link to="/" className="bx-ghost">
            Back to Live
          </Link>
        }
      >
        This page doesn't exist. What is live is this way, and <Link to="/search">Search</Link>{" "}
        finds a team, a player or an event.
      </Moment>
    </ShellProblem>
  ),
});
