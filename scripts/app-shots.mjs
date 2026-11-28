// Screenshots of every Bearing screen in the running app (vp dev on :5810): light and dark, at
// phone and wide width. It also checks each one for sideways scrolling and console errors.
// The sample is paused first so that every run shows the same moment.
// Usage: node scripts/app-shots.mjs [out-dir] [only]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? ".local/app";
const only = process.argv[3];
const base = "http://localhost:5810";
mkdirSync(out, { recursive: true });

const SIZES = { phone: { width: 390, height: 844 }, wide: { width: 1440, height: 900 } };
const LIVE = {
  cs2: "/match/cs2-copenhagen-masters-2026-po-sf2",
  lol: "/match/lol-rift-invitational-2026-sf1",
  rl: "/match/rl-winter-open-2026-final",
  chess: "/match/chess-fall-classic-2026-r6-b1",
  tm: "/match/tm-cup-finals-2026-qf-A",
};
const PAGES = [
  ["today", "/"],
  ...Object.entries(LIVE).map(([k, v]) => [`match-${k}`, v]),
  ["match-done", "/match/cs2-copenhagen-masters-2026-po-sf1"],
  ["match-done-rl", "/match/rl-winter-open-2026-sf1"],
  ["match-next", "/match/lol-rift-invitational-2026-sf2"],
  ["match-open", "/match/cs2-copenhagen-masters-2026-po-final"],
  ["schedule", "/schedule"],
  ["following", "/following"],
  ["search", "/search"],
  ["settings", "/settings"],
  ["team-cs2", "/team/cs2-vitality"],
  ["team-lol", "/team/lol-t1"],
  ["player-cs2", "/player/cs2-zywoo"],
  ["player-chess", "/player/chess-carlsen"],
  ["event-cs2", "/tournament/cs2-copenhagen-masters-2026"],
  ["event-chess", "/tournament/chess-fall-classic-2026"],
  ["event-tm", "/tournament/tm-cup-finals-2026"],
  ["event-lol", "/tournament/lol-rift-invitational-2026"],
  ["event-past", "/tournament/cs2-autumn-showdown-2026"],
].filter(([name]) => !only || name.startsWith(only));

// These checks drive the sample by hand, so they keep the app on the sample in the browser even
// when a backend is configured.
const keepLocal = () => localStorage.setItem("bearing.source", "local");
const browser = await chromium.launch({ channel: "chrome" });
// Without a backend configured, React Query says "No queryFn" for the queries the sample does
// not need; that is this machine's setup, not something the page did.
const real = (m) => m.type() === "error" && !m.text().includes("No queryFn");
const problems = [];
for (const [size, viewport] of Object.entries(SIZES)) {
  for (const scheme of ["light", "dark"]) {
    const page = await browser.newPage({
      viewport,
      deviceScaleFactor: size === "phone" ? 2 : 1,
      colorScheme: scheme,
      locale: "en-GB",
      timezoneId: "Europe/Berlin",
    });
    await page.addInitScript(keepLocal);
    page.on("pageerror", (e) => problems.push(`${size} ${scheme}: ${e}`));
    page.on("console", (m) => real(m) && problems.push(`${size} ${scheme}: ${m.text()}`));
    for (const [name, path] of PAGES) {
      await page.goto(base + path, { waitUntil: "networkidle" });
      await page.waitForSelector(".bx-tabs");
      await page.evaluate(() => window.bearing?.pause());
      if (name === "search") await page.locator(".bx-pal-inp input").fill("vit");
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${out}/${name}-${size}-${scheme}.png`, fullPage: true });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      if (overflow) problems.push(`${name} ${size} ${scheme}: scrolls sideways`);
    }
    await page.close();
  }
}

// The narrowest width that must work.
const narrow = await browser.newPage({ viewport: { width: 320, height: 700 } });
await narrow.addInitScript(keepLocal);
for (const [name, path] of PAGES) {
  await narrow.goto(base + path, { waitUntil: "networkidle" });
  await narrow.waitForSelector(".bx-tabs");
  await narrow.evaluate(() => document.fonts.ready);
  const overflow = await narrow.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  if (overflow) problems.push(`${name} at 320: scrolls sideways`);
}
console.log(`${PAGES.length} screens, 2 sizes, 2 modes -> ${out}`);
console.log(problems.length ? "PROBLEMS\n" + [...new Set(problems)].join("\n") : "no problems");
await browser.close();
