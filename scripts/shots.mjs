// Review screenshots: node scripts/shots.mjs <outDir> <path...>
// Env: WIDTHS=1440,390  WAIT=ms  FULL=1 (full page)
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const [outDir, ...paths] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const widths = (process.env.WIDTHS ?? "1440,390").split(",").map(Number);
const base = process.env.BASE ?? "http://localhost:5810";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-gl=angle", "--use-angle=d3d11", "--ignore-gpu-blocklist"],
});
for (const p of paths) {
  for (const w of widths) {
    const page = await browser.newPage({
      viewport: { width: w, height: w < 600 ? 844 : 900 },
      deviceScaleFactor: w < 600 ? 2 : 1,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(base + p, { waitUntil: "networkidle" });
    await page.waitForTimeout(Number(process.env.WAIT ?? 2500));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    const name = `${p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root"}-${w}.png`;
    await page.screenshot({ path: path.join(outDir, name), fullPage: !!process.env.FULL });
    console.log(
      name,
      overflow > 0 ? `HORIZONTAL OVERFLOW ${overflow}px` : "ok",
      errors.length ? `ERRORS: ${errors.join(" | ")}` : "",
    );
    await page.close();
  }
}
await browser.close();
