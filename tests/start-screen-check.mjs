import { chromium } from "playwright";
import { createServer } from "vite";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const server = await createServer({ server: { host: "127.0.0.1", port: 5182 } });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage();
try {
  await fs.mkdir("test-results", { recursive: true });
  for (const [width, height] of [[393, 760], [360, 640], [320, 568], [393, 580]]) {
    await page.setViewportSize({ width, height });
    await page.goto("http://127.0.0.1:5182");
    const heading = page.locator(".start-screen h1");
    const headingBox = await heading.boundingBox();
    assert.ok(headingBox, "Start-screen title is absent");
    assert.match(await heading.innerText(), /RAZOR\s+CITY/);
    assert.ok(headingBox.y >= 0 && headingBox.y < height, "RAZOR title starts offscreen");
    const layout = await page.locator(".start-screen-layout").boundingBox();
    assert.ok(layout && layout.y >= 0, "Start-screen layout is clipped above viewport");
    assert.equal(await page.evaluate(() => document.documentElement.scrollLeft), 0, "Horizontal page overflow");
    await page.screenshot({ path: `test-results/start-${width}x${height}.png` });
    await page.getByRole("button", { name: "Take the docks" }).scrollIntoViewIfNeeded();
    assert.ok(await page.getByRole("button", { name: "Take the docks" }).isVisible());
    console.log(`PASS ${width}x${height}: title in viewport and Start button reachable`);
  }
} finally { await browser.close(); await server.close(); }
