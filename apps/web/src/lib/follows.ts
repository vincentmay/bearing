import type { Follow } from "@bearing/domain";
import { useSyncExternalStore } from "react";

/**
 * What the viewer follows on this device, for anyone who is not signed in. It starts from the
 * defaults it is given and remembers changes in this browser only.
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

/** What this device has stored, or null when the viewer has never changed anything here. */
export function storedFollows(): Follow[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? (parsed as Follow[]) : null;
  } catch {
    return null;
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
