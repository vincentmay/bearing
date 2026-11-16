import "@fontsource-variable/gabarito";
import "@fontsource-variable/geist-mono";
import "./bearing.css";

import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { CalendarDays, House, Search, Settings, Star } from "lucide-react";
import { createContext, useContext, useEffect, useRef } from "react";
import { usePrefs } from "../lib/prefs";
import { useSamplePlayer } from "./live";
import { Mark } from "./ui";

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
export function Shell() {
  useSamplePlayer();
  const { theme } = usePrefs();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const found = TABS.findIndex((t) => (t.to === "/" ? path === "/" : path.startsWith(t.to)));
  // A page further in (a match, a team) belongs to the tab it was opened from.
  const last = useRef(0);
  useEffect(() => {
    if (found >= 0) last.current = found;
  }, [found]);
  const active = found >= 0 ? found : last.current;
  const inner = found < 0;
  return (
    <div className="bx" data-theme={theme === "system" ? undefined : theme}>
      <header className="bx-top">
        <Link to="/" className="bx-brand" aria-label="Bearing: today">
          <Mark size={28} />
          <span aria-hidden>bearing</span>
        </Link>
        <Link to="/settings" className="bx-iconbtn" aria-label="Settings" title="Settings">
          <Settings size={18} />
        </Link>
      </header>
      <Origin value={TABS[active] ?? TABS[0]}>
        <main key={path} className={inner ? "bx-page bx-view-in" : "bx-page bx-view"}>
          <Outlet />
        </main>
      </Origin>
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
