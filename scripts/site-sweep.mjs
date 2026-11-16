// A sweep of the live site: every kind of page, light and dark, wide and phone. For each it
// notes what threw, what scrolls sideways, pictures that did not arrive, controls without a
// name, and pages that say they could not be found. Then it follows every internal link once.
// Usage: node scripts/site-sweep.mjs [base] [--shots]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const base = process.argv[2]?.startsWith("http")
  ? process.argv[2]
  : "https://bearing.vincentmay.com";
const shots = process.argv.includes("--shots");
mkdirSync(".local/sweep", { recursive: true });
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const PAGES = [
  ["today", "/"],
  ["schedule", "/schedule"],
  ["following", "/following"],
  ["search", "/search"],
  ["settings", "/settings"],
  ["ranking", "/ranking/cs2"],
  ["event-single", "/tournament/ps-serie-11014"],
  ["event-double", "/tournament/ps-serie-11189"],
  ["event-chess", "/tournament/lichess-E2Ux0N0V"],
  ["event-rl", "/tournament/ps-serie-10903"],
  ["match-lol", "/match/ps-match-1711021"],
  ["match-cs", "/match/ps-match-1762449"],
  ["match-chess", "/match/lichess-Y0JqfYP6"],
  ["team-lol", "/team/ps-team-1566"],
  ["team-cs", "/team/ps-team-124530"],
  ["player-lol", "/player/ps-player-585"],
  ["player-listed", "/player/fide-2016192"],
  ["nowhere", "/nothing/here"],
  ["match-none", "/match/does-not-exist"],
];
const MODES = [
  { mode: "wide-dark", viewport: { width: 1280, height: 860 }, scheme: "dark", scale: 1 },
  { mode: "wide-light", viewport: { width: 1280, height: 860 }, scheme: "light", scale: 1 },
  { mode: "phone-dark", viewport: { width: 390, height: 844 }, scheme: "dark", scale: 2 },
  { mode: "phone-light", viewport: { width: 390, height: 844 }, scheme: "light", scale: 2 },
];
const browser = await chromium.launch({ channel: "chrome" });
const links = new Set();
const findings = [];
for (const { mode, viewport, scheme, scale } of MODES) {
  const context = await browser.newContext({
    viewport,
    colorScheme: scheme,
    deviceScaleFactor: scale,
    userAgent: UA,
    locale: "en-GB",
    timezoneId: "Europe/Berlin",
  });
  for (const [name, path] of PAGES) {
    const page = await context.newPage();
    const thrown = [];
    page.on("pageerror", (e) => thrown.push(String(e).slice(0, 160)));
    page.on("console", (m) => {
      if (m.type() === "error" && !/Failed to load resource/.test(m.text()))
        thrown.push("console: " + m.text().slice(0, 160));
    });
    await page.goto(base + path, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".bx-nav, .bx-problem, main", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2600);
    const report = await page.evaluate(() => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const text = document.querySelector("main")?.innerText ?? "";
      return {
        sideways: document.documentElement.scrollWidth > innerWidth + 1,
        pictures: [...document.images]
          .filter((img) => visible(img) && img.complete && img.naturalWidth === 0)
          .map((img) => img.src.slice(0, 80)),
        unnamed: [...document.querySelectorAll("button, a[href], input, select")]
          .filter(
            (el) =>
              visible(el) &&
              // What is folded away has no text to show; what it says when open is what counts.
              !(el.textContent || "").trim() &&
              !el.getAttribute("aria-label") &&
              !el.getAttribute("title") &&
              !el.closest("label"),
          )
          .map((el) => el.outerHTML.slice(0, 90)),
        notFound: /could not be found|nothing at this address/i.test(text),
        waiting: !!document.querySelector(".bx-wait"),
        empty: [...document.querySelectorAll(".bx-empty")].map((el) => el.innerText.slice(0, 70)),
        links: [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute("href")),
        length: text.length,
      };
    });
    for (const href of report.links) links.add(href);
    const said = [];
    if (thrown.length) said.push(`THREW ${[...new Set(thrown)].join(" ; ")}`);
    if (report.sideways) said.push("scrolls sideways");
    if (report.pictures.length)
      said.push(`${report.pictures.length} pictures missing: ${report.pictures[0]}`);
    if (report.unnamed.length)
      said.push(`${report.unnamed.length} unnamed controls: ${report.unnamed[0]}`);
    if (report.waiting) said.push("still waiting after 2.6 s");
    if (report.notFound && !/none|nowhere/.test(name)) said.push("says NOT FOUND");
    if (report.length < 80) said.push(`almost empty (${report.length} characters)`);
    if (said.length) findings.push(`${mode} ${name}: ${said.join(" | ")}`);
    if (shots && (mode === "wide-light" || mode === "phone-dark"))
      await page.screenshot({
        path: `.local/sweep/${mode}-${name}.png`,
        fullPage: mode === "wide-light",
      });
    await page.close();
  }
  await context.close();
}
console.log(findings.length ? findings.join("\n") : "pages: nothing found");

// Every internal link seen, followed once.
const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, userAgent: UA });
const page = await context.newPage();
const broken = [];
const list = [...links].filter((href) => !PAGES.some(([, p]) => p === href)).slice(0, 220);
await page.goto(base + "/", { waitUntil: "domcontentloaded" });
await page.waitForSelector(".bx-nav", { timeout: 30000 });
for (const href of list) {
  // Moved to within the app, as a press on the link would: no reload.
  await page.evaluate((to) => {
    history.pushState({}, "", to);
    dispatchEvent(new PopStateEvent("popstate"));
  }, href);
  await page.waitForTimeout(350);
  // A page that asks for something of its own (an older match) is given the time to get it.
  await page.waitForSelector(".bx-wait", { state: "detached", timeout: 5000 }).catch(() => {});
  const state = await page.evaluate(() => {
    const text = document.querySelector("main")?.innerText ?? "";
    return {
      notFound: /could not be found|nothing at this address/i.test(text),
      length: text.length,
    };
  });
  if (state.notFound || state.length < 60)
    broken.push(`${href} (${state.notFound ? "not found" : "empty"})`);
}
console.log(`links: ${list.length} followed, ${broken.length} broken`);
if (broken.length) console.log(broken.slice(0, 30).join("\n"));
await browser.close();
