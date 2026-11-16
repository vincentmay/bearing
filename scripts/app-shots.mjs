// Screenshots of the Bearing screens in the running app (vp dev on :5810), light and dark,
// at phone width. Usage: node scripts/app-shots.mjs [out-dir]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? ".local/app";
const base = "http://localhost:5810";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const errors = [];
for (const scheme of ["light", "dark"]) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: scheme,
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.waitForSelector(".bx-card");
  await page.screenshot({ path: `${out}/today-${scheme}.png`, fullPage: true });
  if (scheme === "light") {
    await page.locator(".bx-card").first().click();
    await page.waitForSelector(".bx-big");
    await page.screenshot({ path: `${out}/match-live.png`, fullPage: true });
    console.log("match page:", new URL(page.url()).pathname);
    for (const [label, name] of [
      ["Schedule", "schedule"],
      ["Following", "following"],
      ["Search", "search"],
    ]) {
      await page.locator(`.bx-nav a[aria-label="${label}"]`).click();
      await page.waitForTimeout(500);
      if (name === "search") await page.locator(".bx-field input").fill("vit");
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    }
    // One match of every game, to check each discipline's page.
    await page.goto(base + "/", { waitUntil: "networkidle" });
    const links = await page
      .locator('a[href^="/match/"]')
      .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    console.log("match links on Today:", links.length);
    let i = 0;
    for (const href of [...new Set(links)].slice(0, 8)) {
      await page.goto(base + href, { waitUntil: "networkidle" });
      await page.screenshot({ path: `${out}/match-${i++}.png`, fullPage: true });
    }
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  console.log(scheme, overflow ? "HORIZONTAL OVERFLOW" : "no overflow");
  await page.close();
}
console.log(errors.length ? "ERRORS " + [...new Set(errors)].join(" | ") : "no errors");
await browser.close();
