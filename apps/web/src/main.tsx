import "@fontsource-variable/zalando-sans/wdth.css";
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
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// A page left open across a release may ask for a piece of code that the release replaced.
// Vite says so with this event; the answer is to load the app afresh, a few times at most
// (see the page's own script, which does the same when its first piece of code is missing).
window.addEventListener("vite:preloadError", () => window.bearingAgain?.());

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <Backend navigate={(href, replace) => void router.navigate({ href, replace })}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </Backend>
  </StrictMode>,
);
