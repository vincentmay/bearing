import "@fontsource-variable/gabarito";
import "@fontsource-variable/geist-mono";
import "./bearing.css";

import type { Atlas } from "@bearing/domain";
import { Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { CalendarDays, House, Search, Star } from "lucide-react";
import { type ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import { usePrefs } from "../lib/prefs";
import { useSamplePlayer } from "./live";
import { useAtlas } from "../lib/world";
import { nameOf, useTrail } from "./trail";
import { AccountLink, Mark, Waiting } from "./ui";

const TABS = [
  { to: "/", label: "Today", icon: House },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/following", label: "Following", icon: Star },
  { to: "/search", label: "Search", icon: Search },
] as const;

type Tab = (typeof TABS)[number];

/** The tab the viewer is in, which is also where "back" leads from a page further in. */
const Origin = createContext<Tab>(TABS[0]);

export function useOrigin(): Tab {
  return useContext(Origin);
}

/**
 * The frame every Bearing screen sits in. On a phone the navigation is a small floating capsule
 * of four icons at the bottom, within reach of a thumb. With room it moves to the top, gains
 * its labels, and sits between the mark and the settings.
 */
/** Which tab an address belongs to, or none for a page further in. */
function tabOf(path: string): number {
  return TABS.findIndex((t) => (t.to === "/" ? path === "/" : path.startsWith(t.to)));
}

/**
 * The frame itself: the mark, the way to the account, and the navigation. It is there from the
 * first moment, around whatever the page is doing, so that a page still on its way arrives
 * into a frame that has not moved.
 */
function Chrome({
  active,
  inner,
  children,
}: {
  active: number;
  inner: boolean;
  children: ReactNode;
}) {
  const { theme } = usePrefs();
  return (
    <div className="bx" data-theme={theme === "system" ? undefined : theme}>
      {/* For whoever moves by keyboard: past the frame, straight to the page. */}
      <a href="#main" className="bx-skip">
        Skip to the page
      </a>
      <header className="bx-top">
        <Link to="/" className="bx-brand" aria-label="Bearing: today">
          <Mark size={28} />
          <span aria-hidden>bearing</span>
        </Link>
        <AccountLink />
      </header>
      {children}
      <nav className="bx-nav" aria-label="Main">
        <i style={{ transform: `translateX(${active * 100}%)` }} />
        {TABS.map((tab, i) => (
          <Link
            key={tab.to}
            to={tab.to}
            aria-label={tab.label}
            aria-current={i === active && !inner ? "page" : undefined}
            title={tab.label}
            data-on={i === active ? "" : undefined}
          >
            <tab.icon size={20} strokeWidth={2} />
            <span aria-hidden>{tab.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

/**
 * Which page an address belongs to. The parts of one event (its group stage, its semifinals,
 * its final) are one page with several addresses: moving between them changes what the page
 * shows and does not replace it.
 */
function pageOf(atlas: Atlas, path: string): string {
  const [, kind, raw] = path.split("/");
  const series =
    kind === "tournament" && raw ? atlas.tournament(decodeURIComponent(raw))?.series : undefined;
  return series ? `event:${series}` : path;
}

/** The frame while the world is on its way: the same frame, with the shape of a page in it. */
export function ShellWaiting() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const found = tabOf(path);
  return (
    <Chrome active={Math.max(found, 0)} inner={found < 0}>
      <main className="bx-page">
        <Waiting title={found >= 0 ? TABS[found]?.label : undefined} />
      </main>
    </Chrome>
  );
}

/** The frame around something that went wrong or is not there, with the ways on intact. */
export function ShellProblem({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const found = tabOf(path);
  return (
    <Chrome active={Math.max(found, 0)} inner={found < 0}>
      <main className="bx-page">{children}</main>
    </Chrome>
  );
}

export function Shell() {
  useSamplePlayer();
  useTrail();
  // The four tabs are a press away at any moment: their code is fetched as soon as the first
  // page stands, so that pressing one never waits on the network.
  const router = useRouter();
  useEffect(() => {
    const fetchTabs = () => {
      for (const tab of TABS) void router.preloadRoute({ to: tab.to }).catch(() => undefined);
    };
    const timer = setTimeout(fetchTabs, 600);
    return () => clearTimeout(timer);
  }, [router]);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const found = tabOf(path);
  // A page further in (a match, a team) belongs to the tab it was opened from.
  const last = useRef(0);
  useEffect(() => {
    if (found >= 0) last.current = found;
  }, [found]);
  const active = found >= 0 ? found : last.current;
  const inner = found < 0;
  // How this page was come to, decided once when the address changes: between tabs, into a
  // page, or back out of one. The page arrives accordingly.
  const [move, setMove] = useState({ path, how: inner ? "bx-view-in" : "bx-view" });
  if (move.path !== path) {
    const wasInner = tabOf(move.path) < 0;
    setMove({ path, how: inner ? "bx-view-in" : wasInner ? "bx-view-out" : "bx-view" });
  }
  // The page says what it is in the browser's own title: in the tab, the history, a bookmark.
  const atlas = useAtlas();
  useEffect(() => {
    const name = nameOf(atlas, path);
    document.title = name === "Back" ? "Bearing" : `${name} · Bearing`;
  }, [atlas, path]);
  return (
    <Chrome active={active} inner={inner}>
      <Origin value={TABS[active] ?? TABS[0]}>
        <main id="main" key={pageOf(atlas, path)} className={`bx-page ${move.how}`}>
          <Outlet />
        </main>
      </Origin>
    </Chrome>
  );
}
