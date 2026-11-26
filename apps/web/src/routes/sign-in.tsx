import { createFileRoute } from "@tanstack/react-router";
import { SignInPage } from "../bearing/signin";

/** Only an address on this site is a place to come back to. */
function backTo(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";
}

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search: Record<string, unknown>): { from?: string } =>
    search.from === undefined ? {} : { from: backTo(search.from) },
  component: function SignInRoute() {
    const { from } = Route.useSearch();
    return <SignInPage back={from ?? "/"} />;
  },
});
