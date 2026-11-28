import { useMemo } from "react";
import { type Prefs, usePrefs } from "../lib/prefs";

const DAY = 24 * 60 * 60 * 1000;

function at(when: string | number): number {
  return typeof when === "number" ? when : Date.parse(when);
}

/**
 * Every time on a screen goes through here, so it is written in the viewer's own zone and
 * locale, or in the zone and clock they chose in Settings.
 */
export interface Times {
  /** Time of day: "20:30" or "8:30 pm". */
  clock(when: string | number): string;
  /** A sortable key for the calendar day a moment falls on. */
  dayKey(when: string | number): string;
  /** "Today", "Tomorrow", "Yesterday" or "Sat 21 Nov". */
  day(when: string | number, now: number): string;
  /** "Sat" */
  weekday(when: string | number): string;
  /** "21" */
  dayOfMonth(when: string | number): string;
  /** "November" */
  month(when: string | number): string;
  /** "Sun 15 Nov" */
  date(when: string | number): string;
  /** The zone's short name, such as "CET". */
  zone: string;
}

export function timesFor(prefs: Pick<Prefs, "hours" | "zone">): Times {
  const timeZone = prefs.zone ?? undefined;
  const f = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(undefined, { ...options, timeZone });
  // "As the device" means whatever clock the viewer's locale uses.
  const cycle =
    prefs.hours === "auto"
      ? f({ hour: "numeric" }).resolvedOptions().hourCycle
      : prefs.hours === "12"
        ? "h12"
        : "h23";
  const twelve = cycle === "h12" || cycle === "h11";
  const clock = f({
    hour: twelve ? "numeric" : "2-digit",
    minute: "2-digit",
    hourCycle: twelve ? "h12" : "h23",
  });
  const key = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  });
  const weekday = f({ weekday: "short" });
  const dayOfMonth = f({ day: "numeric" });
  const month = f({ month: "long" });
  const date = f({ weekday: "short", day: "numeric", month: "short" });
  const zone =
    f({ timeZoneName: "short" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  // Every list asks for the day of every match, again on every page: a day once worked out is
  // remembered (formatting a date is slow, and there are thousands of them).
  const days = new Map<string | number, string>();
  const dayKey = (when: string | number) => {
    let day = days.get(when);
    if (day === undefined) {
      day = key.format(at(when));
      if (days.size > 20000) days.clear();
      days.set(when, day);
    }
    return day;
  };
  return {
    clock: (when) => clock.format(at(when)).toLowerCase(),
    dayKey,
    day(when, now) {
      const k = dayKey(when);
      if (k === dayKey(now)) return "Today";
      if (k === dayKey(now + DAY)) return "Tomorrow";
      if (k === dayKey(now - DAY)) return "Yesterday";
      return date.format(at(when));
    },
    weekday: (when) => weekday.format(at(when)),
    dayOfMonth: (when) => dayOfMonth.format(at(when)),
    month: (when) => month.format(at(when)),
    date: (when) => date.format(at(when)),
    zone,
  };
}

export function useTimes(): Times {
  const { hours, zone } = usePrefs();
  return useMemo(() => shared({ hours, zone }), [hours, zone]);
}

const made = new Map<string, Times>();

/**
 * One set of times for each choice of clock and zone, kept for the whole visit: making the
 * formatters is slow, and what they have worked out is worth keeping from page to page.
 */
function shared(prefs: Pick<Prefs, "hours" | "zone">): Times {
  const id = `${prefs.hours}|${prefs.zone ?? ""}`;
  let times = made.get(id);
  if (!times) {
    times = timesFor(prefs);
    made.set(id, times);
  }
  return times;
}

/** "in 50 min", "in 1 h 20 min", "in 3 days", "now", "2 h ago". */
export function until(when: string | number, now: number): string {
  const diff = at(when) - now;
  const abs = Math.abs(diff);
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  let text: string;
  if (abs < MIN) return "now";
  if (abs < HOUR) text = `${Math.round(abs / MIN)} min`;
  else if (abs < DAY) {
    const h = Math.floor(abs / HOUR);
    const m = Math.round((abs % HOUR) / MIN);
    text = m && h < 6 ? `${h} h ${m} min` : `${Math.round(abs / HOUR)} h`;
  } else {
    const d = Math.round(abs / DAY);
    text = d === 1 ? "1 day" : `${d} days`;
  }
  return diff > 0 ? `in ${text}` : `${text} ago`;
}

/** Minutes and seconds on a game clock: "27:12". */
export function gameClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
