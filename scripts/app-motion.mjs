// Checks that the live behaviour works in the running app (vp dev on :5810): the score in the
// top card ticks when something is won, the next match takes its place when one ends, and
// nothing animates when the device asks for reduced motion.
// Usage: node scripts/app-motion.mjs [out-dir]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? ".local/motion";
const base = "http://localhost:5810";
mkdirSync(out, { recursive: true });
// These checks drive the sample by hand, so they keep the app on the sample in the browser even
// when a backend is configured.
const keepLocal = () => localStorage.setItem("bearing.source", "local");
const browser = await chromium.launch({ channel: "chrome" });
// Without a backend configured, React Query says "No queryFn" for the queries the sample does
// not need; that is this machine's setup, not something the page did.
const real = (m) => m.type() === "error" && !m.text().includes("No queryFn");
const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "ok  " : "FAIL"} ${name} ${detail}`);

async function open(options = {}) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    locale: "en-GB",
    timezoneId: "Europe/Berlin",
    ...options,
  });
  await page.addInitScript(keepLocal);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => real(m) && errors.push(m.text()));
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.waitForSelector(".bx-stage");
  await page.evaluate(() => window.bearing.pause());
  return { page, errors };
}

/** Step the sample until `test` is true in the page, at most `limit` beats. */
async function until(page, test, limit = 400) {
  for (let i = 0; i < limit; i++) {
    if (await page.evaluate(test)) return i;
    await page.evaluate(() => window.bearing.step());
    await page.waitForTimeout(30);
  }
  return -1;
}

// 1. On load nothing has just landed or ticked.
{
  const { page, errors } = await open();
  const fresh = await page.locator(".bx-stage .bx-tick").count();
  check("nothing animates in on first load", fresh === 0, `(${fresh} found)`);

  // 2. A round is won: the changed number in the top card ticks.
  const SCORE = ".bx-stage .bx-fig b, .bx-stage .bx-cduel > b";
  const before = await page.locator(SCORE).first().innerText();
  await page.evaluate(
    ([b, sel]) => ((window.__before = b), (window.__score = sel)),
    [before, SCORE],
  );
  const beats = await until(
    page,
    () => document.querySelector(window.__score).innerText !== window.__before,
  );
  const ticked = await page.locator(".bx-stage .bx-tick").count();
  check("a round was won in the match in front", beats >= 0, `after ${beats} beats`);
  check("the changed number ticks", ticked === 1, `(${ticked})`);
  await page.screenshot({ path: `${out}/landed.png` });

  // 3. The match ends: it says so, then the next one takes its place.
  const way = ".bx-stage a.bx-btn[href^='/match/']";
  const first = await page.locator(way).first().getAttribute("href");
  const ended = await until(
    page,
    () => document.querySelector(".bx-stage .bx-tag")?.textContent === "Final",
  );
  check("the match in front ends and says so", ended >= 0, `after ${ended} more beats`);
  check(
    "it is still the same match for a moment",
    (await page.locator(way).first().getAttribute("href")) === first,
  );
  await page.screenshot({ path: `${out}/ended.png` });
  await page.waitForTimeout(4200);
  const second = await page.locator(way).first().getAttribute("href");
  check("the next match takes its place", second !== first, `${first} -> ${second}`);
  check(
    "the finished match is now under Results",
    (await page.locator(`.bx-rw a.bx-rw-go[href="${first}"]`).count()) === 1,
  );
  await page.screenshot({ path: `${out}/stepped.png`, fullPage: true });

  // 4. Everything can be played to the end without an error.
  await page.evaluate(() => window.bearing.step(3000));
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${out}/all-over.png`, fullPage: true });
  check(
    "nothing is live once everything has been played",
    (await page.locator(".bx-ping").count()) === 0,
  );
  check("no errors while playing", errors.length === 0, errors.slice(0, 2).join(" | "));
  await page.close();
}

// 5. The match page of every game, played forward, at phone and wide width.
for (const [name, path] of [
  ["cs2", "/match/cs2-copenhagen-masters-2026-po-sf2"],
  ["lol", "/match/lol-rift-invitational-2026-sf1"],
  ["rl", "/match/rl-winter-open-2026-final"],
  ["chess", "/match/chess-fall-classic-2026-r6-b1"],
  ["tm", "/match/tm-cup-finals-2026-qf-A"],
]) {
  for (const { size, viewport } of [
    { size: "phone", viewport: { width: 390, height: 844 } },
    { size: "wide", viewport: { width: 1440, height: 900 } },
  ]) {
    const { page, errors } = await open({ viewport });
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.evaluate(() => window.bearing.pause());
    await page.evaluate(() => window.bearing.step(25));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${name}-${size}-later.png`, fullPage: true });
    await page.evaluate(() => window.bearing.step(3000));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${name}-${size}-over.png`, fullPage: true });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    check(`${name} ${size} plays to the end`, errors.length === 0 && !overflow, errors[0] ?? "");
    await page.close();
  }
}

// 6. Reduced motion: no loop runs and nothing animates in.
{
  const { page } = await open({ reducedMotion: "reduce" });
  const names = await page.evaluate(() =>
    [...document.querySelectorAll(".bx *")]
      .flatMap((el) => [getComputedStyle(el), getComputedStyle(el, "::after")])
      .map((s) => s.animationName)
      .filter((n) => n && n !== "none"),
  );
  check("reduced motion: nothing animates", names.length === 0, names.slice(0, 3).join(","));
  await page.close();
}

console.log(results.join("\n"));
await browser.close();
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
