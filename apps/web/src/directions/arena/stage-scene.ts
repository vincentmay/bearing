import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

export type StageRecipe = "cs2" | "lol" | "chess" | "trackmania" | "rocket-league" | "team";

export interface StageOptions {
  recipe: StageRecipe;
  accent: string;
  glow: string;
  deep: string;
  /** Where the sculpture sits horizontally, -1 (left) to 1 (right). */
  focus: number;
  reducedMotion: boolean;
}

const TUNING: Record<StageRecipe, { exposure: number; bloom: number; threshold: number }> = {
  cs2: { exposure: 1.05, bloom: 0.55, threshold: 0.72 },
  team: { exposure: 1.0, bloom: 0.5, threshold: 0.75 },
  lol: { exposure: 1.0, bloom: 0.5, threshold: 0.75 },
  chess: { exposure: 0.72, bloom: 0.22, threshold: 0.9 },
  trackmania: { exposure: 1.0, bloom: 0.6, threshold: 0.7 },
  "rocket-league": { exposure: 0.95, bloom: 0.45, threshold: 0.8 },
};

interface Built {
  update: (t: number, dt: number) => void;
  dispose: () => void;
}

/**
 * Procedural stage: no external assets, every form generated in code from the
 * discipline's identity.
 */
export function createStage(canvas: HTMLCanvasElement, options: StageOptions) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Light materials (marble, chrome) need less exposure and bloom than dark metals.
  const tune = TUNING[options.recipe];
  renderer.toneMappingExposure = tune.exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const deep = new THREE.Color(options.deep);
  scene.background = deep.clone().multiplyScalar(0.55);
  scene.fog = new THREE.FogExp2(deep.clone().multiplyScalar(0.55), 0.045);

  // A generated studio for metals and glass to reflect; no external HDRI.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0.4, 11);

  const accent = new THREE.Color(options.accent);
  const glow = new THREE.Color(options.glow);

  scene.add(new THREE.HemisphereLight(glow.clone().multiplyScalar(0.35), deep, 0.6));
  const key = new THREE.DirectionalLight(accent, 2.4);
  key.position.set(4, 6, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(glow, 1.8);
  rim.position.set(-6, -2, -4);
  scene.add(rim);
  const fill = new THREE.PointLight(0xffffff, 18, 18, 2);
  fill.position.set(2, 1, 4);
  scene.add(fill);

  const root = new THREE.Group();
  scene.add(root);

  const built = build(options.recipe, root, accent, glow, deep);
  const dust = buildDust(accent, glow);
  scene.add(dust.points);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), tune.bloom, 0.6, tune.threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e: PointerEvent) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  let width = 0;
  let height = 0;
  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === width && h === height) return;
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    // Keep the sculpture on its side on wide screens; centre it behind content on phones.
    const narrow = w < 820;
    root.position.x = narrow ? 0 : options.focus * Math.min(4.2, camera.aspect * 1.9);
    root.position.y = narrow ? 1.2 : 0;
    root.scale.setScalar(narrow ? 0.72 : 0.92);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let raf = 0;
  let last = performance.now();
  let elapsed = 0;
  const frame = (now: number) => {
    // A frame's timestamp can predate the performance.now() taken when the loop started,
    // so clamp at zero: the stage clock must never run backwards.
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    elapsed += dt;
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    camera.position.x = pointer.x * 0.5;
    camera.position.y = 0.4 - pointer.y * 0.3;
    camera.lookAt(root.position.x * 0.35, 0, 0);
    built.update(elapsed, dt);
    dust.update(elapsed);
    composer.render(dt);
    raf = requestAnimationFrame(frame);
  };

  const start = () => {
    if (options.reducedMotion) {
      built.update(4, 0);
      dust.update(4);
      composer.render();
      return;
    }
    cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const onVisibility = () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else start();
  };
  document.addEventListener("visibilitychange", onVisibility);
  start();
  canvas.dataset.ready = options.recipe;

  return {
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      built.dispose();
      dust.dispose();
      composer.dispose();
      envTexture.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}

function build(
  recipe: StageRecipe,
  root: THREE.Group,
  accent: THREE.Color,
  glow: THREE.Color,
  deep: THREE.Color,
): Built {
  switch (recipe) {
    case "cs2":
      return shards(root, accent, glow, deep, { count: 34, spread: 1, beams: true });
    case "team":
      return shards(root, accent, glow, deep, { count: 26, spread: 0.85, beams: false });
    case "lol":
      return hextech(root, accent, glow);
    case "chess":
      return chessPieces(root, accent, glow);
    case "trackmania":
      return ribbons(root, accent, glow);
    case "rocket-league":
      return arenaBall(root, accent, glow);
  }
}

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A burst of thin metal blades around a focal point, with slow light beams. */
function shards(
  root: THREE.Group,
  accent: THREE.Color,
  glow: THREE.Color,
  deep: THREE.Color,
  o: { count: number; spread: number; beams: boolean },
): Built {
  const r = seeded(11);
  const geo = new THREE.OctahedronGeometry(1, 0);
  const metal = new THREE.MeshStandardMaterial({
    color: accent.clone().lerp(deep, 0.35),
    metalness: 0.92,
    roughness: 0.28,
    flatShading: true,
    emissive: accent.clone().multiplyScalar(0.06),
  });
  const dark = new THREE.MeshStandardMaterial({
    color: deep.clone().lerp(new THREE.Color(0x222222), 0.5),
    metalness: 0.8,
    roughness: 0.4,
    flatShading: true,
  });
  const edge = new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.9 });
  const items: { mesh: THREE.Mesh; base: THREE.Euler; speed: number; phase: number; y: number }[] =
    [];
  for (let i = 0; i < o.count; i++) {
    const a = (i / o.count) * Math.PI * 2 + r() * 0.4;
    const dist = (0.6 + r() * 2.6) * o.spread;
    const mesh = new THREE.Mesh(geo, i % 5 === 0 ? dark : metal);
    const len = 0.6 + r() * 2.2;
    mesh.scale.set(0.05 + r() * 0.16, len, 0.012 + r() * 0.04);
    mesh.position.set(Math.cos(a) * dist, Math.sin(a) * dist * 0.85, -r() * 3 + 0.5);
    mesh.rotation.set(r() * 0.6, r() * 0.6, a - Math.PI / 2 + (r() - 0.5) * 0.5);
    root.add(mesh);
    items.push({
      mesh,
      base: mesh.rotation.clone(),
      speed: 0.15 + r() * 0.35,
      phase: r() * 10,
      y: mesh.position.y,
    });
    if (i % 4 === 1) {
      const sliver = new THREE.Mesh(geo, edge);
      sliver.scale.set(0.006, len * 0.9, 0.006);
      mesh.add(sliver);
    }
  }
  // Central faceted core.
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), metal);
  core.scale.set(0.8, 1.25, 0.8);
  root.add(core);

  const beams: THREE.Mesh[] = [];
  if (o.beams) {
    const beamMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: glow }, uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uTime; varying vec2 vUv;
        void main(){ float x = abs(vUv.x - 0.5) * 2.0; float a = pow(1.0 - x, 3.0) * smoothstep(0.0, 0.6, vUv.y) * (1.0 - vUv.y);
        a *= 0.55 + 0.45 * sin(uTime * 0.6 + vUv.y * 3.0); gl_FragColor = vec4(uColor, a * 0.16); }`,
    });
    for (let i = 0; i < 3; i++) {
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 14), beamMat);
      beam.position.set(-1.5 + i * 1.6, 2, -3 - i);
      beam.rotation.z = -0.35 + i * 0.18;
      root.add(beam);
      beams.push(beam);
    }
  }

  return {
    update(t) {
      root.rotation.y = Math.sin(t * 0.08) * 0.25;
      core.rotation.y = t * 0.2;
      core.rotation.x = Math.sin(t * 0.3) * 0.2;
      for (const it of items) {
        it.mesh.rotation.x = it.base.x + Math.sin(t * it.speed + it.phase) * 0.12;
        it.mesh.rotation.y = it.base.y + t * it.speed * 0.25;
        it.mesh.position.y = it.y + Math.sin(t * it.speed * 0.8 + it.phase) * 0.08;
      }
      for (const b of beams) (b.material as THREE.ShaderMaterial).uniforms.uTime!.value = t;
    },
    dispose() {
      geo.dispose();
      metal.dispose();
      dark.dispose();
      edge.dispose();
    },
  };
}

/** A tilted honeycomb of gold prisms with teal light rising through it. */
function hextech(root: THREE.Group, accent: THREE.Color, glow: THREE.Color): Built {
  const r = seeded(5);
  const radius = 0.32;
  const geo = new THREE.CylinderGeometry(radius * 0.94, radius * 0.94, 1, 6, 1);
  geo.translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: accent,
    metalness: 0.95,
    roughness: 0.32,
    flatShading: true,
  });
  const cells: { x: number; z: number; d: number }[] = [];
  for (let q = -7; q <= 7; q++) {
    for (let s = -7; s <= 7; s++) {
      const x = radius * 1.75 * (q + s / 2);
      const z = radius * 1.52 * s;
      const d = Math.hypot(x, z);
      if (d < 3.6) cells.push({ x, z, d });
    }
  }
  const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
  const caps = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, 0.02, 6),
    new THREE.MeshBasicMaterial({ color: glow }),
    cells.length,
  );
  const group = new THREE.Group();
  group.add(mesh, caps);
  group.rotation.x = 0.95;
  group.rotation.z = 0.2;
  group.position.set(0, -0.4, -1);
  root.add(group);
  const m = new THREE.Matrix4();
  const phase = cells.map(() => r() * 10);
  const update = (t: number) => {
    cells.forEach((c, i) => {
      const h =
        0.15 + Math.max(0, Math.sin(t * 0.6 + c.d * 1.4 + phase[i]! * 0.15)) * 0.9 * (1 - c.d / 4);
      m.makeScale(1, h, 1).setPosition(c.x, 0, c.z);
      mesh.setMatrixAt(i, m);
      m.makeTranslation(c.x, h + 0.01, c.z);
      caps.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
    group.rotation.z = 0.2 + t * 0.03;
  };
  update(0);
  return {
    update,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

function lathe(profile: [number, number][], segments = 64) {
  return new THREE.LatheGeometry(
    profile.map(([x, y]) => new THREE.Vector2(x, y)),
    segments,
  );
}

/** Marble king and queen over a walnut board that fades into the dark. */
function chessPieces(root: THREE.Group, accent: THREE.Color, glow: THREE.Color): Built {
  const marble = new THREE.MeshPhysicalMaterial({
    color: accent,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    sheen: 0.4,
  });
  const walnut = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(glow).multiplyScalar(0.35),
    roughness: 0.35,
    clearcoat: 0.8,
  });
  const base: [number, number][] = [
    [0, 0],
    [0.62, 0],
    [0.62, 0.1],
    [0.52, 0.16],
    [0.5, 0.24],
    [0.36, 0.3],
    [0.3, 0.42],
  ];
  const king = lathe([
    ...base,
    [0.24, 1.4],
    [0.34, 1.48],
    [0.36, 1.56],
    [0.24, 1.62],
    [0.3, 1.82],
    [0.2, 1.96],
    [0, 1.98],
  ]);
  const queen = lathe([
    ...base,
    [0.22, 1.28],
    [0.34, 1.38],
    [0.36, 1.44],
    [0.22, 1.5],
    [0.32, 1.7],
    [0.14, 1.78],
    [0.1, 1.82],
    [0, 1.84],
  ]);
  const pawn = lathe([
    ...base.slice(0, 6),
    [0.18, 0.62],
    [0.28, 0.68],
    [0.16, 0.74],
    [0.24, 0.86],
    [0.24, 0.98],
    [0.14, 1.06],
    [0, 1.08],
  ]);
  const cross = new THREE.Group();
  const bar = new THREE.BoxGeometry(0.08, 0.32, 0.08);
  const arm = new THREE.BoxGeometry(0.24, 0.08, 0.08);
  cross.add(new THREE.Mesh(bar, marble), new THREE.Mesh(arm, marble).translateY(0.04));
  cross.position.y = 2.12;

  const kingMesh = new THREE.Mesh(king, marble);
  kingMesh.add(cross);
  kingMesh.position.set(0.3, -1.6, 0);
  const queenMesh = new THREE.Mesh(queen, walnut);
  queenMesh.position.set(-1.1, -1.6, -1.2);
  const pawns = [-2.1, 1.5, 2.3].map((x, i) => {
    const p = new THREE.Mesh(pawn, i === 1 ? walnut : marble);
    p.position.set(x, -1.6, -1.8 - i * 0.6);
    return p;
  });
  root.add(kingMesh, queenMesh, ...pawns);

  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) {
      ctx.fillStyle =
        (i + j) % 2
          ? `#${glow.clone().multiplyScalar(0.28).getHexString()}`
          : `#${accent.clone().multiplyScalar(0.55).getHexString()}`;
      ctx.fillRect((i * size) / 8, (j * size) / 8, size / 8, size / 8);
    }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshPhysicalMaterial({
      map: tex,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    }),
  );
  board.rotation.x = -Math.PI / 2;
  board.position.y = -1.6;
  root.add(board);
  root.rotation.x = 0.12;

  return {
    update(t) {
      root.rotation.y = -0.5 + Math.sin(t * 0.07) * 0.35;
      kingMesh.rotation.y = t * 0.05;
    },
    dispose() {
      [king, queen, pawn, bar, arm].forEach((g) => g.dispose());
      marble.dispose();
      walnut.dispose();
      tex.dispose();
    },
  };
}

/** Glowing racing lines sweeping through space, with light pulses riding them. */
function ribbons(root: THREE.Group, accent: THREE.Color, glow: THREE.Color): Built {
  const r = seeded(21);
  const lines: { curve: THREE.CatmullRomCurve3; pulses: THREE.Mesh[]; speed: number }[] = [];
  const disposables: { dispose: () => void }[] = [];
  const pulseGeo = new THREE.SphereGeometry(0.05, 12, 12);
  disposables.push(pulseGeo);
  for (let i = 0; i < 7; i++) {
    const pts: THREE.Vector3[] = [];
    const yaw = (r() - 0.5) * 0.8;
    for (let k = 0; k < 7; k++) {
      const x = -6 + k * 2;
      pts.push(
        new THREE.Vector3(
          x,
          Math.sin(k * 0.9 + i) * (0.6 + r()) + (i - 3) * 0.32,
          Math.cos(k * 0.7 + i * 2) * 1.6 + yaw * x - 1,
        ),
      );
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const color = i % 3 === 0 ? glow : accent;
    const tube = new THREE.TubeGeometry(curve, 200, i % 3 === 0 ? 0.035 : 0.018, 8, false);
    const mat = new THREE.MeshBasicMaterial({
      color: color.clone().multiplyScalar(i % 3 === 0 ? 1.4 : 1),
      transparent: true,
      opacity: 0.85,
    });
    root.add(new THREE.Mesh(tube, mat));
    disposables.push(tube, mat);
    const pmat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1, 1, 1).lerp(color, 0.3).multiplyScalar(3),
    });
    disposables.push(pmat);
    const pulses = Array.from({ length: 2 }, () => {
      const p = new THREE.Mesh(pulseGeo, pmat);
      root.add(p);
      return p;
    });
    lines.push({ curve, pulses, speed: 0.04 + r() * 0.05 });
  }
  // A faint track surface underneath.
  const grid = new THREE.GridHelper(
    30,
    60,
    accent.clone().multiplyScalar(0.25),
    accent.clone().multiplyScalar(0.08),
  );
  grid.position.y = -2.2;
  root.add(grid);
  disposables.push(grid.geometry, grid.material as THREE.Material);
  return {
    update(t) {
      root.rotation.y = Math.sin(t * 0.05) * 0.3 - 0.2;
      for (const l of lines) {
        l.pulses.forEach((p, k) => {
          // Arc-length mapping can overshoot 1 at the very end of a curve; keep it inside.
          const u = Math.min(0.999, (t * l.speed + k * 0.5) % 1);
          l.curve.getPointAt(u, p.position);
        });
      }
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}

/** A faceted ball held in orbiting boost rings over a hex floor. */
function arenaBall(root: THREE.Group, accent: THREE.Color, glow: THREE.Color): Built {
  const ballGeo = new THREE.IcosahedronGeometry(1.2, 1);
  const ball = new THREE.Mesh(
    ballGeo,
    new THREE.MeshStandardMaterial({
      color: 0xd8dce6,
      metalness: 0.4,
      roughness: 0.35,
      flatShading: true,
    }),
  );
  const seams = new THREE.LineSegments(
    new THREE.EdgesGeometry(ballGeo),
    new THREE.LineBasicMaterial({ color: 0x1b2233 }),
  );
  ball.add(seams);
  root.add(ball);
  const rings = [accent, glow, accent].map((c, i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.8 + i * 0.45, 0.018 + (i === 1 ? 0.012 : 0), 8, 160),
      new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.6) }),
    );
    ring.rotation.set(Math.PI / 2 + i * 0.35, i * 0.6, 0);
    root.add(ring);
    return ring;
  });
  const floor = new THREE.GridHelper(
    30,
    40,
    accent.clone().multiplyScalar(0.3),
    accent.clone().multiplyScalar(0.08),
  );
  floor.position.y = -2.4;
  root.add(floor);
  return {
    update(t) {
      ball.rotation.set(t * 0.25, t * 0.35, 0);
      ball.position.y = Math.sin(t * 0.8) * 0.12;
      rings.forEach((ring, i) => {
        ring.rotation.z = t * (0.2 + i * 0.08) * (i % 2 ? -1 : 1);
      });
    },
    dispose() {
      ballGeo.dispose();
    },
  };
}

function buildDust(accent: THREE.Color, glow: THREE.Color) {
  const count = 420;
  const r = seeded(99);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (r() - 0.5) * 22;
    positions[i * 3 + 1] = (r() - 0.5) * 12;
    positions[i * 3 + 2] = (r() - 0.5) * 12 - 2;
    const c = r() < 0.5 ? accent : glow;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.03,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  return {
    points,
    update(t: number) {
      points.rotation.y = t * 0.01;
      points.position.y = Math.sin(t * 0.1) * 0.2;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
