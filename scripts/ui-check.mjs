/**
 * Manual UI smoke check (not part of `pnpm test`).
 * Drives a real drag selection in the reader, opens the buddy panel, waits for a
 * real AI answer, saves it to the notebook, and screenshots each step.
 *
 * Usage: node scripts/ui-check.mjs <bookId>
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "fs";

const bookId = process.argv[2];
if (!bookId) {
  console.error("usage: node scripts/ui-check.mjs <bookId>");
  process.exit(1);
}

const OUT = "/home/ubuntu/ui-check";
mkdirSync(OUT, { recursive: true });
// Must match the origin the session cookie was issued for, otherwise the app
// bounces to the OAuth portal.
const BASE =
  process.env.UI_CHECK_BASE ??
  "https://3000-inxkm24mpqx5yg4ekkdv5-517d6c2e.sg1.manus.computer";

const browser = await chromium.connectOverCDP("http://localhost:9222");
const context = browser.contexts()[0];
if (!context) throw new Error("no browser context available over CDP");
const page = await context.newPage();
page.on("console", msg => {
  if (msg.type() === "error") console.log("  [console error]", msg.text());
});

step(0, "signing in through the dev-only session endpoint");
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
const loginStatus = await page.evaluate(async () => {
  const res = await fetch("/api/trpc/auth.devLogin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
    credentials: "include",
  });
  return { status: res.status, body: (await res.text()).slice(0, 160) };
});
console.log(`    devLogin → ${loginStatus.status} ${loginStatus.body}`);
if (loginStatus.status !== 200) {
  console.error("    could not establish a dev session");
  process.exit(2);
}

function step(n, label) {
  console.log(`[${n}] ${label}`);
}

step(1, "opening the reader");
// Start from the library (already authenticated in this tab), then navigate
// in-app so the SPA keeps the session instead of bouncing through OAuth.
await page.goto(`${BASE}/library`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
console.log(`    url after library load: ${page.url()}`);
if (page.url().includes("app-auth")) {
  console.error(
    "    session expired — sign in once in the browser, then re-run this script",
  );
  process.exit(2);
}
await page.screenshot({ path: `${OUT}/00-library.png`, fullPage: true });

// Click into the book rather than deep-linking.
await page.locator('a[aria-label^="Open"]').first().click();
await page.waitForTimeout(2500);
console.log(`    url after opening book: ${page.url()}`);
await page.waitForSelector('[data-testid="page-text"] p', { timeout: 25000 });
await page.screenshot({ path: `${OUT}/01-reader.png` });

step(2, "drag-selecting a sentence");
const target = page.locator('[data-testid="page-text"] p').nth(1);
const box = await target.boundingBox();
if (!box) throw new Error("could not measure the paragraph");
await page.mouse.move(box.x + 4, box.y + 10);
await page.mouse.down();
await page.mouse.move(box.x + box.width - 20, box.y + 10, { steps: 24 });
await page.mouse.up();
const selected = await page.evaluate(() => window.getSelection()?.toString() ?? "");
console.log(`    selected ${selected.length} chars: ${selected.slice(0, 70)}…`);
if (selected.length < 10) throw new Error("drag selection produced no text");

step(3, "waiting for the ask pill");
const pill = page.getByRole("button", { name: /ask readbuddy/i });
await pill.waitFor({ state: "visible", timeout: 5000 });
await page.screenshot({ path: `${OUT}/02-pill.png` });
console.log("    pill is visible");

step(4, "opening the buddy panel");
await pill.click();
await page.waitForSelector("text=/Reading buddy|Your buddy|Explain/i", { timeout: 8000 });
await page.screenshot({ path: `${OUT}/03-panel-loading.png` });

step(5, "waiting for a real AI answer (up to 90s)");
await page.waitForFunction(
  () => !document.body.innerText.includes("Thinking about this passage"),
  null,
  { timeout: 90000 },
);
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/04-panel-answer.png`, fullPage: false });
// Only the inline error card carries role="alert", so check that rather than
// scanning body text (which contains the word "Translate" etc.).
const errorCard = page.locator('[role="alert"]');
if (await errorCard.count()) {
  console.log(`    WARNING: error state → ${(await errorCard.first().innerText()).slice(0, 120)}`);
} else {
  const answerLen = await page.evaluate(
    () => document.body.innerText.split("EXPLAIN")[1]?.length ?? 0,
  );
  console.log(`    answer rendered (~${answerLen} chars)`);
}

step(6, "saving the answer to the notebook");
// Scroll the panel to the answer's action row and use the save/bookmark control.
const saveBtn = page
  .locator('button:has-text("Save"), button[aria-label*="Save" i]')
  .first();
if (!(await saveBtn.count())) {
  console.log("    FAIL: no save control found in the panel");
  const buttons = await page.locator("button").allInnerTexts();
  console.log(`    buttons present: ${JSON.stringify(buttons.slice(0, 25))}`);
  process.exit(1);
}
await saveBtn.scrollIntoViewIfNeeded();
await saveBtn.click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/05-saved.png` });

step(7, "checking the notebook page");
await page.goto(`${BASE}/notebook`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/06-notebook.png`, fullPage: true });
const notebookText = await page.evaluate(() => document.body.innerText);
console.log(
  notebookText.includes("No notes yet")
    ? "    FAIL: notebook is still empty"
    : "    notebook contains the saved note",
);

step(8, "following the notebook deep link back to the reader");
const jump = page.getByRole("link", { name: /open in reader|page \d+/i }).first();
if (await jump.count()) {
  await jump.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/07-deeplink.png` });
  console.log(`    landed on ${page.url()}`);
}

await page.close();
console.log(`done — screenshots in ${OUT}`);
process.exit(0);
