// Checks accounts end to end (vp dev on :5810 with Convex and Clerk configured): signing in,
// follows made on the device being carried into the account, a change reaching a second browser,
// and signing out. It needs a Clerk test user, given through the environment and never written
// down in the repository:
//
//   BEARING_TEST_EMAIL=...+clerk_test@example.com BEARING_TEST_PASSWORD=... node scripts/app-account.mjs
//
// An address containing "+clerk_test" is a Clerk test address: its verification code is 424242.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? ".local/account";
const base = "http://localhost:5810";
const email = process.env.BEARING_TEST_EMAIL;
const password = process.env.BEARING_TEST_PASSWORD;
if (!email || !password) {
  console.error("Set BEARING_TEST_EMAIL and BEARING_TEST_PASSWORD.");
  process.exit(2);
}
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "ok  " : "FAIL"} ${name} ${detail}`);

async function open(colorScheme = "light") {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "en-GB",
    timezoneId: "Europe/Berlin",
    colorScheme,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { page, errors };
}

async function go(page, path) {
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".bx-nav");
  await page.waitForTimeout(600);
}

const sorted = (names) => [...names].sort((x, y) => x.localeCompare(y));
const sameNames = (one, two) => JSON.stringify(sorted(one)) === JSON.stringify(sorted(two));

/** The names on the Following screen, in order. */
const following = async (page) => {
  await go(page, "/following");
  await page.waitForTimeout(1200);
  return page.locator(".bx-result b").allTextContents();
};

async function signIn(page, shot) {
  await go(page, "/settings");
  await page.getByRole("button", { name: "Sign in or create an account" }).click();
  const identifier = page.locator('input[name="identifier"]');
  await identifier.waitFor({ timeout: 20_000 });
  await page.waitForTimeout(800);
  if (shot) await page.screenshot({ path: `${out}/${shot}.png` });
  await identifier.fill(email);
  await identifier.press("Enter");
  const pass = page.locator('input[name="password"]');
  await pass.waitFor({ timeout: 20_000 });
  await pass.fill(password);
  await pass.press("Enter");
  // A new device may be asked for a code; a test address always accepts this one.
  const code = page.locator('input[autocomplete="one-time-code"], input[name="code"]').first();
  const signedIn = page.getByRole("button", { name: "Sign out" });
  await Promise.race([
    code.waitFor({ timeout: 25_000 }).catch(() => {}),
    signedIn.waitFor({ timeout: 25_000 }).catch(() => {}),
  ]);
  if (!(await signedIn.isVisible()) && (await code.isVisible())) {
    await code.click();
    await page.keyboard.type("424242", { delay: 60 });
  }
  await signedIn.waitFor({ timeout: 25_000 });
}

// One browser follows something before it has an account.
const a = await open();
await go(a.page, "/search");
await a.page.locator(".bx-field input").fill("mouz");
await a.page.waitForTimeout(500);
const star = a.page.locator(".bx-result .bx-star").first();
if ((await star.getAttribute("aria-pressed")) !== "true") await star.click();
const before = await following(a.page);
check("a follow made without an account is kept on the device", before.includes("MOUZ"));

// Signing in carries the device's follows into the account.
await signIn(a.page, "sign-in-light");
check("signed in", true);
await a.page.screenshot({ path: `${out}/settings-signed-in.png` });
const carried = await following(a.page);
check(
  "the device's follows are in the account",
  before.every((name) => carried.includes(name)),
  `${carried.length} of ${before.length}`,
);

// A change in the account reaches a second browser that has never seen this device.
const b = await open("dark");
await signIn(b.page, "sign-in-dark");
const other = await following(b.page);
check(
  "a second browser shows the same follows",
  sameNames(other, carried),
  `${other.length} and ${carried.length}`,
);
await a.page.locator(".bx-result", { hasText: "MOUZ" }).locator(".bx-star").click();
await b.page.waitForTimeout(2500);
const after = await b.page.locator(".bx-result b").allTextContents();
check("unfollowing in one browser reaches the other without a reload", !after.includes("MOUZ"));

// Signing out goes back to what the device has.
await go(a.page, "/settings");
await a.page.getByRole("button", { name: "Sign out" }).click();
// Signing out leads to Today.
await a.page.waitForURL(base + "/", { timeout: 20_000 });
await a.page.waitForTimeout(1500);
const device = await following(a.page);
check("after signing out the device's own follows are shown", device.includes("MOUZ"));
check("no errors", a.errors.length + b.errors.length === 0, [...a.errors, ...b.errors][0] ?? "");

console.log(results.join("\n"));
await browser.close();
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
