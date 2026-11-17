// How far behind Lichess the page of a chess game being played is. It finds a broadcast round
// under way, opens Bearing's page of each game still going, and for a while compares the
// number of moves on the page with what Lichess says at the same moment.
// Usage: node scripts/site-chess-live.mjs [base] [seconds]
import { chromium } from "@playwright/test";
const base = process.argv[2]?.startsWith("http")
  ? process.argv[2]
  : "https://bearing.vincentmay.com";
const seconds = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 60);
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const ask = async (path) => {
  const response = await fetch(`https://lichess.org/api/broadcast${path}`, {
    headers: { Accept: "application/json", "User-Agent": "Bearing (site check)" },
  });
  return response.ok ? response.json() : null;
};
/** The number of half moves a position has seen, from its FEN. */
const plies = (fen) => {
  const [, turn, , , , move] = fen.split(" ");
  return (Number(move) - 1) * 2 + (turn === "b" ? 1 : 0);
};

const top = await ask("/top?page=1");
const entry = (top?.active ?? []).find((e) => e.round?.ongoing && (e.tour.tier ?? 0) >= 4);
if (!entry) {
  console.log("No leading broadcast has a round under way; nothing to compare.");
  process.exit(0);
}
const round = await ask(`/-/-/${entry.round.id}`);
const going = round.games.filter((g) => g.status === "*").slice(0, 3);
console.log(`${entry.tour.name}, ${entry.round.name}: ${going.length} games compared`);
if (!going.length) process.exit(0);

const browser = await chromium.launch({ channel: "chrome" });
const pages = [];
for (const game of going) {
  // Each in a window of its own: a page in the background lets go of its line, as it should.
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: UA,
  });
  const page = await context.newPage();
  await page.goto(`${base}/match/lichess-${game.id}`, { waitUntil: "domcontentloaded" });
  pages.push({ game, page });
}
await pages[0].page.waitForTimeout(6000);
let worst = 0;
for (let t = 0; t < seconds; t += 5) {
  const now = await ask(`/-/-/${entry.round.id}`);
  const line = [];
  for (const { game, page } of pages) {
    const there = now?.games.find((g) => g.id === game.id);
    const shown = await page.evaluate(
      () => document.querySelectorAll(".bx-moves button, [data-ply]").length,
    );
    const behind = there ? plies(there.fen) - shown : NaN;
    if (behind > worst) worst = behind;
    line.push(`${game.name.split(" - ")[0].split(",")[0]} ${shown}/${there ? plies(there.fen) : "?"}`);
  }
  console.log(`${String(t).padStart(3)}s  ${line.join("   ")}`);
  await pages[0].page.waitForTimeout(5000);
}
console.log(`furthest behind: ${worst} half move${worst === 1 ? "" : "s"}`);
await browser.close();
