// Moving between the parts of one event (group stage, semifinals, final) must change what the
// page shows without replacing the page: the same page element, the scroll where it was, the
// row of parts where it was, and "back" leading out of the event.
// Usage: node scripts/site-parts.mjs [base] [path]
import { chromium } from "@playwright/test";
const base = process.argv[2]?.startsWith("http")
  ? process.argv[2]
  : "https://bearing.vincentmay.com";
const path = process.argv.find((a) => a.startsWith("/")) ?? "/tournament/lichess-qEXour3L";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, userAgent: UA });
const thrown = [];
page.on("pageerror", (e) => thrown.push(String(e).slice(0, 160)));
await page.goto(base + "/", { waitUntil: "domcontentloaded" });
await page.waitForSelector(".bx-tabs");
await page.evaluate((to) => {
  history.pushState({}, "", to);
  dispatchEvent(new PopStateEvent("popstate"));
}, path);
await page.waitForSelector("nav.bx-e-picks a");
await page.waitForTimeout(1500);
await page.evaluate(() => {
  document.querySelector("main").dataset.same = "yes";
  scrollTo(0, 240);
});
const parts = await page.locator("nav.bx-e-picks a").count();
let bad = 0;
// Where the page was scrolled to before each move; a shorter part may not reach that far.
let held = 240;
for (let i = 0; i < parts; i++) {
  const before = await page.locator("h1").innerText();
  const requests = [];
  const note = (r) => requests.push(r.url());
  page.on("request", note);
  const t0 = Date.now();
  await page.locator("nav.bx-e-picks a").nth(i).click();
  await page.waitForFunction(
    (n) =>
      document.querySelectorAll("nav.bx-e-picks a")[n]?.getAttribute("aria-current") === "page",
    i,
  );
  const took = Date.now() - t0;
  await page.waitForTimeout(400);
  page.off("request", note);
  const state = await page.evaluate(() => ({
    same: document.querySelector("main").dataset.same === "yes",
    scroll: Math.round(scrollY),
    waiting: !!document.querySelector(".bx-wt"),
    reach: Math.max(0, Math.round(document.documentElement.scrollHeight - innerHeight)),
    title: document.querySelector("h1")?.innerText,
    length: document.querySelector("main").innerText.length,
  }));
  const ok =
    state.same && Math.abs(state.scroll - Math.min(held, state.reach)) <= 2 && state.length > 200;
  held = state.scroll;
  if (!ok) bad++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${state.title?.split(": ").slice(1).join(": ").padEnd(24)} ${String(took).padStart(4)} ms` +
      `  same page: ${state.same}  scroll: ${state.scroll}  waiting: ${state.waiting}  fetched: ${requests.filter((u) => !u.includes("flagcdn") && !/\.(png|jpe?g|webp|svg)(\?|$)/.test(u)).length}` +
      (before === state.title ? "  (already here)" : ""),
  );
}
await page.goBack();
await page.waitForTimeout(500);
const after = await page.evaluate(() => location.pathname);
console.log(
  `back leads to ${after} ${after === "/" ? "(out of the event)" : "(still inside the event)"}`,
);
console.log(thrown.length ? thrown.join("\n") : "nothing thrown");
console.log(bad || after !== "/" ? "FAILED" : "all parts ok");
await browser.close();
