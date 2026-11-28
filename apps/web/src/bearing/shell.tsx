import "@fontsource-variable/zalando-sans/wdth.css";
import "./bearing.css";
import "./kiming.css";

import type { Atlas } from "@bearing/domain";
import { Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { CalendarDays, Radio, Search, Star } from "lucide-react";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePrefs } from "../lib/prefs";
import { useSamplePlayer } from "./live";
import { useAtlas } from "../lib/world";
import { moveOf, placeOf } from "./moves";
import { nameOf, useTrail } from "./trail";
import { FinderOver } from "./find";
import { AccountLink, Logo, Waiting } from "./ui";

const TABS = [
  { to: "/", label: "Live", icon: Radio },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/following", label: "Following", icon: Star },
] as const;

type Tab = (typeof TABS)[number];

/** The tab the viewer is in, which is also where "back" leads from a page further in. */
const Origin = createContext<Tab>(TABS[0]);

export function useOrigin(): Tab {
  return useContext(Origin);
}

const Find = createContext<() => void>(() => {});

/** Opens search over the page, as its button in the frame and Ctrl K do. */
export function useFind(): () => void {
  return useContext(Find);
}

/** Which tab an address belongs to, or none for a page further in. */
const tabOf = placeOf;

/** Search opens over any page: from its button, with Ctrl K (or Cmd K), or with a plain "/". */
function useFinder(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((event.target as HTMLElement)?.tagName);
      if ((event.key === "k" || event.key === "K") && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setOpen((was) => !was);
      } else if (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  return [open, setOpen];
}

/**
 * The frame every screen sits in: the mark, the three places (Live, Schedule, Following), search
 * and the account. With room the places sit in the top bar; on a phone they move to a capsule at
 * the bottom, within reach of a thumb. The frame is there from the first moment, around whatever
 * the page is doing, so that a page still on its way arrives into a frame that has not moved.
 */
function Chrome({
  active,
  inner,
  live = 0,
  find = true,
  children,
}: {
  active: number;
  inner: boolean;
  /** How many matches are being played, said on the Live tab. */
  live?: number;
  /** Search needs the world; while it is on its way the button waits. */
  find?: boolean;
  children: ReactNode;
}) {
  const { theme } = usePrefs();
  const [finding, setFinding] = useFinder();
  const open = useCallback(() => setFinding(true), [setFinding]);
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <div className="bx" data-theme={theme === "system" ? undefined : theme}>
      {/* For whoever moves by keyboard: past the frame, straight to the page. */}
      <a href="#main" className="bx-skip">
        Skip to the page
      </a>
      <header className="bx-bar">
        <Link to="/" className="bx-brand" aria-label="Kiming: what is live">
          <Logo height={19} label="Kiming" />
        </Link>
        <nav className="bx-tabs" aria-label="Main">
          <i style={{ transform: `translateX(${active * 100}%)` }} />
          {TABS.map((tab, i) => (
            <Link
              key={tab.to}
              to={tab.to}
              aria-current={i === active && !inner ? "page" : undefined}
              data-on={i === active ? "" : undefined}
            >
              <tab.icon size={21} strokeWidth={2} aria-hidden />
              {tab.label}
              {i === 0 && live ? <small aria-label={`${live} live`}>{live}</small> : null}
            </Link>
          ))}
        </nav>
        <div className="bx-bar-r">
          <button
            type="button"
            className="bx-find"
            aria-label="Search"
            aria-keyshortcuts="Control+K Meta+K"
            onClick={() => setFinding(true)}
          >
            <Search size={17} aria-hidden />
            <span>Search</span>
            <kbd className="bx-kbd">{mac ? "⌘ K" : "Ctrl K"}</kbd>
          </button>
          <AccountLink />
        </div>
      </header>
      <Find value={open}>{children}</Find>
      {finding && find ? <FinderOver onClose={() => setFinding(false)} /> : null}
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
    <Chrome active={Math.max(found, 0)} inner={found < 0} find={false}>
      <main className="bx-page">
        <Waiting
          title={found >= 0 ? TABS[found]?.label : undefined}
          shape={path === "/" ? "live" : "page"}
          at={path.split("/")[1] || "live"}
          inner={found < 0}
        />
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
  // The three places are a press away at any moment: their code is fetched as soon as the first
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
  // The page that is standing, which for a moment after a press is still the one before: the
  // address changes at once, the page when its successor is ready. Everything about the page
  // itself goes by this one, so that the page being left is not built a second time on its
  // way out.
  const shown = useRouterState({
    select: (s) => s.matches[s.matches.length - 1]?.pathname ?? s.location.pathname,
  }).replace(/(.)\/$/, "$1");
  // How this page was come to, decided once when it changes: between tabs, into a page, or
  // back out of one. The page arrives accordingly.
  // The first page of a visit comes in over its loading shape: `bx-first` fades the content in
  // and leaves the sky, which was there already, alone.
  const [move, setMove] = useState({ path: shown, how: "bx-first" });
  if (move.path !== shown) {
    const how = { tab: "bx-view", in: "bx-view-in", out: "bx-view-out" }[moveOf(move.path, shown)];
    setMove({ path: shown, how });
  }
  // The page says what it is in the browser's own title: in the tab, the history, a bookmark.
  const atlas = useAtlas();
  useEffect(() => {
    const name = nameOf(atlas, shown);
    document.title = name === "Back" ? "Kiming" : `${name} · Kiming`;
  }, [atlas, shown]);
  return (
    <Chrome active={active} inner={inner} live={atlas.live().length}>
      <Origin value={TABS[active] ?? TABS[0]}>
        <main id="main" key={pageOf(atlas, shown)} className={`bx-page ${move.how}`}>
          <Outlet />
        </main>
      </Origin>
    </Chrome>
  );
}
