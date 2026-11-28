// What happens on screen, and on the wire, when a tab is switched.
// Usage: node scripts/site-tabs.mjs [base]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const [base = "https://bearing.vincentmay.com"] = process.argv.slice(2);
mkdirSync(".local/look/tabs", { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 1280, height: 860 },
  colorScheme: "dark",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
});
// The first visit's question would stand where Live is; it has been answered here.
await page.addInitScript(() => localStorage.setItem("bearing.welcome.v1", "1"));
const notes = [];
page.on("pageerror", (e) => notes.push(String(e).slice(0, 200)));
let sent = 0;
let received = 0;
page.on("websocket", (ws) => {
  ws.on("framesent", () => sent++);
  ws.on("framereceived", (f) => {
    received += typeof f.payload === "string" ? f.payload.length : f.payload.byteLength;
  });
});
await page.goto(base + "/", { waitUntil: "domcontentloaded" });
await page.waitForSelector("main .bx-rows", { timeout: 30000 });
await page.waitForTimeout(2500);
for (const label of ["Schedule", "Following", "Live"]) {
  const before = { sent, received };
  await page.locator(".bx-tabs a", { hasText: label }).click();
  const seen = [];
  const start = Date.now();
  for (let i = 0; i < 12; i++) {
    const state = await page.evaluate(() => {
      const main = document.querySelector("main");
      return [
        document.querySelector(".bx-wt") ? "SKELETON" : "",
        `mains:${document.querySelectorAll("main").length}`,
        main?.firstElementChild?.className.slice(0, 18) ?? "none",
        `h1:${document.querySelector("h1")?.textContent ?? ""}`,
      ]
        .filter(Boolean)
        .join(" ");
    });
    if (seen.at(-1)?.state !== state) seen.push({ at: Date.now() - start, state });
    if (i === 1) await page.screenshot({ path: `.local/look/tabs/${label}-early.png` });
    await page.waitForTimeout(45);
  }
  console.log(
    label,
    seen.map((s) => `${s.at}ms[${s.state}]`).join(" -> "),
    `| ws sent ${sent - before.sent}, received ${((received - before.received) / 1024).toFixed(0)}KB`,
  );
}
console.log(notes.length ? notes.join("\n") : "no errors");
await browser.close();
