// Checks the app against its backend (vp dev on :5810 with VITE_CONVEX_URL set and
// `npx convex dev` running): the world arrives from the store, it moves without the browser
// doing anything, and two separate browsers see the same moment.
// Usage: node scripts/app-backend.mjs [out-dir]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? ".local/backend";
const base = "http://localhost:5810";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "ok  " : "FAIL"} ${name} ${detail}`);

async function open() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "en-GB",
    timezoneId: "Europe/Berlin",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".bx-card", { timeout: 30_000 });
  return { page, errors };
}

/** Everything that changes as matches are played: the lead card and the rows under it. */
const state = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll(".bx-card .bx-meta, .bx-card .bx-score, .bx-mr b, .bx-mr i")]
      .map((el) => el.textContent)
      .join(" | "),
  );

const a = await open();
check(
  "the app is on the backend, not on the browser's own sample",
  await a.page.evaluate(() => window.bearing === undefined),
);
const first = await state(a.page);
await a.page.waitForTimeout(20_000);
const later = await state(a.page);
check("the world moves by itself", first !== later);
await a.page.screenshot({ path: `${out}/today.png`, fullPage: true });

const b = await open();
await b.page.waitForTimeout(1500);
const [one, two] = await Promise.all([state(a.page), state(b.page)]);
check("two browsers see the same moment", one === two, one === two ? "" : `\n  ${one}\n  ${two}`);

await a.page.goto(base + "/tournament/cs2-copenhagen-masters-2026", {
  waitUntil: "domcontentloaded",
});
await a.page.waitForSelector(".bx-bracket");
await a.page.screenshot({ path: `${out}/event.png`, fullPage: true });
check(
  "no errors",
  a.errors.length + b.errors.length === 0,
  [...a.errors, ...b.errors].slice(0, 2).join(" | "),
);

console.log(results.join("\n"));
await browser.close();
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
