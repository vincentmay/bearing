// Every feature of the live site, used the way a person would, each with a check that it did
// what it should. Usage: node scripts/site-features.mjs [base]
import { chromium } from "@playwright/test";
const base = process.argv[2] ?? "https://bearing.vincentmay.com";
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 1280, height: 860 },
  colorScheme: "dark",
  locale: "en-GB",
  timezoneId: "Europe/Berlin",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
});
const page = await context.newPage();
const thrown = [];
page.on("pageerror", (e) => thrown.push(String(e).slice(0, 200)));
const results = [];
const step = async (name, run) => {
  try {
    const note = await run();
    results.push(`ok    ${name}${note ? ` (${note})` : ""}`);
  } catch (error) {
    results.push(
      `FAIL  ${name}: ${String(error.message ?? error)
        .split("\n")[0]
        .slice(0, 160)}`,
    );
  }
};
const expect = (ok, what) => {
  if (!ok) throw new Error(what);
};
const open = async (path) => {
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".bx-nav", { timeout: 30000 });
  await page.waitForTimeout(1800);
};
const tab = (label) => page.locator(`.bx-nav a[title="${label}"]`).click();
const text = () => page.locator("main").innerText();

await open("/");
await step("today shows a lead match and lists", async () => {
  expect((await page.locator("main .bx-list").count()) >= 2, "fewer than two lists");
});

await step("schedule: a week later and back to today", async () => {
  await tab("Schedule");
  await page.waitForTimeout(300);
  const first = await page.locator(".bx-days button").first().getAttribute("aria-label");
  await page.locator('button[aria-label="A week later"]').click();
  await page.waitForTimeout(200);
  const moved = await page.locator(".bx-days button").first().getAttribute("aria-label");
  expect(first !== moved, "the strip did not move");
  await page.locator(".bx-pill", { hasText: "Today" }).click();
  await page.waitForTimeout(200);
  expect(
    (await page.locator(".bx-days [data-today][aria-pressed=true]").count()) === 1,
    "today is not chosen",
  );
});
await step("schedule: choose another day, and what I follow", async () => {
  await page.locator(".bx-days button[data-busy]").last().click();
  await page.waitForTimeout(200);
  const heading = await page.locator(".bx-dayname").innerText();
  await page.locator(".bx-seg button", { hasText: "What I follow" }).click();
  await page.waitForTimeout(200);
  expect(/Nothing you follow|matches? in/.test(await text()), "no answer for what I follow");
  await page.locator(".bx-seg button", { hasText: "Everything" }).click();
  return heading.replace(/\n/g, " ");
});

await step("search: find a team, open it, follow it", async () => {
  await tab("Search");
  await page.waitForTimeout(300);
  await page.locator('input[type="search"]').fill("fnatic");
  await page.waitForTimeout(500);
  const row = page.locator('main a[href^="/team/"]').first();
  expect((await row.count()) > 0, "no team found for fnatic");
  await row.click();
  await page.waitForTimeout(700);
  expect(/fnatic/i.test(await page.locator("h1").innerText()), "the team page did not open");
  await page.locator(".bx-entity .bx-star").click();
  await page.waitForTimeout(300);
  expect(
    (await page.locator(".bx-entity .bx-star").getAttribute("aria-pressed")) === "true",
    "the star did not take",
  );
});
await step("following lists what was followed, and today becomes personal", async () => {
  await tab("Following");
  await page.waitForTimeout(400);
  expect(/fnatic/i.test(await text()), "fnatic is not under Following");
  await tab("Today");
  await page.waitForTimeout(400);
  expect(!/not following anything/i.test(await text()), "today still says nothing is followed");
});
await step("a follow survives a reload", async () => {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".bx-nav");
  await page.waitForTimeout(1500);
  await tab("Following");
  await page.waitForTimeout(400);
  expect(/fnatic/i.test(await text()), "the follow was lost on reload");
});
await step("unfollow from the list", async () => {
  await page.locator("main .bx-star[aria-pressed=true]").first().click();
  await page.waitForTimeout(400);
  expect(
    /not following anything/i.test(await text()),
    "still following after the star was pressed",
  );
});

await step("search: a chess player in no event", async () => {
  await tab("Search");
  await page.locator('input[type="search"]').fill("nakamura");
  await page.waitForTimeout(2500);
  expect((await page.locator('a[href^="/player/fide-"]').count()) > 0, "no listed players");
});
await step("search: nothing found says so", async () => {
  await page.locator('input[type="search"]').fill("zzzzqqqq");
  await page.waitForTimeout(1500);
  expect(/Nothing found/i.test(await text()), "no message for an empty search");
});
await step("ranking: all sixty, and a row leads to its team", async () => {
  await page.locator('input[type="search"]').fill("");
  await page.waitForTimeout(300);
  await page.locator(".bx-more").first().click();
  await page.waitForTimeout(600);
  const rows = await page.locator(".bx-rank").count();
  expect(rows >= 50, `only ${rows} rows`);
  await page.locator("a.bx-rank").first().click();
  await page.waitForTimeout(700);
  expect(page.url().includes("/team/"), "the row did not lead to a team");
  return `${rows} rows`;
});
await step("back leads to where one came from, by name", async () => {
  const label = await page.locator(".bx-back").innerText();
  expect(/ranking/i.test(label), `back says "${label}"`);
  await page.locator(".bx-back").click();
  await page.waitForTimeout(600);
  expect(page.url().includes("/ranking/"), "back did not return to the ranking");
});

await open("/tournament/ps-serie-11014");
await step("event: stages can be switched", async () => {
  const buttons = page.locator(".bx-seg button");
  const count = await buttons.count();
  expect(count >= 2, "no stage switch");
  for (let i = 0; i < count; i++) {
    await buttons.nth(i).click();
    await page.waitForTimeout(350);
    expect((await text()).length > 200, `stage ${i} is empty`);
  }
  return `${count} stages`;
});
await step("event: pointing at a team traces it through the bracket", async () => {
  await page.locator(".bx-seg button").last().click();
  await page.waitForTimeout(400);
  await page.locator(".bx-tie-side").first().hover();
  await page.waitForTimeout(250);
  expect((await page.locator(".bx-bracket[data-tracing]").count()) > 0, "nothing was traced");
});

await open("/match/lichess-Y0JqfYP6");
await step("chess: step, jump, play, turn, pick a move, point at the graph", async () => {
  await page.waitForSelector(".bx-board", { timeout: 15000 });
  const at = () => page.locator(".bx-moves button[aria-current]").innerText();
  const end = await at();
  await page.locator('button[aria-label="One move back"]').click();
  await page.waitForTimeout(150);
  expect((await at()) !== end, "one move back did nothing");
  await page.locator('button[aria-label="To the start"]').click();
  await page.waitForTimeout(150);
  expect((await page.locator(".bx-moves button[aria-current]").count()) === 0, "not at the start");
  await page.locator(".bx-board").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(150);
  expect(
    (await page.locator(".bx-moves button[aria-current]").count()) === 1,
    "arrow keys did nothing",
  );
  await page.locator('button[aria-label="Turn the board"]').click();
  await page.waitForTimeout(150);
  const firstRank = await page.locator(".bx-board u[data-rank]").first().innerText();
  expect(firstRank === "1", `turned board starts with rank ${firstRank}`);
  await page.locator(".bx-moves button").nth(20).click();
  await page.waitForTimeout(150);
  const box = await page.locator(".bx-evalgraph").boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2);
  await page.waitForTimeout(200);
  const clocks = await page.locator(".bx-clock").allInnerTexts();
  expect(clocks.length === 2, "no clocks");
  return `clocks ${clocks.join(" / ")}`;
});

await open("/settings");
await step("settings: light and dark take effect", async () => {
  await page.locator(".bx-seg button", { hasText: "Light" }).click();
  await page.waitForTimeout(200);
  expect((await page.locator(".bx").getAttribute("data-theme")) === "light", "light did not apply");
  await page.locator(".bx-seg button", { hasText: "Dark" }).click();
  await page.waitForTimeout(200);
  expect((await page.locator(".bx").getAttribute("data-theme")) === "dark", "dark did not apply");
  await page.locator(".bx-seg button", { hasText: "As the device" }).first().click();
});
await step("settings: twelve and twenty-four hours", async () => {
  await page.locator(".bx-seg button", { hasText: "12 hours" }).click();
  await page.waitForTimeout(200);
  expect(/\d\s?(am|pm)/i.test(await text()), "no twelve-hour time");
  await page.locator(".bx-seg button", { hasText: "24 hours" }).click();
  await page.waitForTimeout(200);
  expect(!/\d\s?(am|pm)\b/i.test((await text()).split("Time zone")[0]), "still twelve-hour");
  await page.locator(".bx-seg button", { hasText: "As the device" }).nth(1).click();
});
await step("settings: another time zone moves the clock", async () => {
  const before = await text();
  await page.locator("select").selectOption("Asia/Tokyo");
  await page.waitForTimeout(300);
  expect((await text()) !== before, "the time did not change");
  await page.locator("select").selectOption("");
});
await step("account menu: opens, closes on Escape, offers sign-in", async () => {
  await page.locator(".bx-top .bx-account > button").click();
  await page.waitForTimeout(250);
  const items = await page.locator(".bx-menu [role=menuitem]").allInnerTexts();
  expect(
    items.some((i) => /Sign in/.test(i)),
    `menu has ${items.join(", ")}`,
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  expect((await page.locator(".bx-menu").count()) === 0, "Escape did not close it");
  await page.locator(".bx-top .bx-account > button").click();
  await page.locator(".bx-menu [role=menuitem]", { hasText: "Sign in" }).click();
  await page.waitForTimeout(2500);
  expect(
    (await page.locator(".cl-modalContent, .cl-signIn-root, .cl-rootBox").count()) > 0,
    "sign-in did not open",
  );
});

console.log(results.join("\n"));
console.log(thrown.length ? `thrown: ${[...new Set(thrown)].join(" ; ")}` : "nothing thrown");
await browser.close();
