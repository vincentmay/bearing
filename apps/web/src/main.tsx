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

// A page left open across a release may ask for a piece of code that the release replaced.
// Vite says so with this event; the answer is to load the app afresh, once, and not in a loop
// if the fresh one cannot be had either.
window.addEventListener("vite:preloadError", () => {
  const key = "bearing.reloaded";
  try {
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < 30_000) return;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    return;
  }
  window.location.reload();
});

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <Backend>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </Backend>
  </StrictMode>,
);
