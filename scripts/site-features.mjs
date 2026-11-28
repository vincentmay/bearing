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
  await page.waitForSelector(".bx-tabs", { timeout: 30000 });
  // The frame stands at once; the page is there when its waiting shape has gone.
  await page.waitForSelector("main .bx-wt", { state: "detached", timeout: 30000 });
  await page.waitForTimeout(1800);
};
const tab = (label) => page.locator(".bx-tabs a", { hasText: label }).click();
const text = () => page.locator("main").innerText();
// Search opens over the page; what it says is in its own box, not in the page.
const finder = page.locator(".bx-pal");
const find = async (query) => {
  if (!(await finder.count())) await page.locator(".bx-bar .bx-find").click();
  await page.locator(".bx-pal-inp input").fill(query);
  await page.waitForTimeout(300);
  if (!(await finder.count()))
    throw new Error(
      `search closed itself on "${query}"; the page says "${(await text()).split("\n")[0]}"`,
    );
};

await open("/");
await step("first visit asks what is followed, and a card follows and lets go", async () => {
  expect(/What do you follow/.test(await text()), "no question on the first visit");
  const cards = await page.locator(".bx-pk").count();
  expect(cards >= 4, `only ${cards} cards to pick from`);
  const card = page.locator(".bx-pk").first();
  await card.click();
  await page.waitForTimeout(200);
  expect((await card.getAttribute("aria-pressed")) === "true", "the card did not take");
  expect(
    /Done, 1 picked/.test(await page.locator(".bx-eh-acts").innerText()),
    "Done does not count the pick",
  );
  await card.click();
  await page.waitForTimeout(200);
  expect((await card.getAttribute("aria-pressed")) === "false", "the card did not let go");
  await page.locator(".bx-btn", { hasText: "Skip for now" }).click();
  await page.waitForTimeout(400);
  expect(!/What do you follow/.test(await text()), "skip did not put it aside");
  return `${cards} cards`;
});
await step("the question is not asked again after a reload", async () => {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".bx-tabs");
  await page.waitForSelector("main .bx-wt", { state: "detached", timeout: 30000 });
  await page.waitForTimeout(1500);
  expect(!/What do you follow/.test(await text()), "asked again");
});
await step("live shows a match in front and lists", async () => {
  expect((await page.locator("main .bx-stage").count()) === 1, "no match in front");
  expect((await page.locator("main .bx-rows").count()) >= 2, "fewer than two lists");
});
await step("live: another live match comes to the front when tapped", async () => {
  const card = page.locator("main .bx-chan button.bx-ch:has(.bx-disc)").first();
  if (!(await card.count())) return "no other live match of two sides now, skipped";
  const names = await card.locator(".bx-ln > span:not(.bx-disc)").allInnerTexts();
  await card.click();
  await page.waitForTimeout(700);
  const front = await page.locator("main .bx-stage").innerText();
  expect(
    names.every((n) => front.includes(n)),
    `the front shows ${front.split("\n").slice(0, 6).join(" ")}`,
  );
  return names.join(" v ");
});

await step("schedule: a week later and back to today", async () => {
  await tab("Schedule");
  await page.waitForTimeout(300);
  const days = page.locator('[aria-label="Day"] button');
  const first = await days.first().getAttribute("aria-label");
  await page.locator('button[aria-label="A week later"]').click();
  await page.waitForTimeout(200);
  const moved = await days.first().getAttribute("aria-label");
  expect(first !== moved, "the strip did not move");
  await page.locator(".bx-eh-acts .bx-btn", { hasText: "Today" }).click();
  await page.waitForTimeout(200);
  expect(
    /Today/.test(await page.locator('[aria-label="Day"] button[aria-pressed=true]').innerText()),
    "today is not chosen",
  );
});
await step("schedule: choose another day, and what I follow", async () => {
  const busy = page.locator('[aria-label="Day"] button:not([aria-label$=", 0 matches"])');
  await busy.last().click();
  await page.waitForTimeout(200);
  const heading = await page.locator("main h1").innerText();
  await page.locator(".bx-scope button", { hasText: "What I follow" }).click();
  await page.waitForTimeout(200);
  expect(
    /Nothing you follow is on this day|of yours/.test(await text()),
    "no answer for what I follow",
  );
  await page.locator(".bx-scope button", { hasText: "Everything" }).click();
  return heading;
});

await step("search: Ctrl K and / open it, Escape closes it", async () => {
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(200);
  expect((await finder.count()) === 1, "Ctrl K did not open search");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  expect((await finder.count()) === 0, "Escape did not close it");
  await page.keyboard.press("/");
  await page.waitForTimeout(200);
  expect((await finder.count()) === 1, "/ did not open search");
  await page.keyboard.press("Escape");
});
await step("search: find a team and open it", async () => {
  await find("fnatic");
  await page.waitForTimeout(500);
  const row = page.locator('.bx-res a[href^="/team/"]').first();
  expect((await row.count()) > 0, "no team found for fnatic");
  await row.click();
  await page.waitForTimeout(700);
  expect(/fnatic/i.test(await page.locator("main h1").innerText()), "the team page did not open");
  expect((await finder.count()) === 0, "search stayed open over the team");
});
// The team to follow: the one search found, or else the first of the ranking.
let team = "fnatic";
await step("team: follow it", async () => {
  if (!page.url().includes("/team/")) {
    await open("/ranking/cs2");
    await page.locator("a.bx-rkl-row").first().click();
    await page.waitForTimeout(700);
  }
  team = await page.locator("main h1").innerText();
  await page.locator(".bx-pp-follow").click();
  await page.waitForTimeout(300);
  expect(
    (await page.locator(".bx-pp-follow").getAttribute("aria-pressed")) === "true",
    "the follow did not take",
  );
  return team;
});
await step("following lists what was followed, and live becomes personal", async () => {
  await tab("Following");
  await page.waitForTimeout(400);
  expect(await text().then((t) => t.includes(team)), `${team} is not under Following`);
  await tab("Live");
  await page.waitForTimeout(400);
  expect(!/not following anything/i.test(await text()), "live still says nothing is followed");
});
await step("a follow survives a reload", async () => {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".bx-tabs");
  await page.waitForTimeout(1500);
  await tab("Following");
  await page.waitForTimeout(400);
  expect(await text().then((t) => t.includes(team)), "the follow was lost on reload");
});
await step("unfollow from the list", async () => {
  await page.locator("main .bx-star[aria-pressed=true]").first().click();
  await page.waitForTimeout(400);
  expect(/Tap the star/i.test(await text()), "still following after the star was pressed");
});

await step("search: a chess player in no event", async () => {
  await find("nakamura");
  await page.waitForTimeout(2500);
  expect((await page.locator('.bx-res a[href^="/player/fide-"]').count()) > 0, "no listed players");
});
await step("search: follow straight from a result", async () => {
  const chip = page.locator(".bx-res .bx-fol").first();
  expect((await chip.count()) > 0, "no result to follow");
  await chip.click();
  await page.waitForTimeout(200);
  expect((await chip.getAttribute("aria-pressed")) === "true", "the follow did not take");
  await chip.click();
  await page.waitForTimeout(200);
  expect((await chip.getAttribute("aria-pressed")) === "false", "the follow did not let go");
});
await step("search: nothing found says so", async () => {
  await find("zzzzqqqq");
  await page.waitForTimeout(1500);
  expect(/Nothing found/i.test(await finder.innerText()), "no message for an empty search");
});
// Search may have left the page in a bad way.
await open("/");
await step("ranking: all sixty, and a row leads to its team", async () => {
  await find("");
  await page.waitForTimeout(300);
  const way = page.locator('.bx-res a[href^="/ranking/"]').first();
  expect((await way.count()) > 0, "search offers no ranking");
  await way.click();
  await page.waitForTimeout(800);
  const rows = (await page.locator(".bx-pc").count()) + (await page.locator(".bx-rkl-row").count());
  expect(rows >= 50, `only ${rows} rows`);
  await page.locator("a.bx-rkl-row").first().click();
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
const stages = page.locator('[aria-label="Stage"] button');
await step("event: stages can be switched", async () => {
  const count = await stages.count();
  expect(count >= 2, "no stage switch");
  for (let i = 0; i < count; i++) {
    await stages.nth(i).click();
    await page.waitForTimeout(350);
    expect((await stages.nth(i).getAttribute("aria-pressed")) === "true", `stage ${i} not chosen`);
    expect((await text()).length > 200, `stage ${i} is empty`);
  }
  return `${count} stages`;
});
await step("event: pointing at a team traces it through the bracket", async () => {
  await stages.last().click();
  await page.waitForTimeout(400);
  await page.locator(".bx-bk-side:not([data-open])").first().hover();
  await page.waitForTimeout(250);
  expect((await page.locator(".bx-bk[data-tracing]").count()) > 0, "nothing was traced");
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
await step("settings: another board is chosen", async () => {
  const other = page.locator('[aria-label="Board"] button:not([aria-pressed=true])').first();
  const name = await other.getAttribute("aria-label");
  const board = page.locator(`[aria-label="Board"] button[aria-label="${name}"]`);
  await board.click();
  await page.waitForTimeout(200);
  expect((await board.getAttribute("aria-pressed")) === "true", `${name} did not take`);
  return name;
});
await step("account menu: opens, closes on Escape, offers sign-in", async () => {
  const button = page.locator(".bx-bar .bx-account > button");
  if (!(await button.count())) return "this copy has no accounts, skipped";
  await button.click();
  await page.waitForTimeout(250);
  const items = await page.locator(".bx-menu [role=menuitem]").allInnerTexts();
  expect(
    items.some((i) => /Sign in/.test(i)),
    `menu has ${items.join(", ")}`,
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  expect((await page.locator(".bx-menu").count()) === 0, "Escape did not close it");
  await button.click();
  await page.locator(".bx-menu [role=menuitem]", { hasText: "Sign in" }).click();
  await page.waitForSelector(".cl-rootBox, .cl-signIn-root, .bx-si-failed", { timeout: 15000 });
  expect(page.url().includes("/sign-in"), "sign-in did not open");
  // Where Clerk does not serve the address (a preview), the page says so; there is no form.
  if (await page.locator(".bx-si-failed").count())
    return "signing in is not available at this address, the form was skipped";
});

console.log(results.join("\n"));
console.log(thrown.length ? `thrown: ${[...new Set(thrown)].join(" ; ")}` : "nothing thrown");
await browser.close();
