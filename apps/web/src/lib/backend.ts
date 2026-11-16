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

const on = url && !local() ? url : null;

/** The connection an account lives on: it waits for sign-in to be settled before it speaks. */
export const convex = on ? new ConvexReactClient(on) : null;

/**
 * The connection the world is read on. The world is the same for everyone, so it has no need
 * to know who is asking, and a connection that does not wait for sign-in starts reading the
 * moment the page does, about half a second sooner.
 */
export const reader = on ? new ConvexReactClient(on) : null;
export const convexQueryClient = reader ? new ConvexQueryClient(reader) : null;

/** Which store this copy of the app reads; what is kept in the browser is kept per store. */
export const storeName = on ?? "sample";

/** Clerk's publishable key. Accounts are on only when there is a backend to keep follows in. */
const key: string | undefined = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
export const clerkKey = convex && key ? key : null;
