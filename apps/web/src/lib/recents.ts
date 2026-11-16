import type { Follow } from "@bearing/domain";
import { useSyncExternalStore } from "react";

/** What the viewer looked at last, newest first. Kept in this browser only. */
const KEY = "bearing.recents.v1";
const LIMIT = 6;
const listeners = new Set<() => void>();
let current: Follow[] | null = null;

function load(): Follow[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as Follow[]) : [];
  } catch {
    return [];
  }
}

export function useRecents(): Follow[] {
  current ??= load();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current!,
    () => current!,
  );
}

/** Note that a page was opened. */
export function visit(f: Follow) {
  const list = current ?? load();
  if (list[0]?.kind === f.kind && list[0]?.id === f.id) return;
  current = [f, ...list.filter((x) => !(x.kind === f.kind && x.id === f.id))].slice(0, LIMIT);
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Not remembered; nothing else depends on it.
  }
  for (const l of listeners) l();
}
