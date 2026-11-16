import "@fontsource-variable/gabarito";
import "./bearing.css";

import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { CalendarDays, House, Search, Star } from "lucide-react";

const TABS = [
  { to: "/", label: "Today", icon: House },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/following", label: "Following", icon: Star },
  { to: "/search", label: "Search", icon: Search },
] as const;

/** The frame every Bearing screen sits in: the page, and a small floating capsule of four icons. */
export function Shell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const found = TABS.findIndex((t) => t.to !== "/" && path.startsWith(t.to));
  const active = found < 0 ? 0 : found;
  return (
    <div className="bx">
      <main className="bx-page">
        <Outlet />
      </main>
      <nav className="bx-nav" aria-label="Main">
        <i style={{ transform: `translateX(${active * 100}%)` }} />
        {TABS.map((tab, i) => (
          <Link
            key={tab.to}
            to={tab.to}
            aria-label={tab.label}
            title={tab.label}
            data-on={i === active ? "" : undefined}
          >
            <tab.icon size={20} strokeWidth={2} />
          </Link>
        ))}
      </nav>
    </div>
  );
}
