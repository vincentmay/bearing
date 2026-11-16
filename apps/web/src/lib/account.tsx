import type { Follow } from "@bearing/domain";
import { ClerkProvider, useAuth, useClerk, useUser } from "@clerk/clerk-react";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { ConvexProvider, useConvexAuth, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { type ReactNode, useCallback, useEffect } from "react";
import { api } from "../../convex/_generated/api";
import { clerkKey, convex } from "./backend";
import { storedFollows, toggleFollow } from "./follows";
import { usePrefs } from "./prefs";

/**
 * Accounts: optional, through Clerk, with follows kept in Convex. The app is fully usable
 * without one; then follows stay on the device. Signing in adds sync and is never a wall.
 *
 * Whether accounts exist at all is decided when the app is built (a Clerk key and a Convex
 * address are both configured), so each hook below is chosen once, here, and not on every call.
 */
export const accounts = clerkKey !== null;

const DARK = "(prefers-color-scheme: dark)";

/** Clerk's own screens, restyled to the identity: black and white, Gabarito, one card. */
function useClerkLook() {
  const { theme } = usePrefs();
  const dark = theme === "dark" || (theme === "system" && window.matchMedia(DARK).matches);
  const ink = dark ? "#ffffff" : "#000000";
  const surface = dark ? "#111111" : "#ffffff";
  const sunk = dark ? "#1e1e1e" : "#f1f1f1";
  const ink2 = dark ? "#a6a6a6" : "#5c5c5c";
  const hair = dark ? "rgb(255 255 255 / 0.13)" : "rgb(0 0 0 / 0.1)";
  return {
    variables: {
      colorPrimary: ink,
      colorText: ink,
      colorTextSecondary: ink2,
      colorTextOnPrimaryBackground: surface,
      colorBackground: surface,
      colorInputBackground: sunk,
      colorInputText: ink,
      colorNeutral: ink,
      colorDanger: ink,
      colorSuccess: ink,
      colorWarning: ink,
      fontFamily: '"Gabarito Variable", system-ui, sans-serif',
      fontFamilyButtons: '"Gabarito Variable", system-ui, sans-serif',
      borderRadius: "14px",
    },
    elements: {
      // One box, with the same hairline, shadow and corners as every other card.
      cardBox: {
        borderRadius: "24px",
        border: `1px solid ${hair}`,
        boxShadow: dark ? "0 12px 28px -14px #000" : "0 10px 24px -14px rgb(0 0 0 / 0.28)",
      },
      card: { boxShadow: "none", borderRadius: "24px" },
      footer: { background: surface },
      headerTitle: { fontWeight: 800, letterSpacing: "-0.03em", fontSize: "26px" },
      formButtonPrimary: {
        borderRadius: "999px",
        boxShadow: "none",
        textTransform: "none",
        fontWeight: 600,
      },
      socialButtonsBlockButton: { borderRadius: "999px", boxShadow: "none" },
      formFieldInput: { borderRadius: "999px", boxShadow: "none", border: "0" },
      dividerLine: { background: hair },
    },
  } as const;
}

function WithClerk({ children }: { children: ReactNode }) {
  const appearance = useClerkLook();
  return (
    <ClerkProvider publishableKey={clerkKey!} afterSignOutUrl="/" appearance={appearance}>
      <ConvexProviderWithClerk client={convex!} useAuth={useAuth}>
        <CarryOver />
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

/** Puts the backend, and accounts if there are any, around the app. */
export function Backend({ children }: { children: ReactNode }) {
  if (!convex) return <>{children}</>;
  if (!accounts) return <ConvexProvider client={convex}>{children}</ConvexProvider>;
  return <WithClerk>{children}</WithClerk>;
}

const followsQuery = convexQuery(api.follows.list, {});

/**
 * Follows made on this device before signing in are carried into the account the first time
 * that account is used here. After that the account's list is the one that counts.
 */
function CarryOver() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const merge = useMutation(api.follows.merge);
  const id = user?.id;
  useEffect(() => {
    if (!isAuthenticated || !id) return;
    const flag = `bearing.carried.${id}`;
    try {
      if (localStorage.getItem(flag)) return;
      const mine = storedFollows();
      void merge({ follows: mine ?? [] }).then(() => localStorage.setItem(flag, "1"));
    } catch {
      // Storage unavailable: there is nothing on this device to carry over.
    }
  }, [isAuthenticated, id, merge]);
  return null;
}

function useSignedInFollows(): Follow[] | null {
  const { isAuthenticated } = useConvexAuth();
  const { data } = useQuery({ ...followsQuery, enabled: isAuthenticated });
  return isAuthenticated ? (data ?? null) : null;
}

/** The account's follows, or null when nobody is signed in or there are no accounts. */
export const useAccountFollows: () => Follow[] | null = accounts ? useSignedInFollows : () => null;

function useAccountToggle(): (f: Follow) => void {
  const { isAuthenticated } = useConvexAuth();
  // The star answers at once; the server confirms a moment later.
  const toggle = useMutation(api.follows.toggle).withOptimisticUpdate((store, { follow }) => {
    const list = store.getQuery(api.follows.list, {});
    if (!list) return;
    const has = list.some((x) => x.kind === follow.kind && x.id === follow.id);
    store.setQuery(
      api.follows.list,
      {},
      has ? list.filter((x) => !(x.kind === follow.kind && x.id === follow.id)) : [...list, follow],
    );
  });
  return useCallback(
    (f: Follow) => {
      if (isAuthenticated) void toggle({ follow: f });
      else toggleFollow(f);
    },
    [isAuthenticated, toggle],
  );
}

/** Follow or stop following: in the account when signed in, on this device otherwise. */
export const useToggleFollow: () => (f: Follow) => void = accounts
  ? useAccountToggle
  : () => toggleFollow;

export interface Account {
  /** "none": this copy of Bearing has no accounts. */
  state: "none" | "loading" | "out" | "in";
  email?: string;
  signIn: () => void;
  signOut: () => void;
  manage: () => void;
}

const NO_ACCOUNTS: Account = {
  state: "none",
  signIn: () => {},
  signOut: () => {},
  manage: () => {},
};

function useClerkAccount(): Account {
  const clerk = useClerk();
  const { isLoaded, isSignedIn, user } = useUser();
  return {
    state: !isLoaded ? "loading" : isSignedIn ? "in" : "out",
    email: user?.primaryEmailAddress?.emailAddress,
    signIn: () => clerk.openSignIn(),
    signOut: () => void clerk.signOut(),
    manage: () => clerk.openUserProfile(),
  };
}

/** Who is signed in, for the Settings screen. */
export const useAccount: () => Account = accounts ? useClerkAccount : () => NO_ACCOUNTS;
