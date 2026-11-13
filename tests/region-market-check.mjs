import { chromium } from "playwright";
import { createServer } from "vite";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const server = await createServer({ server: { host: "127.0.0.1", port: 5180 } });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 393, height: 760 } });
const errors = []; page.on("pageerror", e => errors.push(e.message));
await fs.mkdir("test-results", { recursive: true });
async function game() { return page.evaluate(async () => (await import('/src/game/store.ts')).useRazor.getState().game); }
try {
  await page.goto("http://127.0.0.1:5180");
  await page.getByRole("button", { name: "Take the docks", exact: true }).click();
  await page.getByRole("button", { name: "Trade", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Regional market" });
  await dialog.waitFor();
  for (const [width, height] of [[393,760], [320,568], [852,393]]) {
    await page.setViewportSize({ width, height });
    const box = await dialog.boundingBox();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `test-results/region-market-${width}x${height}.png` });
  }
  await page.setViewportSize({ width: 393, height: 760 });
  const before = await game(); const price = before.regionMarkets.hollow.products.dust.sell;
  await page.getByRole("spinbutton", { name: "Yellow Dust units", exact: true }).fill("5");
  await page.getByRole("button", { name: `Sell 5 · $${(5 * price).toLocaleString("en-US")}`, exact: true }).click();
  const after = await game(); assert.equal(after.cash, before.cash + price * 5); assert.equal(after.stash.dust, before.stash.dust - 5);
  const savedMarket = after.regionMarkets.hollow;
  await page.getByRole("button", { name: "Close regional market" }).click();
  await page.reload();
  await page.getByRole("button", { name: /Continue Hollow Kings/ }).click();
  await page.getByRole("button", { name: "Trade", exact: true }).click();
  assert.deepEqual((await game()).regionMarkets.hollow, savedMarket, "Reloading cannot reroll local quotes or refill buyers");
  await page.getByRole("button", { name: "Compare regions", exact: true }).click();
  await page.screenshot({ path: "test-results/region-market-comparison.png" });
  assert.equal(await page.locator(".market-comparison").count(), 4);
  await page.getByRole("button", { name: "Close regional market" }).click();
  await page.getByRole("button", { name: "Blackwater, open", exact: true }).click();
  await page.getByRole("button", { name: "Trade", exact: true }).click();
  assert.equal(await page.locator(".market-sell").first().isDisabled(), true);
  await page.getByRole("button", { name: "Travel to Blackwater", exact: true }).click();
  await page.getByText("Crew arrived at Blackwater.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Trade", exact: true }).click();
  await page.getByText("● Your crew is here", { exact: true }).waitFor();
  assert.equal((await game()).regionMarkets.blackwater.visits, 1);
  await page.screenshot({ path: "test-results/region-market-arrival.png" });
  assert.deepEqual(errors, []);
  console.log("PASS regional market phone layouts, direct sale totals, saved demand and quotes, comparisons, remote trade restrictions and fresh quotes after travel.");
} finally { await browser.close(); await server.close(); }
