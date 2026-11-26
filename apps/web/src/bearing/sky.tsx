import { type ReactNode, useId, useMemo } from "react";
import { usePrefs } from "../lib/prefs";
import { hourIn, skyBand, skyScene } from "../lib/sky";
import { useMinute } from "../lib/world";

/** The viewer's hour, in steps of five minutes: the sky changes slowly. */
function useSkyHour(): number {
  const now = useMinute();
  const { zone } = usePrefs();
  return Math.round(hourIn(now, zone) * 12) / 12;
}

/**
 * The sky band at the top of Today (brand book §8): the sky at the viewer's own hour, fading into
 * the page. It is drawn once every five minutes at most, carries no text, and never sits behind a
 * list. Both drawings are made, the dimmed sky for the dark theme and the paper sky for the light
 * one, and CSS shows the one that matches the theme, so it follows the system setting with no
 * script.
 */
export function SkyBand() {
  const step = useSkyHour();
  const dark = useMemo(() => skyBand(step, { theme: "dark", id: "bxskyd" }), [step]);
  const light = useMemo(() => skyBand(step, { theme: "light", id: "bxskyl" }), [step]);
  return (
    <div className="bx-skyband" aria-hidden>
      <div className="bx-sky-dark" dangerouslySetInnerHTML={{ __html: dark }} />
      <div className="bx-sky-light" dangerouslySetInnerHTML={{ __html: light }} />
    </div>
  );
}

/**
 * The whole sky at the viewer's hour, filling its box: for the moments around the app, never
 * behind a list, a score or a setting. It is the same in both themes.
 */
export function SkyScene({
  width = 1200,
  height = 800,
  horizon = 0.82,
  stars = 200,
  grain = false,
}: {
  width?: number;
  height?: number;
  horizon?: number;
  stars?: number;
  grain?: boolean;
}) {
  const step = useSkyHour();
  // Gradients and filters are found by id, so each drawing on the page needs its own.
  const id = `bxs${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const svg = useMemo(
    () => skyScene(step, { width, height, horizon, stars, grain, id }),
    [step, width, height, horizon, stars, grain, id],
  );
  return <div className="bx-scene" aria-hidden dangerouslySetInnerHTML={{ __html: svg }} />;
}

/**
 * A moment where nothing is happening (nothing on, an address that leads nowhere, no
 * connection): said in a line or two on the sky, with the one way on. The words sit in the top
 * of the sky, where white text keeps its contrast at every hour.
 */
export function Moment({
  title,
  children,
  action,
  alert = false,
  className,
}: {
  title: string;
  children?: ReactNode;
  /** The way on: a link or a button with the class `bx-ghost`. */
  action?: ReactNode;
  /** Something went wrong, rather than nothing being there. */
  alert?: boolean;
  className?: string;
}) {
  return (
    <section
      className={className ? `bx-moment ${className}` : "bx-moment"}
      role={alert ? "alert" : undefined}
    >
      <SkyScene width={1200} height={760} horizon={0.92} stars={160} />
      <div className="bx-moment-in">
        <h2>{title}</h2>
        {children ? <p>{children}</p> : null}
        {action}
      </div>
    </section>
  );
}
