import { chromium } from "playwright";
import { createServer } from "vite";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const server = await createServer({ server: { host: "127.0.0.1", port: 5178 }, });
await server.listen();
const browser = await chromium.launch();
await fs.mkdir("test-results", { recursive: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));

async function inside(locator, width, height) {
  const box = await locator.boundingBox();
  assert.ok(box, "Control has no visible bounds");
  assert.ok(box.y >= 0 && box.y + box.height <= height + 1, `Control outside viewport: ${JSON.stringify(box)}`);
  assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
  assert.ok(box.height >= 40, "Touch control is too small");
}

try {
  await page.goto("http://127.0.0.1:5178");
  await page.getByRole("button", { name: "Take the docks", exact: true }).click();
  for (const [width, height] of [[393, 760], [360, 640], [320, 568], [852, 393], [1280, 900]]) {
    await page.setViewportSize({ width, height });
    await page.getByRole("button", { name: "Ironworks, Iron Saints", exact: true }).click();
    await inside(page.getByRole("button", { name: "Travel here", exact: true }), width, height);
    await inside(page.getByRole("button", { name: "Attack · 1 move", exact: true }), width, height);
    await inside(page.getByRole("button", { name: "Manage", exact: true }), width, height);
    await inside(page.getByRole("button", { name: "Close week", exact: true }), width, height);
    const layout = await page.evaluate(() => ({ pageHeight: document.documentElement.scrollHeight, pageWidth: document.documentElement.scrollWidth, header: document.querySelector(".game-topbar").getBoundingClientRect().height, map: document.querySelector(".city-scroll").getBoundingClientRect().height }));
    assert.ok(layout.pageHeight <= height + 1, JSON.stringify(layout));
    assert.ok(layout.pageWidth <= width + 1, JSON.stringify(layout));
    assert.ok(layout.header < 70, JSON.stringify(layout));
    assert.ok(layout.map > 120, JSON.stringify(layout));
    await page.screenshot({ path: `test-results/city-${width}x${height}.png` });
    console.log(`PASS ${width}x${height}: map ${Math.round(layout.map)}px; Travel and Attack visible without scrolling`);
  }
  await page.setViewportSize({ width: 393, height: 760 });
  await page.getByRole("button", { name: "Blackwater, open", exact: true }).click();
  await page.evaluate(async () => { const { useRazor } = await import("/src/game/store.ts"); const g = structuredClone(useRazor.getState().game); g.seed = 42; useRazor.setState({ game: g }); });
  await page.getByRole("button", { name: "Travel here", exact: true }).click();
  await page.getByText("Crew arrived at Blackwater.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Ironworks, Iron Saints", exact: true }).click();
  await page.getByRole("button", { name: "Attack · 1 move", exact: true }).click();
  await page.getByText(/Fighting in Ironworks/).waitFor();
  await page.screenshot({ path: "test-results/street-battle.png" });
  await page.getByText(/captured|Attack repelled/).first().waitFor();
  await page.getByRole("button", { name: "Back to city", exact: true }).click();
  await page.getByRole("button", { name: "Manage", exact: true }).click();
  await page.getByRole("heading", { name: "REGION MANAGEMENT", exact: true }).waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Game options", exact: true }).click();
  await page.getByRole("button", { name: "Tip the Developer", exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log("PASS travel, ordered combat, region management and compact options menu");
} finally {
  await browser.close();
  await server.close();
}
