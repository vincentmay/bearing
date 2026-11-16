import "@fontsource-variable/gabarito";
import "@fontsource-variable/geist-mono";
import "./bearing/bearing.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Backend } from "./lib/account";
import { convexQueryClient } from "./lib/backend";
import { routeTree } from "./routeTree.gen";

// With a backend, queries are subscriptions: Convex pushes every new result into the cache.
const queryClient = new QueryClient(
  convexQueryClient
    ? {
        defaultOptions: {
          queries: {
            queryKeyHashFn: convexQueryClient.hashFn(),
            queryFn: convexQueryClient.queryFn(),
          },
        },
      }
    : undefined,
);
convexQueryClient?.connect(queryClient);

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  scrollRestoration: true,
  // One page gives way to the next, where the browser can do that, and how depends on the
  // move: between tabs it is a plain, quick change; going into a page and coming back out
  // have a direction.
  defaultViewTransition: {
    types: ({ fromLocation, toLocation }) => {
      const tab = (path: string | undefined) =>
        path === "/" || path === "/schedule" || path === "/following" || path === "/search";
      if (tab(fromLocation?.pathname) && tab(toLocation.pathname)) return ["tab"];
      return [tab(toLocation.pathname) ? "out" : "in"];
    },
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <Backend>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </Backend>
  </StrictMode>,
);
