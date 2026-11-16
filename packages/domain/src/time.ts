/** Time helpers. All display goes through the viewer's own zone via Intl. */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function ms(iso: string): number {
  return Date.parse(iso);
}

/** "in 1 h 20 min", "in 3 days", "now", "2 h ago". */
export function relative(iso: string, now: number): string {
  const diff = ms(iso) - now;
  const abs = Math.abs(diff);
  const future = diff > 0;
  let text: string;
  if (abs < MINUTE) return "now";
  if (abs < HOUR) text = `${Math.round(abs / MINUTE)} min`;
  else if (abs < DAY) {
    const h = Math.floor(abs / HOUR);
    const m = Math.round((abs % HOUR) / MINUTE);
    text = m && h < 6 ? `${h} h ${m} min` : `${Math.round(abs / HOUR)} h`;
  } else {
    const d = Math.round(abs / DAY);
    text = d === 1 ? "1 day" : `${d} days`;
  }
  return future ? `in ${text}` : `${text} ago`;
}

/** Countdown parts for a ticking display. */
export function countdown(iso: string, now: number) {
  const diff = Math.max(0, ms(iso) - now);
  return {
    days: Math.floor(diff / DAY),
    hours: Math.floor((diff % DAY) / HOUR),
    minutes: Math.floor((diff % HOUR) / MINUTE),
    seconds: Math.floor((diff % MINUTE) / 1000),
    done: diff === 0,
  };
}

/** Time of day in the viewer's locale; `h23` forces a 24-hour clock for dense, instrument-style views. */
export function clock(iso: string, h23 = false): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    ...(h23 ? { hourCycle: "h23" as const } : {}),
  }).format(ms(iso));
}

export function dayKey(iso: string | number): string {
  const d = new Date(typeof iso === "number" ? iso : ms(iso));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Today", "Tomorrow", "Yesterday" or "Sat 21 Nov". */
export function dayLabel(iso: string | number, now: number): string {
  const key = dayKey(iso);
  if (key === dayKey(now)) return "Today";
  if (key === dayKey(now + DAY)) return "Tomorrow";
  if (key === dayKey(now - DAY)) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(typeof iso === "number" ? iso : ms(iso));
}

export function longDate(iso: string | number): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(typeof iso === "number" ? iso : ms(iso));
}

export function dateRange(start: string, end: string): string {
  const s = new Date(`${start}T12:00:00Z`);
  const e = new Date(`${end}T12:00:00Z`);
  // formatRange collapses shared parts per locale: "Nov 5 – 16", "5.–16. Nov.", "5–16 Nov".
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).formatRange(s, e);
}

export function zoneName(): string {
  const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(
    new Date(),
  );
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "local";
}

export function money(amount: number, currency: string): string {
  const compact = amount >= 1_000_000;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    // Never round a prize pool away: $1.25M stays $1.25M.
    ...(compact ? { maximumSignificantDigits: 4 } : { maximumFractionDigits: 0 }),
  }).format(amount);
}

export function countryName(country: string | undefined): string {
  if (!country) return "";
  try {
    return (
      new Intl.DisplayNames(undefined, { type: "region" }).of(country.toUpperCase()) ?? country
    );
  } catch {
    return country;
  }
}

export const durations = { MINUTE, HOUR, DAY };
