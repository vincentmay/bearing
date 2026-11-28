/**
 * What a top card's sky holds of the teams and players on it. The form follows the hour, as the
 * sky's own does (lib/sky.ts): by day it is a little cloud that takes their colour, at dawn and
 * dusk the low light along the bottom of the sky, at night a faint nebula. It is drawn by one
 * fragment shader into a picture laid over the sky of the hour. The picture is premultiplied, so
 * one pass both adds light and lets cloud cover what is behind it.
 *
 * It is a still picture, drawn again only when the card changes, and one painter serves every
 * card in the app. Both matter where a browser has no graphics card behind it: there a picture
 * costs a few hundredths of a second, which twenty times a second made every press wait. The
 * painter's program is also built off the main thread where the browser can, because building
 * it takes most of a second.
 *
 * Nothing here is needed for the page to work: without WebGL the card keeps the plain sky.
 */
import type { SkyForm } from "./sky";

/** A source of colour in the card: where it is (in the card's own pixels) and how far it reaches. */
export interface Light {
  x: number;
  y: number;
  /** How far the colour reaches, in pixels. */
  r: number;
  /** The team's or player's colour, as "#rrggbb". */
  color: string;
  /** How strong it is, 0 to 1: the side that is ahead is stronger. */
  a: number;
  /** The radius of the logo it comes from: the colour leaves that much clear around its centre. */
  k: number;
}

export interface NebulaView {
  width: number;
  height: number;
  lights: Light[];
  form: SkyForm;
  /** The amber light before a start the viewer is waiting for, 0 to 1. */
  first: number;
  /** Moves the clouds, so that two cards and two days do not look alike. */
  seed: number;
}

const MOST = 8;
/** The canvas is drawn smaller than the card and stretched: everything on it is soft. */
const SCALE = 0.6;

const VERTEX = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }";
const FRAGMENT = `precision highp float;
uniform vec2 uRes;
uniform float uScale, uT, uNight, uDay, uTwi, uMorning, uFirst, uSeed, uN;
uniform vec4 uLp[${MOST}];
uniform vec3 uLc[${MOST}];
uniform vec3 uLd[${MOST}];
uniform float uLk[${MOST}];
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * noise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3; a *= .5; } return s; }
void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uScale;
  float yb = px.y * uScale / uRes.y;
  vec2 p = px / 300. + uSeed;
  float t = uT * .006;
  vec2 q = vec2(fbm(p + vec2(0., t)), fbm(p + vec2(5.2, 1.3) - vec2(t, 0.)));
  vec2 w = vec2(fbm(p + 1.8 * q + vec2(1.7, 9.2) + t * .7), fbm(p + 1.8 * q + vec2(8.3, 2.8) - t * .5));
  float W = 0., keep = 1., WX = 0.;
  vec3 C = vec3(0.), D = vec3(0.), CX = vec3(0.);
  for (int i = 0; i < ${MOST}; i++) {
    if (float(i) >= uN) break;
    vec4 L = uLp[i];
    vec2 d0 = (px - L.xy) / L.z;
    vec2 d = d0;
    d.y *= 1.25;
    d += (w - .5) * 1.05 + (q - .5) * .35;
    float fall = exp(-dot(d, d) * 2.3);
    // Whoever is shown sits in a clearing, as a star does in its own gas.
    float e = L.w * fall * mix(.25, 1., smoothstep(uLk[i] * .8, uLk[i] * 2.4, length(px - L.xy)));
    C += uLc[i] * e;
    D += uLd[i] * e;
    W += e;
    keep *= 1. - clamp(e, 0., 1.);
    // The same reach along the bottom of the sky, for the light of dawn and dusk.
    float ex = L.w * exp(-d0.x * d0.x * 1.2);
    CX += uLc[i] * ex;
    WX += ex;
  }
  float E = 1. - keep;
  vec3 c = C / max(W, 1e-4);
  vec3 c2 = D / max(W, 1e-4);
  vec3 em = vec3(0.);
  float al = 0.;
  if (uNight > 0. && E > .002) {
    float f = fbm(p * 1.3 + 1.9 * w);
    float fine = fbm(p * 4.2 + 1.2 * w + 31.);
    float rd = 1. - abs(2. * fbm(p * 2.3 + 1.6 * w + 11.) - 1.);
    float lane = smoothstep(.5, .66, fbm(p * 1.9 - 1.8 * q + 23.));
    float body = smoothstep(.24, .88, f);
    float gas = body * (.6 + .5 * fine) + pow(rd, 5.) * .28 * (.3 + body);
    float dens = E * (.12 + 1.35 * gas) * (1. - .45 * lane);
    // Two gases, as in a real one: their colour and its neighbour, in different parts of the
    // cloud. Where it thins out it falls back into the sky's own indigo.
    float which = smoothstep(.36, .64, fbm(p * .9 + q * 1.2 + 40.));
    vec3 tone = mix(c, c2, which * .6);
    vec3 col = mix(mix(tone, vec3(.36, .4, .98), .45), tone, smoothstep(.1, .5, dens));
    col = mix(col, mix(c, vec3(1.), .5), smoothstep(.75, 1.4, dens));
    em += (1. - exp(-col * dens * 1.08)) * uNight;
    al += clamp(E * .42 * (.3 + .7 * body), 0., .6) * uNight;
  }
  if (uTwi > 0. || uFirst > 0.) {
    // Low light along the bottom of the sky: rose at dawn, orange at dusk, and theirs where they are.
    vec3 low = mix(vec3(1., .5, .16), vec3(1., .6, .52), uMorning);
    float sum = clamp(WX, 0., 1.);
    vec3 hc = mix(low, CX / max(WX, 1e-4), sum * .9);
    float glow = pow(yb, mix(2.6, 3.2, uMorning));
    // Cloud lying across it, lit from below and dark against the sky above: long streaks at
    // dusk, thin bands of mist low down at dawn.
    vec2 ps = vec2(px.x / mix(560., 780., uMorning), px.y / mix(64., 30., uMorning)) + uSeed + vec2(t * .8, 0.);
    float st = smoothstep(mix(.5, .53, uMorning), .74, fbm(ps + .7 * q));
    st *= mix(1., smoothstep(.3, .8, yb), uMorning);
    float lit = st * smoothstep(.1, .95, yb);
    em += (hc * (glow * .7 + lit * .3) + vec3(1., .88, .74) * pow(yb, 8.) * .16) * uTwi * (.45 + .55 * sum);
    al += st * .26 * (1. - yb) * uTwi;
    em += vec3(1., .56, .22) * pow(yb, 2.4) * .5 * uFirst * (1. - uTwi);
  }
  if (uDay > 0. && E > .002) {
    // Cumulus near whoever is shown: white on top, their colour in its shade.
    vec2 pc = vec2(px.x / 340., px.y / 185.) + uSeed * 1.7 + vec2(t * .5, 0.);
    vec2 wp = vec2(fbm(pc * 1.6 + 3.1), fbm(pc * 1.6 + 9.7)) - .5;
    float b = fbm(pc + wp * .9);
    float bu = fbm(pc + wp * .9 - vec2(0., .17));
    float top = clamp((b - bu) * 5. + .5, 0., 1.);
    vec3 cc = mix(mix(c, vec3(.22, .28, .66), .2), mix(vec3(1.), c, .42), top);
    float a2 = smoothstep(.47, .68, b) * E * .5 * uDay;
    em = em * (1. - a2) + cc * a2;
    al = al + a2 - al * a2;
    // And a little of their colour in the air around it.
    em += c * E * .12 * uDay;
  }
  float n = (hash(px + fract(uT) * 61.) - .5) / 255.;
  gl_FragColor = vec4(em + n, al);
}`;

/** OKLCH of a "#rrggbb" colour. */
function okOf(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const r = lin(n >> 16);
  const g = lin((n >> 8) & 255);
  const b = lin(n & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}

/** sRGB, 0 to 1 each, of an OKLCH colour, with less colour if the screen cannot show it. */
function rgbOf(L: number, C: number, h: number): [number, number, number] {
  const at = (c: number): [number, number, number] => {
    const a = c * Math.cos((h * Math.PI) / 180);
    const b = c * Math.sin((h * Math.PI) / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
  };
  let c = C;
  let v = at(c);
  while (c > 0.005 && v.some((x) => x < -0.001 || x > 1.001)) {
    c -= 0.006;
    v = at(c);
  }
  const g = (x: number) => {
    const y = Math.min(1, Math.max(0, x));
    return y <= 0.0031308 ? y * 12.92 : 1.055 * y ** (1 / 2.4) - 0.055;
  };
  return [g(v[0]), g(v[1]), g(v[2])];
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * A team's colour as the sky wears it: the hue is theirs, how strong and how bright it is belongs
 * to the sky. Returned with its neighbour, the second gas of the nebula.
 *
 * A team in white, grey or black has no hue to give and gets starlight. A yellow one gets the
 * sky's violet with a pale warm white in it: dim yellow in a night sky is olive or brown, never gold.
 */
export function skyColours(hex: string): [[number, number, number], [number, number, number]] {
  let [L, C, h] = okOf(/^#[0-9a-f]{6}$/i.test(hex) ? hex : "#808080");
  if (C < 0.045) {
    h = 262;
    C = 0.08;
    L = 0.82;
  }
  if (h > 58 && h < 118) {
    // From orange-yellow to yellow-green: the gas keeps the sky's own violet, and only its
    // second part is theirs, as a pale warm white (paler the closer it is to pure yellow).
    const pure = 1 - Math.min(1, Math.abs(h - 95) / 37);
    return [rgbOf(0.7, 0.13, 288), rgbOf(0.88, 0.1 - pure * 0.05, h + (86 - h) * 0.5)];
  }
  L = clamp(L, 0.66, 0.86);
  C = clamp(C, 0.13, 0.2);
  const turn = h > 118 && h < 200 ? 30 : h >= 200 && h < 300 ? 36 : -30;
  return [rgbOf(L, C, h), rgbOf(L * 0.9, Math.min(0.22, C * 1.1), (h + turn + 360) % 360)];
}

/** The one canvas and program every card's picture is drawn with. */
class Painter {
  private canvas: OffscreenCanvas;
  private gl: WebGLRenderingContext | null = null;
  private at: (name: string) => WebGLUniformLocation | null = () => null;
  private colours = new Map<string, ReturnType<typeof skyColours>>();
  private waiting: (() => void)[] = [];
  /** Being built, able to draw, or not able to (no WebGL, or the context was taken away). */
  state: "making" | "ready" | "none" = "making";
  /** The context was there and was taken away, so asking again may work. */
  lost = false;

  constructor() {
    this.canvas = new OffscreenCanvas(2, 2);
    const gl = this.canvas.getContext("webgl", {
      premultipliedAlpha: true,
      alpha: true,
      antialias: false,
    });
    if (!gl) {
      this.state = "none";
      return;
    }
    this.gl = gl;
    this.canvas.addEventListener("webglcontextlost", () => {
      this.lost = true;
      this.settle("none");
    });
    // Asked for before anything is compiled: with it the browser builds the program on another
    // thread and says when it is done, and nothing here waits for it.
    const parallel = gl.getExtension("KHR_parallel_shader_compile");
    const shader = (type: number, source: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return s;
    };
    const vs = shader(gl.VERTEX_SHADER, VERTEX);
    const fs = shader(gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vs || !fs || !program) {
      this.state = "none";
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    const finish = () => {
      if (this.state !== "making") return;
      if (gl.isContextLost() || !gl.getProgramParameter(program, gl.LINK_STATUS)) {
        this.settle("none");
        return;
      }
      gl.useProgram(program);
      // One triangle that covers the canvas.
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const p = gl.getAttribLocation(program, "p");
      gl.enableVertexAttribArray(p);
      gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
      const found = new Map<string, WebGLUniformLocation | null>();
      this.at = (name) => {
        if (!found.has(name)) found.set(name, gl.getUniformLocation(program, name));
        return found.get(name) ?? null;
      };
      this.settle("ready");
    };
    if (parallel) {
      const look = () => {
        if (this.state !== "making") return;
        if (gl.isContextLost()) this.settle("none");
        else if (gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) finish();
        else setTimeout(look, 50);
      };
      setTimeout(look, 50);
    } else if (typeof requestIdleCallback === "function") {
      // Asking whether it is done waits until it is: left for a moment when nothing else is on.
      requestIdleCallback(finish, { timeout: 4000 });
    } else {
      setTimeout(finish, 1500);
    }
  }

  private settle(state: "ready" | "none") {
    this.state = state;
    if (state === "none") this.gl = null;
    for (const told of this.waiting.splice(0)) told();
  }

  /** Calls back once it is known whether pictures can be drawn. Returns a way to stop waiting. */
  whenSettled(told: () => void): () => void {
    if (this.state !== "making") {
      told();
      return () => {};
    }
    this.waiting.push(told);
    return () => {
      this.waiting = this.waiting.filter((x) => x !== told);
    };
  }

  /** The picture for one card, or nothing if none can be drawn (yet). */
  draw(view: NebulaView): ImageBitmap | null {
    const gl = this.gl;
    if (!gl || this.state !== "ready" || gl.isContextLost()) return null;
    const w = Math.max(1, Math.round(view.width * SCALE));
    const h = Math.max(1, Math.round(view.height * SCALE));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const lights = view.lights.slice(0, MOST);
    const lp = new Float32Array(MOST * 4);
    const lc = new Float32Array(MOST * 3);
    const ld = new Float32Array(MOST * 3);
    const lk = new Float32Array(MOST);
    lights.forEach((l, i) => {
      lp.set([l.x, l.y, l.r, l.a], i * 4);
      let pair = this.colours.get(l.color);
      if (!pair) {
        pair = skyColours(l.color);
        this.colours.set(l.color, pair);
      }
      lc.set(pair[0], i * 3);
      ld.set(pair[1], i * 3);
      lk[i] = l.k;
    });
    gl.viewport(0, 0, w, h);
    gl.uniform2f(this.at("uRes"), w, h);
    gl.uniform1f(this.at("uScale"), SCALE);
    gl.uniform1f(this.at("uT"), 0);
    gl.uniform1f(this.at("uNight"), view.form.night);
    gl.uniform1f(this.at("uDay"), view.form.day);
    gl.uniform1f(this.at("uTwi"), view.form.twilight);
    gl.uniform1f(this.at("uMorning"), view.form.morning ? 1 : 0);
    gl.uniform1f(this.at("uFirst"), view.first);
    gl.uniform1f(this.at("uSeed"), view.seed);
    gl.uniform1f(this.at("uN"), lights.length);
    gl.uniform4fv(this.at("uLp[0]"), lp);
    gl.uniform3fv(this.at("uLc[0]"), lc);
    gl.uniform3fv(this.at("uLd[0]"), ld);
    gl.uniform1fv(this.at("uLk[0]"), lk);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return this.canvas.transferToImageBitmap();
  }
}

let painter: Painter | undefined;

/** The app's one painter, made the first time a card asks; none where the browser lacks the parts. */
function painterOf(): Painter | undefined {
  if (typeof OffscreenCanvas === "undefined" || typeof ImageBitmap === "undefined")
    return undefined;
  // A context the browser took away (a sleeping laptop, a driver update) is asked for again.
  if (!painter || (painter.state === "none" && painter.lost)) painter = new Painter();
  return painter;
}

/**
 * Calls back once pictures can be asked for (at once if they can already), and never where they
 * cannot be drawn at all. Returns a way to stop waiting.
 */
export function whenNebulaReady(told: () => void): () => void {
  const p = painterOf();
  if (!p) return () => {};
  return p.whenSettled(() => {
    if (p.state === "ready") told();
  });
}

/** The picture of one card's colours, to be laid over its sky; nothing while none can be drawn. */
export function nebulaPicture(view: NebulaView): ImageBitmap | null {
  return painterOf()?.draw(view) ?? null;
}
