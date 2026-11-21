import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";
const server = await createServer({ server: { host: "127.0.0.1", port: 5179 } });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 393, height: 760 } });
try {
  await page.goto("http://127.0.0.1:5179");
  await page.getByRole("button", { name: "Take the docks", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Open inventory" }).click();
  await page.getByRole("dialog", { name: "Your inventory" }).waitFor();
  await page.getByRole("button", { name: "Close inventory" }).click();
  await page.getByRole("button", { name: "Open regional market" }).click();
  await page.getByRole("dialog", { name: "Regional market" }).waitFor();
  await page.getByRole("button", { name: "Close regional market" }).click();
  assert.ok(await page.getByRole("button", { name: "Open regional market" }).isVisible(), "Tutorial should wait for the actual sale");
  await page.getByRole("button", { name: "Skip tutorial" }).click();
  assert.equal(await page.getByRole("button", { name: "Open regional market" }).count(), 0);
  console.log("PASS Switch walkthrough opens real inventory and trade UIs and waits for gameplay.");
} finally { await browser.close(); await server.close(); }
