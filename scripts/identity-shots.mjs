// Screenshots of an identity board: one PNG per section, plus a phone-width pass.
// Usage: node scripts/identity-shots.mjs docs/identity/round-4.html .local/identity4
// Sections are elements with class "route" or "sec". If the page has a typeface
// switch ([data-face] buttons), the last one is clicked once to prove it works.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [file = "docs/identity/round-1.html", out = ".local/identity"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
for (const [label, width] of [
  ["wide", 760],
  ["phone", 390],
]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(pathToFileURL(resolve(file)).href, { waitUntil: "networkidle" });
  await page.addStyleTag({
    content:
      "body{margin:16px;background:#101114;color:#e8e8ea} .id{max-width:728px;margin:0 auto;--border:#2c2e33;--muted-foreground:#9a9ca3;--foreground:#eee;--background:#101114}",
  });
  await page.waitForTimeout(900);
  const boards = await page.locator(".route, .sec").all();
  for (let i = 0; i < boards.length; i++)
    await boards[i].screenshot({ path: `${out}/${label}-${"abcdefgh"[i]}.png` });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  let face = "";
  const buttons = page.locator("button[data-face]");
  if (label === "wide" && (await buttons.count()) > 1) {
    await buttons.last().click();
    await page.waitForTimeout(500);
    face = await page.evaluate(() => getComputedStyle(document.querySelector(".board")).fontFamily);
    await boards[0].screenshot({ path: `${out}/${label}-a-altface.png` });
  }
  console.log(
    label,
    boards.length,
    "sections",
    overflow ? "HORIZONTAL OVERFLOW" : "ok",
    face ? "face after click: " + face : "",
    errors.length ? "ERRORS " + errors.join(" | ") : "",
  );
  await page.close();
}
await browser.close();
