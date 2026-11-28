import { type ReactNode, useEffect, useId, useMemo, useRef } from "react";
import { type Light, type NebulaView, nebulaPicture, whenNebulaReady } from "../lib/nebula";
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
}: {
  /** The amber light before a start the viewer is waiting for, 0 to 1. */
  first?: number;
}) {
  const step = useSkyHour();
  // Gradients and filters are found by id, so each drawing on the page needs its own.
  const id = `bxc${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  // Clouds and stars stand somewhere else each day.
  const seed = 5 + (Math.floor(useMinute() / 86_400_000) % 23);
  const svg = useMemo(() => skyCard(step, { id, seed }), [step, id, seed]);
  const form = useMemo(() => skyForm(step), [step]);
  const box = useRef<HTMLDivElement>(null);
  const state = useRef<CardSkyState>({ form, first, seed });
  state.current = { form, first, seed };
  const again = useRef<() => void>(() => {});

  useEffect(() => {
    const el = box.current;
    const card = el?.parentElement;
    if (!el || !card) return;
    const canvas = document.createElement("canvas");
    canvas.className = "bx-neb";
    const target = canvas.getContext("bitmaprenderer");
    if (!target) return;
    el.appendChild(canvas);
    const born = performance.now();

    /** What the card holds right now, or nothing if there is no colour to show. */
    const measure = (): NebulaView | null => {
      const R = card.getBoundingClientRect();
      if (!R.width || !R.height) return null;
      const small = R.width < 700 ? 0.62 : 1;
      const lights: Light[] = [];
      for (const source of card.querySelectorAll<HTMLElement>("[data-light]")) {
        const r = source.getBoundingClientRect();
        const [color, reach, strength] = (source.dataset.light ?? "").split(";");
        if (!r.width || !color) continue;
        lights.push({
          x: Math.round(r.left + r.width / 2 - R.left),
          y: Math.round(r.top + r.height / 2 - R.top),
          r: Math.round(Math.min(R.width * 0.46, Number(reach) * small)),
          color,
          a: Number(strength),
          k: r.width / 2,
        });
      }
      const now = state.current;
      // With nobody on the card and no low light, there is nothing to draw.
      if (!lights.length && now.form.twilight < 0.01 && now.first < 0.01) return null;
      return {
        width: Math.round(R.width),
        height: Math.round(R.height),
        lights,
        form: now.form,
        first: now.first,
        seed: now.seed + 0.37,
      };
    };

    // The picture is still: it is drawn again only when what it shows has changed, at most a
    // few times a second (a window being dragged wider asks sixty times).
    let shown = "";
    let frame = 0;
    let timer = 0;
    let last = -1000;
    const ask = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    let fonts = false;
    const paint = () => {
      frame = 0;
      // Fonts arriving move what is on the card. Asked here and not when the card is made:
      // asking makes the browser lay the page out, which at this point it has done anyway.
      if (!fonts) {
        fonts = true;
        void document.fonts.ready.then(ask);
      }
      const wait = last + 150 - performance.now();
      if (wait > 0) {
        clearTimeout(timer);
        timer = window.setTimeout(ask, wait);
        return;
      }
      const view = measure();
      const key = view ? JSON.stringify(view) : "";
      if (key === shown) return;
      if (!view) {
        target.transferFromImageBitmap(null);
        shown = key;
        return;
      }
      const picture = nebulaPicture(view);
      // Not ready yet: `ready` below asks again when it is.
      if (!picture) return;
      shown = key;
      last = performance.now();
      canvas.width = picture.width;
      canvas.height = picture.height;
      target.transferFromImageBitmap(picture);
      // A picture that comes after the page already stood fades in; one that is there with the
      // page is simply there.
      if (!canvas.dataset.on) canvas.dataset.on = last - born > 250 ? "late" : "first";
    };
    again.current = ask;
    const waiting = whenNebulaReady(ask);
    const sizes = new ResizeObserver(ask);
    sizes.observe(card);
    return () => {
      waiting();
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      sizes.disconnect();
      again.current = () => {};
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
