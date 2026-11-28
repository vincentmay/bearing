// Screenshots of the states that are not the normal one (vp dev on :5810): waiting for data,
// could not load, nothing followed yet, nothing found, and a link that leads nowhere.
// Usage: node scripts/app-states.mjs [out-dir]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? ".local/states";
const base = "http://localhost:5810";
mkdirSync(out, { recursive: true });
// These checks drive the sample by hand, so they keep the app on the sample in the browser even
// when a backend is configured.
const keepLocal = () => localStorage.setItem("bearing.source", "local");
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: "en-GB",
  timezoneId: "Europe/Berlin",
});
await context.addInitScript(keepLocal);
const page = await context.newPage();

await page.goto(base + "/?world=slow");
await page.waitForSelector(".bx-wt");
await page.screenshot({ path: `${out}/waiting.png` });

await page.goto(base + "/?world=fail");
await page.waitForSelector(".bx-problem");
await page.screenshot({ path: `${out}/failed.png` });

await page.goto(base + "/match/no-such-match", { waitUntil: "networkidle" });
await page.waitForSelector(".bx-problem");
await page.screenshot({ path: `${out}/not-found.png` });

await page.goto(base + "/search", { waitUntil: "networkidle" });
await page.locator(".bx-pal-inp input").fill("zzzz");
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/nothing-found.png` });

// With nothing followed: stored as an empty list, which is what unfollowing everything leaves.
await page.evaluate(() => localStorage.setItem("bearing.follows.v1", "[]"));
for (const [name, path] of [
  ["today-unfollowed", "/"],
  ["following-empty", "/following"],
]) {
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForSelector(".bx-tabs");
  await page.evaluate(() => window.bearing?.pause());
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}.png` });
}
console.log(`states -> ${out}`);
await browser.close();
