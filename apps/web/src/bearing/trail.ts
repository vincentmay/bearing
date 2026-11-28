import type { Atlas } from "@bearing/domain";
import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { plainName } from "./model";

/**
 * Where the viewer has been, step by step, so that "back" can lead to the page they came from
 * and say its name. The browser keeps the steps; this keeps which address sits at which step.
 * It lasts as long as the tab does.
 */
const KEY = "bearing.trail";

function read(): Record<string, string> {
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? "{}");
    return stored && typeof stored === "object" ? (stored as Record<string, string>) : {};
  } catch {
    return {};
  }
}

const trail = read();

function step(state: unknown): number {
  const index = (state as { __TSR_index?: unknown } | undefined)?.__TSR_index;
  return typeof index === "number" ? index : 0;
}

/** Called once by the frame: note the address of every step as it is shown. */
export function useTrail() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const index = useRouterState({ select: (s) => step(s.location.state) });
  useEffect(() => {
    trail[index] = path;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(trail));
    } catch {
      // Without storage the trail lasts until the page is reloaded, which is enough.
    }
  }, [path, index]);
}

/** The address one step back, if that step was inside Bearing. */
export function usePrevious(): string | undefined {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const index = useRouterState({ select: (s) => step(s.location.state) });
  const before = index > 0 ? trail[index - 1] : undefined;
  return before && before !== path ? before : undefined;
}

const TABS: Record<string, string> = {
  "/": "Live",
  "/schedule": "Schedule",
  "/following": "Following",
  "/following/add": "Follow more",
  "/search": "Search",
  "/settings": "Settings",
};

/** What a page is called on the button that leads back to it. */
export function nameOf(atlas: Atlas, path: string): string {
  const tab = TABS[path];
  if (tab) return tab;
  const [, kind, raw] = path.split("/");
  const id = raw ? decodeURIComponent(raw) : "";
  if (kind === "team" || kind === "player") return plainName(atlas, id) || "Back";
  if (kind === "tournament") return atlas.tournament(id)?.name ?? "Back";
  if (kind === "ranking") return "World ranking";
  if (kind === "settings") return "Settings";
  if (kind === "match") {
    const match = atlas.match(id);
    if (!match) return "Back";
    const names = match.sides.flatMap((s) => (s.competitorId ? [s.competitorId] : []));
    return names.length === 2
      ? names.map((n) => plainName(atlas, n)).join(" v ")
      : atlas.tournamentOf(match).short;
  }
  return "Back";
}
