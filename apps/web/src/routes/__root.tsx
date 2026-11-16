import type { QueryClient } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { worldQuery } from "../lib/world";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: ({ context }) => context.queryClient.ensureQueryData(worldQuery),
  component: () => <Outlet />,
  notFoundComponent: () => (
    <div className="grid min-h-dvh place-items-center text-muted">
      <p>
        Nothing here.{" "}
        <a href="/" className="text-ink underline">
          Back to Slate
        </a>
      </p>
    </div>
  ),
});
