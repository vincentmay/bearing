import type { AuthConfig } from "convex/server";

/**
 * Sign-in goes through Clerk. The issuer domain must be set on the Convex deployment as
 * CLERK_JWT_ISSUER_DOMAIN before functions can be pushed (see .env.example). It is not a
 * secret, but it differs between Clerk's development and production instances, so it is not
 * written here.
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
