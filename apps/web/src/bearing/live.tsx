import type { World } from "@bearing/domain";
import { advance, rng } from "@bearing/domain/sample";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";
import { convex } from "../lib/backend";
import { nowMs, worldQuery } from "../lib/world";

declare global {
  interface Window {
    /** Development only, without a backend: drive the sample by hand. */
    bearing?: { pause(on?: boolean): void; step(times?: number): void };
  }
}

const BEAT = 2400;
/** With a backend, how often an open screen says it is still looking. */
const WAKE = 45_000;

/**
 * Keeps the sample world moving.
 *
 * Without a backend, every beat each live match may advance a little, here in the browser, and
 * the new world is written into the query cache. With a backend the same function runs on the
 * server and the results arrive by themselves; the screen only has to say, now and then, that
 * someone is still looking.
 */
export function useSamplePlayer() {
  const client = useQueryClient();
  useEffect(() => {
    if (convex) {
      const backend = convex;
      const wake = () => {
        if (!document.hidden) void backend.mutation(api.sample.wake, {});
      };
      const timer = setInterval(wake, WAKE);
      document.addEventListener("visibilitychange", wake);
      return () => {
        clearInterval(timer);
        document.removeEventListener("visibilitychange", wake);
      };
    }
    const r = rng(Date.now());
    let paused = false;
    const beat = () =>
      client.setQueryData(worldQuery.queryKey, (w: World | undefined) =>
        w ? advance(w, r, nowMs()) : w,
      );
    const timer = setInterval(() => {
      if (!paused && !document.hidden) beat();
    }, BEAT);
    if (import.meta.env.DEV) {
      window.bearing = {
        pause: (on = true) => void (paused = on),
        step: (times = 1) => {
          for (let i = 0; i < times; i++) beat();
        },
      };
    }
    return () => clearInterval(timer);
  }, [client]);
}
