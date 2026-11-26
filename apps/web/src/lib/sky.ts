/**
 * The Kiming sky (brand book §8; the master is brand/system/sky3.mjs): an illustrated sky for the
 * viewer's hour, drawn as one SVG. No sun, no sea and no horizon line: the sky fades into the page.
 * At night soft nebula glows, stars and moonlit clouds; by day blue with a few soft cumulus; at dawn
 * and dusk a little warm light behind the clouds.
 *
 * The app draws the band behind the top of Today, in two keys: "dim" for the dark theme (the upper
 * sky with its lightness held down) and "paper" for the light theme (the same hour as tints on
 * white); and the whole sky in full colour for the moments around the app. Each returns a string
 * of SVG built only from numbers and fixed colours, so it can be set as markup without anything
 * from outside reaching it.
 */

type Oklch = [number, number, number];
/** [hour, top, mid, low, warm, glow, glowA, cloudTop, cloudUnder, cloudA, stars] */
type Key = [number, Oklch, Oklch, Oklch, number, Oklch, number, Oklch, Oklch, number, number];

function hex(L: number, C: number, H: number): string {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  // Out of the screen's gamut: less colour, the same lightness.
  if (rgb.some((v) => v < -0.0005 || v > 1.0005) && C > 0.001) return hex(L, C * 0.97, H);
  const g = (c: number) =>
    c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(c, 0) ** (1 / 2.4) - 0.055;
  return `#${rgb
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, g(v))) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
const ok = (c: Oklch) => hex(c[0], c[1], c[2]);

const MOON_TOP: Oklch = [0.52, 0.13, 262];
const MOON_UNDER: Oklch = [0.36, 0.12, 264];
const night = (hour: number, stars: number): Key => [
  hour,
  [0.235, 0.1, 282],
  [0.2, 0.085, 272],
  [0.205, 0.066, 262],
  0,
  [0.5, 0.17, 270],
  0.26,
  MOON_TOP,
  MOON_UNDER,
  0.55,
  stars,
];
const KEYS: Key[] = [
  night(0, 1),
  [
    4.75,
    [0.235, 0.1, 281],
    [0.205, 0.085, 272],
    [0.23, 0.075, 263],
    0,
    [0.5, 0.17, 270],
    0.26,
    MOON_TOP,
    MOON_UNDER,
    0.55,
    0.9,
  ],
  [
    5.9,
    [0.265, 0.105, 278],
    [0.33, 0.115, 270],
    [0.5, 0.105, 262],
    0.4,
    [0.62, 0.13, 266],
    0.2,
    [0.5, 0.1, 270],
    [0.42, 0.1, 266],
    0.55,
    0.35,
  ],
  [
    6.75,
    [0.39, 0.135, 270],
    [0.55, 0.125, 264],
    [0.76, 0.075, 256],
    1,
    [0.84, 0.07, 255],
    0.2,
    [0.7, 0.07, 268],
    [0.6, 0.09, 266],
    0.6,
    0.02,
  ],
  [
    7.9,
    [0.44, 0.155, 266],
    [0.6, 0.135, 260],
    [0.84, 0.055, 250],
    0.22,
    [0.96, 0.02, 250],
    0.2,
    [0.985, 0.006, 260],
    [0.86, 0.035, 258],
    0.7,
    0,
  ],
  [
    10,
    [0.46, 0.172, 264],
    [0.6, 0.145, 258],
    [0.86, 0.05, 245],
    0,
    [0.97, 0.015, 250],
    0.2,
    [0.99, 0.005, 260],
    [0.87, 0.035, 258],
    0.72,
    0,
  ],
  [
    13,
    [0.45, 0.18, 264],
    [0.585, 0.152, 258],
    [0.85, 0.055, 245],
    0,
    [0.97, 0.015, 250],
    0.18,
    [0.99, 0.005, 260],
    [0.87, 0.035, 258],
    0.72,
    0,
  ],
  [
    16.8,
    [0.42, 0.165, 266],
    [0.56, 0.14, 261],
    [0.82, 0.06, 250],
    0.12,
    [0.95, 0.025, 250],
    0.2,
    [0.975, 0.008, 262],
    [0.84, 0.04, 260],
    0.7,
    0,
  ],
  [
    18.1,
    [0.365, 0.14, 270],
    [0.5, 0.125, 266],
    [0.73, 0.075, 258],
    0.8,
    [0.82, 0.07, 256],
    0.2,
    [0.72, 0.07, 268],
    [0.6, 0.09, 266],
    0.62,
    0,
  ],
  [
    18.75,
    [0.33, 0.13, 274],
    [0.44, 0.122, 268],
    [0.65, 0.085, 262],
    1,
    [0.74, 0.09, 262],
    0.2,
    [0.6, 0.085, 270],
    [0.48, 0.1, 266],
    0.6,
    0.03,
  ],
  [
    19.6,
    [0.27, 0.118, 278],
    [0.33, 0.13, 271],
    [0.46, 0.125, 264],
    0.3,
    [0.58, 0.16, 268],
    0.3,
    [0.5, 0.11, 272],
    [0.38, 0.11, 266],
    0.55,
    0.25,
  ],
  [
    21,
    [0.24, 0.102, 281],
    [0.208, 0.088, 272],
    [0.2, 0.064, 262],
    0,
    [0.5, 0.17, 270],
    0.27,
    MOON_TOP,
    MOON_UNDER,
    0.55,
    0.85,
  ],
  night(24, 1),
];

function mix(a: Oklch, b: Oklch, t: number): Oklch {
  let dh = b[2] - a[2];
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + dh * t];
}

export type SkyTheme = "dark" | "light";
/** "sky": the whole sky in full colour; "dim": the dark theme's band; "paper": tints on white. */
type SkyKey = "sky" | "dim" | "paper";

interface SkyState {
  paper: boolean;
  warm: number;
  stars: number;
  top: string;
  mid: string;
  low: string;
  glow: string;
  glowA: number;
  warmC: string;
  warmSoft: string;
  cloudTop: string;
  cloudUnder: string;
  cloudA: number;
  star: string;
  starWarm: string;
}

/** The sky's colours at an hour of the day (0 to 24, with fractions), eased between the keys. */
function skyState(hour: number, key: SkyKey): SkyState {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && (KEYS[i + 1] as Key)[0] <= h) i++;
  const A = KEYS[i] as Key;
  const B = KEYS[i + 1] as Key;
  let t = (h - A[0]) / (B[0] - A[0]);
  t = t * t * (3 - 2 * t);
  const c = (k: 1 | 2 | 3 | 5 | 7 | 8) => mix(A[k], B[k], t);
  const n = (k: 4 | 6 | 9 | 10) => A[k] + (B[k] - A[k]) * t;
  const top = c(1);
  const mid = c(2);
  const low = c(3);
  const warm = n(4);
  const stars = n(10);
  if (key === "paper") {
    // The same hour as tints on white: never darker than L 0.885, so secondary text and the
    // accent still pass 4.5:1 on it; night adds a little colour.
    const dark = 1 - Math.min(1, Math.max(0, (top[0] - 0.24) / 0.2));
    return {
      paper: true,
      warm,
      stars,
      top: hex(0.885, 0.058 + dark * 0.03, Math.min(top[2], 273)),
      mid: hex(0.93 - dark * 0.012, 0.042 + dark * 0.02, Math.min(mid[2], 271)),
      low: hex(0.968, 0.02, low[2]),
      glow: hex(0.99, 0.01, 260),
      glowA: 0.55,
      warmC: hex(0.86, 0.12, 72),
      warmSoft: hex(0.92, 0.08, 78),
      cloudTop: "#ffffff",
      cloudUnder: hex(0.86 - dark * 0.05, 0.055 + dark * 0.025, 268),
      cloudA: 0.95,
      star: hex(0.47, 0.225, 270),
      starWarm: hex(0.66, 0.16, 56),
    };
  }
  if (key === "sky")
    return {
      paper: false,
      warm,
      stars,
      top: ok(top),
      mid: ok(mid),
      low: ok(low),
      glow: ok(c(5)),
      glowA: n(6),
      warmC: hex(0.81, 0.16, 70),
      warmSoft: hex(0.87, 0.115, 76),
      cloudTop: ok(c(7)),
      cloudUnder: ok(c(8)),
      cloudA: n(9),
      star: "#E6EBFF",
      starWarm: "#FFE7C2",
    };
  // Dark: the upper sky only, its lightness held down so midday does not glare.
  const dim = (x: Oklch): Oklch => [
    0.2 + (x[0] - 0.2) * 0.55,
    x[1] * (x[0] > 0.3 ? 0.95 : 1),
    x[2] + (x[0] > 0.3 ? 7 : 0),
  ];
  const dt = dim(top);
  const dm = dim(mid);
  const dl: Oklch = [dm[0] * 0.92, dm[1], dm[2] - 3];
  return {
    paper: false,
    warm,
    stars,
    top: ok(dt),
    mid: ok(dm),
    low: ok(dl),
    glow: ok(c(5)),
    glowA: n(6),
    warmC: hex(0.81, 0.16, 70),
    warmSoft: hex(0.87, 0.115, 76),
    // Clouds a little lighter than the band, in its own blue.
    cloudTop: hex(Math.min(0.6, dm[0] + 0.24), dm[1] * 0.8, dm[2] - 8),
    cloudUnder: hex(Math.min(0.5, dm[0] + 0.12), dm[1] * 0.9, dm[2] - 6),
    cloudA: n(9),
    star: "#E6EBFF",
    starWarm: "#FFE7C2",
  };
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

const f1 = (v: number) => v.toFixed(1);

/** A four-point star with curved sides. */
function spark(x: number, y: number, k: number): string {
  const X = f1(x);
  const Y = f1(y);
  return `M${X} ${f1(y - k)}Q${X} ${Y} ${f1(x + k)} ${Y}Q${X} ${Y} ${X} ${f1(y + k)}Q${X} ${Y} ${f1(x - k)} ${Y}Q${X} ${Y} ${X} ${f1(y - k)}Z`;
}

/** Nebula: a few large soft glows in the indigo family. [x, y, rx, ry, colour, alpha] */
const NEBULA: [number, number, number, number, Oklch, number][] = [
  [0.82, 0.1, 0.34, 0.2, [0.44, 0.17, 284], 0.55],
  [0.62, 0.32, 0.26, 0.12, [0.5, 0.16, 268], 0.32],
  [0.16, 0.62, 0.2, 0.1, [0.56, 0.12, 252], 0.4],
  [0.36, 0.08, 0.22, 0.12, [0.4, 0.15, 274], 0.3],
  [0.95, 0.5, 0.16, 0.1, [0.46, 0.17, 294], 0.28],
];

interface DrawOptions {
  key: SkyKey;
  width: number;
  height: number;
  /** Where the sky has given way to the ground, as a share of the height; 1 for none. */
  horizon: number;
  /** Clouds sized and placed for a short band. */
  band: boolean;
  stars: number;
  seed: number;
  /** Lifts the clouds by this share of the height. */
  cloudLift: number;
  /** The colour the sky fades into below the horizon. */
  ground: string;
  id: string;
  /** Film grain, for large pictures. */
  grain: boolean;
}

/** One drawing of the sky (port of skySVG in brand/system/sky3.mjs). */
function draw(hour: number, o: DrawOptions): string {
  const S = skyState(hour, o.key);
  const { width: w, height: h, horizon, band, id: p, ground } = o;
  const H = h * horizon;
  const deep = S.paper ? ground : "#08113A"; // the dark sky gives way through deep indigo, never grey
  const fadeFrom = horizon < 1 ? H * 0.52 : h;
  const us = Math.max(0.72, Math.min(1.2, w / 1600)); // stars keep a visible size in small drawings
  const nightA = Math.min(1, S.stars * 1.15);
  const unit = band ? Math.min(w, h * 5.5) : w; // band clouds keep a size that fits the band

  // Stars, thinning towards the horizon.
  let dots = "";
  let sparks = "";
  if (S.stars > 0.02) {
    const r = rng(o.seed);
    for (let i = 0; i < o.stars; i++) {
      const st = { x: r(), y: r() ** 1.35, s: r(), a: r(), k: r() };
      const y = st.y * H * 0.92;
      const x = st.x * w;
      const fade = Math.min(1, Math.max(0, (1 - y / H) / 0.5));
      const a = (0.42 + st.a * 0.58) * S.stars * fade * (S.paper ? 0.6 : 1);
      if (a < 0.03) continue;
      const col = st.k > 0.9 ? S.starWarm : S.star;
      if (st.s > 0.972)
        sparks += `<path d="${spark(x, y, (5 + st.a * 4) * us)}" fill="${col}" fill-opacity="${Math.min(1, a * 1.2).toFixed(2)}"/>`;
      else {
        const rad =
          (st.s > 0.9 ? 1.7 + st.a * 0.6 : st.s > 0.5 ? 1.15 + st.a * 0.35 : 0.75 + st.a * 0.3) *
          us;
        dots += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${rad.toFixed(2)}" fill="${col}" fill-opacity="${a.toFixed(2)}"/>`;
      }
    }
  }

  // Nebula: soft glows, then a fine cloudy texture kept only where the glows are.
  let neb = "";
  let nebDefs = "";
  if (nightA > 0.02) {
    NEBULA.forEach(([x, y, rx, ry, c, a], i) => {
      const col = S.paper ? hex(0.8 + (c[0] - 0.44) * 0.3, c[1] * 0.45, c[2]) : ok(c);
      const A = a * nightA * (S.paper ? 0.55 : 1.25);
      const cx = x * w;
      const cy = y * H;
      const R = rx * w;
      nebDefs += `<radialGradient id="${p}n${i}" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(R)}" gradientTransform="translate(${f1(cx)} ${f1(cy)}) scale(1 ${(ry / rx).toFixed(3)}) translate(${f1(-cx)} ${f1(-cy)})" gradientUnits="userSpaceOnUse"><stop stop-color="${col}" stop-opacity="${A.toFixed(3)}"/><stop offset=".45" stop-color="${col}" stop-opacity="${(A * 0.45).toFixed(3)}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>`;
      neb += `<rect width="${w}" height="${(H + 1).toFixed(0)}" fill="url(#${p}n${i})"/>`;
    });
    nebDefs += `<filter id="${p}wisp" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${(2.2 / w).toFixed(5)} ${(4.4 / w).toFixed(5)}" numOctaves="4" seed="${o.seed}"/><feColorMatrix values="0 0 0 0 ${S.paper ? 0.42 : 0.62}  0 0 0 0 ${S.paper ? 0.46 : 0.66}  0 0 0 0 1  0 0 0 1.6 -0.62"/><feComposite in2="SourceGraphic" operator="in"/></filter>`;
    neb += `<g filter="url(#${p}wisp)" opacity="${(nightA * (S.paper ? 0.25 : 0.42)).toFixed(2)}">${neb}</g>`;
  }

  // Clouds: a few soft cumulus of different sizes, low in the sky, lit from above.
  const r = rng(o.seed * 7 + 3);
  const base = (horizon < 1 ? H * 0.68 : H * 0.92) - o.cloudLift * h;
  let body = "";
  let lite = "";
  let far = "";
  const cumulus = (cx: number, cy: number, cw: number): [string, string] => {
    const k = 4 + Math.floor(r() * 3);
    let d = "";
    let hi = "";
    for (let i = 0; i < k; i++) {
      const t = (i + 0.5) / k;
      const rr = (cw / k) * (0.7 + 0.65 * Math.sin(Math.PI * t)) * (0.85 + r() * 0.3);
      const x = cx - cw / 2 + t * cw + (r() - 0.5) * (cw / k) * 0.3;
      const y = cy - rr * 0.62;
      d += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(rr)}"/>`;
      hi += `<circle cx="${f1(x - rr * 0.08)}" cy="${f1(y - rr * 0.16)}" r="${f1(rr * 0.9)}"/>`;
    }
    d += `<rect x="${f1(cx - cw * 0.5)}" y="${f1(cy - cw * 0.07)}" width="${f1(cw)}" height="${f1(cw * 0.07)}" rx="${f1(cw * 0.035)}"/>`;
    return [d, hi];
  };
  const near = 3 + Math.floor(r() * 2);
  let x = w * (0.04 + r() * 0.12);
  for (let i = 0; i < near && x < w; i++) {
    const cw = unit * (i === 1 ? 0.17 + r() * 0.06 : 0.08 + r() * 0.07);
    const [d, hi] = cumulus(x + cw / 2, base - r() * h * 0.04, cw);
    body += d;
    lite += hi;
    x += cw + w * (0.06 + r() * 0.16);
  }
  x = w * (0.1 + r() * 0.2);
  for (let i = 0; i < 3 && x < w; i++) {
    const cw = unit * (0.05 + r() * 0.04);
    far += cumulus(x + cw / 2, base - h * (band ? 0.22 : 0.12) - r() * h * 0.08, cw)[0];
    x += cw + w * (0.2 + r() * 0.25);
  }
  const cA = S.cloudA * (band ? (S.paper ? 0.8 : 0.6) : 1) * (1 - nightA * 0.4);

  // Warm light at dawn and dusk, low in the sky; none in the dark band, where amber over indigo
  // turns mauve.
  const sx = w * 0.66;
  const warmA = band && o.key === "dim" ? 0 : S.warm * (S.paper ? 0.75 : 1);
  const warmY = horizon < 1 ? H * 0.66 : H;
  const glowA = band && S.paper ? 0.08 : S.glowA;
  const blur = (k: number) => (unit * k).toFixed(1);
  const x0 = f1(-w * 0.03);
  const y0 = f1(-h * 0.03);
  const ww = f1(w * 1.06);
  const hh = f1(h * 1.06);
  const wy = f1(warmY);
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" aria-hidden="true">
<defs>
<linearGradient id="${p}g" x1="0" y1="0" x2="${band ? 0 : f1(w * 0.1)}" y2="${f1(H)}" gradientUnits="userSpaceOnUse"><stop stop-color="${S.top}"/><stop offset="${band ? ".78" : ".52"}" stop-color="${S.mid}"/><stop offset="1" stop-color="${S.low}"/></linearGradient>
<radialGradient id="${p}r" cx="${f1(sx)}" cy="${wy}" r="${f1(w * 0.6)}" gradientTransform="translate(0 ${wy}) scale(1 .5) translate(0 ${f1(-warmY)})" gradientUnits="userSpaceOnUse"><stop stop-color="${S.glow}" stop-opacity="${(glowA * (1 - nightA * 0.6)).toFixed(3)}"/><stop offset=".5" stop-color="${S.glow}" stop-opacity="${(glowA * 0.36 * (1 - nightA * 0.6)).toFixed(3)}"/><stop offset="1" stop-color="${S.glow}" stop-opacity="0"/></radialGradient>
<radialGradient id="${p}t" cx="${f1(w * 0.14)}" cy="0" r="${f1(w * 0.5)}" gradientUnits="userSpaceOnUse"><stop stop-color="#FFFFFF" stop-opacity="${S.paper ? 0.12 : 0}"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
<radialGradient id="${p}w" cx="${f1(sx)}" cy="${wy}" r="${f1(w * 0.42)}" gradientTransform="translate(0 ${wy}) scale(1 ${band ? 1.1 : 0.3}) translate(0 ${f1(-warmY)})" gradientUnits="userSpaceOnUse"><stop stop-color="${S.warmSoft}" stop-opacity="${(warmA * 0.55).toFixed(3)}"/><stop offset=".35" stop-color="${S.warmC}" stop-opacity="${(warmA * 0.22).toFixed(3)}"/><stop offset="1" stop-color="${S.warmC}" stop-opacity="0"/></radialGradient>
<filter id="${p}b" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="${blur(0.004)}"/></filter>
<filter id="${p}b3" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="${blur(0.0065)}"/></filter>
<filter id="${p}b2" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="${blur(0.009)}"/></filter>
<linearGradient id="${p}f" x1="0" y1="${f1(fadeFrom)}" x2="0" y2="${f1(Math.min(h, H))}" gradientUnits="userSpaceOnUse"><stop stop-color="${deep}" stop-opacity="0"/><stop offset=".45" stop-color="${deep}" stop-opacity=".6"/><stop offset=".8" stop-color="${ground}" stop-opacity=".94"/><stop offset="1" stop-color="${ground}"/></linearGradient>
${nebDefs}
${o.grain ? `<filter id="${p}gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 -.2"/></filter>` : ""}
</defs>
<g class="bx-sky-settle"><rect x="${x0}" y="${y0}" width="${ww}" height="${hh}" fill="url(#${p}g)"/><rect x="${x0}" y="${y0}" width="${ww}" height="${hh}" fill="url(#${p}r)"/><rect x="${x0}" y="${y0}" width="${ww}" height="${hh}" fill="url(#${p}t)"/></g>
${neb}
${warmA > 0.01 ? `<rect width="${w}" height="${h}" fill="url(#${p}w)"/>` : ""}
${dots}${sparks}
<g filter="url(#${p}b2)" fill="${S.cloudUnder}" fill-opacity="${(cA * 0.5).toFixed(2)}">${far}</g>
<g filter="url(#${p}b)" fill="${S.cloudUnder}" fill-opacity="${(cA * 0.8).toFixed(2)}">${body}</g>
<g filter="url(#${p}b3)" fill="${S.cloudTop}" fill-opacity="${(cA * (S.paper ? 0.75 : 0.9)).toFixed(2)}">${lite}</g>
${horizon < 1 ? `<rect x="${x0}" y="${f1(fadeFrom)}" width="${ww}" height="${f1(h - fadeFrom + h * 0.03)}" fill="url(#${p}f)"/><rect x="${x0}" y="${f1(H - 0.5)}" width="${ww}" height="${f1(h - H + h * 0.03 + 1)}" fill="${ground}"/>` : ""}
${o.grain ? `<rect width="${w}" height="${h}" filter="url(#${p}gr)" opacity=".08"/>` : ""}
</svg>`;
}

/**
 * The band behind the top of Today: sky only, made to be faded into the page with a CSS mask.
 * `id` must be unique on the page (it prefixes the gradients and filters).
 */
export function skyBand(
  hour: number,
  { theme = "dark" as SkyTheme, width = 1400, height = 220, id = "sky" } = {},
): string {
  return draw(hour, {
    key: theme === "dark" ? "dim" : "paper",
    width,
    height,
    horizon: 1,
    band: true,
    stars: theme === "dark" ? 110 : 70,
    seed: 5,
    cloudLift: 0.3,
    ground: theme === "dark" ? "#020307" : "#FFFFFF",
    id,
    grain: false,
  });
}

/**
 * The whole sky, for the moments around the app (sign-in, nothing on, a lost address): full
 * colour at any hour, fading into the Night ground below `horizon`. Text on it is white.
 */
export function skyScene(
  hour: number,
  { width = 1200, height = 900, horizon = 0.82, stars = 200, id = "sky", grain = false } = {},
): string {
  return draw(hour, {
    key: "sky",
    width,
    height,
    horizon,
    band: false,
    stars,
    seed: 11,
    cloudLift: 0,
    ground: "#050F2F",
    id,
    grain,
  });
}

/** The hour of the day, with fractions, at a moment in a time zone (the device's own if none). */
export function hourIn(now: number, zone: string | null): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: zone ?? undefined,
  }).formatToParts(new Date(now));
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hh + mm / 60;
}
