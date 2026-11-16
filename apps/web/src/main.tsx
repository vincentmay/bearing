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
