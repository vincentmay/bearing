import type { Follow } from "@bearing/domain";
import { ClerkProvider, useAuth, useClerk, useUser } from "@clerk/react";
import { ConvexProvider, useConvexAuth, useMutation, useQuery } from "convex/react";
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

/** Clerk's own screens, restyled to the identity: indigo, Zalando Sans, one card. */
function useClerkLook() {
  const { theme } = usePrefs();
  const dark = theme === "dark" || (theme === "system" && window.matchMedia(DARK).matches);
  const ink = dark ? "#ffffff" : "#020307";
  const surface = dark ? "#0f1119" : "#ffffff";
  const sunk = dark ? "#1d2029" : "#edeef3";
  const ink2 = dark ? "#c1c4cc" : "#5a5d67";
  const hair = dark ? "rgb(255 255 255 / 0.12)" : "rgb(19 22 31 / 0.1)";
  const accent = dark ? "#9fb5fe" : "#3140d6";
  return {
    variables: {
      colorPrimary: accent,
      colorText: ink,
      colorTextSecondary: ink2,
      colorTextOnPrimaryBackground: dark ? "#020307" : "#ffffff",
      colorBackground: surface,
      colorInputBackground: sunk,
      colorInputText: ink,
      colorNeutral: ink,
      colorDanger: ink,
      colorSuccess: ink,
      colorWarning: ink,
      fontFamily: '"Zalando Sans Variable", system-ui, sans-serif',
      fontFamilyButtons: '"Zalando Sans Variable", system-ui, sans-serif',
      borderRadius: "14px",
    },
    elements: {
      // One box, with the same hairline, shadow and corners as every other card.
      cardBox: {
        borderRadius: "24px",
        border: `1px solid ${hair}`,
        boxShadow: dark ? "0 12px 28px -14px #000" : "0 10px 24px -14px rgb(0 0 0 / 0.28)",
      },
      // No box inside the box: the card and its footer are one flat surface.
      card: { boxShadow: "none", borderRadius: "0", border: "0", background: surface },
      footer: {
        background: surface,
        backgroundImage: "none",
        "& > *": { background: surface, backgroundImage: "none" },
      },
      headerTitle: { fontWeight: 800, letterSpacing: "-0.03em", fontSize: "26px" },
      // Flat: Clerk's own button has a sheen and a shadow, which the identity does not allow.
      formButtonPrimary: {
        borderRadius: "999px",
        boxShadow: "none",
        backgroundImage: "none",
        textTransform: "none",
        fontWeight: 600,
        "&::before, &::after": { display: "none" },
        "&:hover, &:focus, &:active": { boxShadow: "none", backgroundImage: "none" },
      },
      socialButtonsBlockButton: {
        borderRadius: "999px",
        boxShadow: "none",
        border: `1px solid ${hair}`,
      },
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
  // Asked on the account's own connection, which knows who is signed in.
  const data = useQuery(api.follows.list, isAuthenticated ? {} : "skip");
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
  /** What to call the viewer, and their own picture if they have set one. */
  name?: string;
  image?: string;
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
    name: user?.firstName ?? user?.username ?? user?.primaryEmailAddress?.emailAddress,
    image: user?.hasImage ? user.imageUrl : undefined,
    signIn: () => clerk.openSignIn(),
    signOut: () => void clerk.signOut(),
    manage: () => clerk.openUserProfile(),
  };
}

/** Who is signed in, for the Settings screen. */
export const useAccount: () => Account = accounts ? useClerkAccount : () => NO_ACCOUNTS;
