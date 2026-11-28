import { type ReactNode, useEffect, useId, useMemo, useRef } from "react";
import { type Light, Nebula, type NebulaView } from "../lib/nebula";
import { usePrefs } from "../lib/prefs";
import { type SkyForm, hourIn, skyCard, skyForm, skyScene } from "../lib/sky";
import { useMinute } from "../lib/world";

/** The viewer's hour, in steps of five minutes: the sky changes slowly. */
function useSkyHour(): number {
  const now = useMinute();
  const { zone } = usePrefs();
  return Math.round(hourIn(now, zone) * 12) / 12;
}

/**
 * Marks a logo as a source of colour in its card's sky: `reach` is how far the colour goes in
 * pixels, `strength` (0 to 1) how much of it there is. Spread onto the logo's element.
 */
export function light(
  color: string | undefined,
  reach: number,
  strength: number,
): { "data-light"?: string } {
  return color ? { "data-light": `${color};${Math.round(reach)};${strength.toFixed(2)}` } : {};
}

interface CardSkyState {
  form: SkyForm;
  first: number;
  live: boolean;
  seed: number;
}

/**
 * The sky inside a page's top card, filling it behind the content (the card is the positioned
 * parent). It is the sky of the viewer's hour in both themes, and it takes a little colour from
 * the teams and players shown on the card: every element in the card marked with `light()`
 * gives its colour to the sky around it. See lib/nebula.ts for what that looks like at each hour.
 */
export function CardSky({
  first = 0,
  live = false,
}: {
  /** The amber light before a start the viewer is waiting for, 0 to 1. */
  first?: number;
  /** A match is on: the colours breathe. */
  live?: boolean;
}) {
  const step = useSkyHour();
  // Gradients and filters are found by id, so each drawing on the page needs its own.
  const id = `bxc${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  // Clouds and stars stand somewhere else each day.
  const seed = 5 + (Math.floor(useMinute() / 86_400_000) % 23);
  const svg = useMemo(() => skyCard(step, { id, seed }), [step, id, seed]);
  const form = useMemo(() => skyForm(step), [step]);
  const box = useRef<HTMLDivElement>(null);
  const state = useRef<CardSkyState>({ form, first, live, seed });
  state.current = { form, first, live, seed };
  const again = useRef<() => void>(() => {});

  useEffect(() => {
    const el = box.current;
    const card = el?.parentElement;
    if (!el || !card) return;
    const canvas = document.createElement("canvas");
    canvas.className = "bx-neb";
    const nebula = new Nebula(canvas);
    if (!nebula.works) return;
    el.appendChild(canvas);
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    let view: NebulaView | null = null;
    let idle = true;

    const measure = () => {
      const R = card.getBoundingClientRect();
      if (!R.width || !R.height) return;
      const small = R.width < 700 ? 0.62 : 1;
      const lights: Light[] = [];
      for (const source of card.querySelectorAll<HTMLElement>("[data-light]")) {
        const r = source.getBoundingClientRect();
        const [color, reach, strength] = (source.dataset.light ?? "").split(";");
        if (!r.width || !color) continue;
        lights.push({
          x: r.left + r.width / 2 - R.left,
          y: r.top + r.height / 2 - R.top,
          r: Math.min(R.width * 0.46, Number(reach) * small),
          color,
          a: Number(strength),
          k: r.width / 2,
        });
      }
      const now = state.current;
      view = {
        width: R.width,
        height: R.height,
        lights,
        form: now.form,
        first: now.first,
        live: now.live,
        seed: now.seed + 0.37,
      };
      // With nobody on the card and no low light, there is nothing to draw or to move.
      idle = !lights.length && now.form.twilight < 0.01 && now.first < 0.01;
    };
    const paint = (ms: number) => {
      if (view) nebula.draw(view, still.matches ? 0 : ms / 1000);
    };
    const refresh = () => {
      measure();
      paint(performance.now());
    };
    again.current = refresh;
    refresh();
    // Fonts and logos arriving move what is on the card.
    void document.fonts.ready.then(refresh);
    const sizes = new ResizeObserver(refresh);
    sizes.observe(card);

    // The gas drifts slowly: twenty pictures a second are plenty, and none while out of sight.
    let seen = true;
    const sight = new IntersectionObserver(([entry]) => {
      seen = entry?.isIntersecting ?? true;
    });
    sight.observe(card);
    let frame = 0;
    let last = 0;
    const tick = (ms: number) => {
      frame = requestAnimationFrame(tick);
      if (idle || !seen || document.hidden || still.matches || ms - last < 50) return;
      last = ms;
      paint(ms);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      sight.disconnect();
      again.current = () => {};
      nebula.dispose();
      canvas.remove();
    };
  }, []);

  // Whatever changed on the card (a score, the hour, who is shown) may have moved its lights.
  useEffect(() => {
    again.current();
  });

  return (
    <div className="bx-cardsky" aria-hidden ref={box}>
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      <i style={{ opacity: form.night }} />
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
