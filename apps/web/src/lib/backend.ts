import { ConvexQueryClient } from "@convex-dev/react-query";
import { ConvexReactClient } from "convex/react";

/**
 * Where the app gets its data. With a Convex address configured it reads Bearing's own store,
 * live. Without one it runs entirely in the browser on the sample world, which is also how
 * the screenshot checks run it.
 *
 * Both values come from the environment at build time; see .env.example. Neither is a secret:
 * they are addresses and a publishable key, and end up in the page either way.
 */
const url: string | undefined = import.meta.env.VITE_CONVEX_URL;

/** In development, `localStorage["bearing.source"] = "local"` keeps the app off the backend. */
function local(): boolean {
  try {
    return import.meta.env.DEV && localStorage.getItem("bearing.source") === "local";
  } catch {
    return false;
  }
}

export const convex = url && !local() ? new ConvexReactClient(url) : null;
export const convexQueryClient = convex ? new ConvexQueryClient(convex) : null;

/** Clerk's publishable key. Accounts are on only when there is a backend to keep follows in. */
const key: string | undefined = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
export const clerkKey = convex && key ? key : null;
