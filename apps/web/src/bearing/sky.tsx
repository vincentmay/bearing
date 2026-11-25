import { useMemo } from "react";
import { usePrefs } from "../lib/prefs";
import { hourIn, skyBand } from "../lib/sky";
import { useMinute } from "../lib/world";

/**
 * The sky band at the top of Today (brand book §8): the sky at the viewer's own hour, fading into
 * the page. It is drawn once every five minutes at most, carries no text, and never sits behind a
 * list. Both drawings are made, the dimmed sky for the dark theme and the paper sky for the light
 * one, and CSS shows the one that matches the theme, so it follows the system setting with no
 * script.
 */
export function SkyBand() {
  const now = useMinute();
  const { zone } = usePrefs();
  const hour = hourIn(now, zone);
  // The sky changes slowly; a new drawing every five minutes is enough.
  const step = Math.round(hour * 12) / 12;
  const dark = useMemo(() => skyBand(step, { theme: "dark", id: "bxskyd" }), [step]);
  const light = useMemo(() => skyBand(step, { theme: "light", id: "bxskyl" }), [step]);
  return (
    <div className="bx-skyband" aria-hidden>
      <div className="bx-sky-dark" dangerouslySetInnerHTML={{ __html: dark }} />
      <div className="bx-sky-light" dangerouslySetInnerHTML={{ __html: light }} />
    </div>
  );
}
