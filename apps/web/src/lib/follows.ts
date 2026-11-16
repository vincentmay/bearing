import type { Follow } from "@bearing/domain";
import { useSyncExternalStore } from "react";

/**
 * What the viewer follows. Starts from the sample's follows and remembers changes in this
 * browser only (a per-viewer convenience until accounts exist).
 */
const KEY = "bearing.follows.v1";
const listeners = new Set<() => void>();
let current: Follow[] | null = null;

function load(fallback: Follow[]): Follow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed as Follow[];
    }
  } catch {
    // Storage unavailable: fall back to the defaults.
  }
  return fallback;
}

function save(list: Follow[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Not remembered; still works for this session.
  }
}

export function useFollows(defaults: Follow[]): Follow[] {
  if (current === null) current = load(defaults);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current!,
    () => current!,
  );
}

function set(next: Follow[]) {
  current = next;
  save(next);
  for (const l of listeners) l();
}

export function isFollowing(list: Follow[], f: Follow): boolean {
  return list.some((x) => x.kind === f.kind && x.id === f.id);
}

export function toggleFollow(f: Follow) {
  const list = current ?? [];
  set(
    isFollowing(list, f) ? list.filter((x) => !(x.kind === f.kind && x.id === f.id)) : [...list, f],
  );
}

export function resetFollows(defaults: Follow[]) {
  set(defaults);
}
