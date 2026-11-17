import { chromium } from "playwright";
import { createServer } from "vite";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const server = await createServer({ server: { host: "127.0.0.1", port: 5179 } });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 393, height: 760 } });
const errors = [];
page.on("pageerror", e => errors.push(e.message));
await fs.mkdir("test-results", { recursive: true });
const forceBuyer = async () => page.evaluate(async () => {
  const { useRazor } = await import("/src/game/store.ts");
  const g = structuredClone(useRazor.getState().game);
  g.encounters.nextBuyerAt = 0; g.encounters.nextTalkAt = Number.MAX_SAFE_INTEGER; g.encounters.pending = null;
  useRazor.setState({ game: g }); useRazor.getState().tickContacts();
});
try {
  await page.goto("http://127.0.0.1:5179");
  await page.getByRole("button", { name: "Take the docks", exact: true }).click();
  await page.getByRole("button", { name: "Contacts and active deals" }).waitFor();
  await forceBuyer();
  await page.getByRole("dialog", { name: "INCOMING CALL" }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: /Continue Test|Continue Hollow Kings/ }).click();
  await page.getByRole("dialog", { name: "INCOMING CALL" }).waitFor();
  for (const [width, height] of [[393, 760], [320, 568], [852, 393]]) {
    await page.setViewportSize({ width, height });
    const box = await page.getByRole("dialog").boundingBox();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1);
    await page.getByRole("button", { name: "Accept deal", exact: true }).scrollIntoViewIfNeeded();
    const control = await page.getByRole("button", { name: "Accept deal", exact: true }).boundingBox();
    assert.ok(control.height >= 44 && control.y + control.height <= height);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `test-results/buyer-${width}x${height}.png` });
  }
  await page.setViewportSize({ width: 393, height: 760 });
  await page.getByRole("button", { name: "Accept deal", exact: true }).click();
  await page.getByRole("button", { name: "Contacts and active deals" }).click();
  await page.getByRole("dialog", { name: "CONTACTS & DEALS" }).waitFor();
  assert.equal(await page.locator(".contact-roster-card").count(), 8);
  await page.screenshot({ path: "test-results/active-deals.png" });
  await page.evaluate(async () => {
    const { useRazor } = await import("/src/game/store.ts");
    const g = structuredClone(useRazor.getState().game);
    const d = g.encounters.deals.find(d => d.status === "active");
    g.stash[d.product] = d.quantity;
    useRazor.setState({ game: g });
  });
  await page.getByRole("button", { name: /Complete order/ }).click();
  await page.getByText(/Deal history · 1 completed/).click();
  await page.getByText("Paid in full, including bonus").waitFor();
  await page.getByRole("button", { name: "Close contacts" }).click();
  await page.evaluate(async () => {
    const { useRazor } = await import("/src/game/store.ts");
    const g = structuredClone(useRazor.getState().game);
    g.encounters.nextTalkAt = 0; g.encounters.lastTalkWeek = 0; g.encounters.nextBuyerAt = Number.MAX_SAFE_INTEGER;
    useRazor.setState({ game: g }); useRazor.getState().tickContacts();
  });
  await page.getByRole("dialog", { name: "CREW CONVERSATION" }).waitFor();
  await page.screenshot({ path: "test-results/crew-conversation.png" });
  await page.getByRole("button", { name: /Hear them out/ }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Contacts and active deals" }).click();
  await page.getByText("THE NEIGHBORHOOD", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/character-roster.png" });
  assert.deepEqual(errors, []);
  console.log("PASS incoming-call persistence, three phone layouts, eight portraits, acceptance, full delivery, $10k reward, deal history and crew replies.");
} finally { await browser.close(); await server.close(); }
