// What a load of the live site costs: when things appear, and what is transferred.
// Usage: node scripts/site-load.mjs [path] [base]
import { chromium } from "@playwright/test";
const [path = "/", base = "https://bearing.vincentmay.com"] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 1280, height: 860 },
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
});
for (const run of ["cold", "warm"]) {
  const page = await context.newPage();
  const sizes = {};
  let socket = 0;
  let frames = 0;
  const biggest = [];
  page.on("response", async (response) => {
    const type = response.request().resourceType();
    const length = Number(response.headers()["content-length"] ?? 0);
    sizes[type] = (sizes[type] ?? 0) + length;
    if (length > 60_000)
      biggest.push(`${(length / 1024).toFixed(0)}KB ${response.url().slice(0, 90)}`);
  });
  page.on("websocket", (ws) => {
    ws.on("framereceived", (frame) => {
      socket += typeof frame.payload === "string" ? frame.payload.length : frame.payload.byteLength;
      frames++;
    });
  });
  const start = Date.now();
  const marks = {};
  await page.goto(base + path, { waitUntil: "commit" });
  marks.commit = Date.now() - start;
  await page.waitForSelector(".bx-tabs", { timeout: 60000 });
  marks.frame = Date.now() - start;
  await page.waitForSelector(".bx-wait", { timeout: 2000 }).then(
    () => (marks.skeleton = Date.now() - start),
    () => {},
  );
  await page.waitForSelector("main .bx-list, main .bx-hero, main .bx-entity", { timeout: 60000 });
  marks.content = Date.now() - start;
  await page.waitForTimeout(2500);
  const paint = await page.evaluate(() =>
    Object.fromEntries(
      performance.getEntriesByType("paint").map((p) => [p.name, Math.round(p.startTime)]),
    ),
  );
  console.log(run, path, JSON.stringify(marks), JSON.stringify(paint));
  console.log(
    "  transferred:",
    Object.entries(sizes)
      .map(([k, v]) => `${k} ${(v / 1024).toFixed(0)}KB`)
      .join(", "),
    `| websocket ${(socket / 1024).toFixed(0)}KB in ${frames} frames`,
  );
  if (run === "cold") console.log("  largest:", biggest.join(" | "));
  await page.close();
}
await browser.close();
