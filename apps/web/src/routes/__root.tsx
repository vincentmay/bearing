import "@fontsource-variable/gabarito";
import "../bearing/bearing.css";

import type { QueryClient } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, useRouter } from "@tanstack/react-router";
import { ShellWaiting } from "../bearing/shell";
import { Problem } from "../bearing/ui";
import { loadWorld } from "../lib/world";

/** A bare page in the Bearing frame, for when the app itself has nothing to show yet. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="bx">
      <main className="bx-page">{children}</main>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: ({ context }) => loadWorld(context.queryClient),
  // The frame is there from the first moment; a page on its way arrives into it.
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: ShellWaiting,
  errorComponent: function RootError() {
    const router = useRouter();
    return (
      <Frame>
        <Problem title="Bearing could not load" onRetry={() => void router.invalidate()}>
          The schedule did not arrive. Nothing is wrong on your side that we know of.
        </Problem>
      </Frame>
    );
  },
  component: () => <Outlet />,
  notFoundComponent: () => (
    <Frame>
      <Problem title="There is nothing at this address">
        <a href="/" style={{ textDecoration: "underline" }}>
          Back to today
        </a>
      </Problem>
    </Frame>
  ),
});
