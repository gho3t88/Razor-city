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
  await page.getByRole("button", { name: "Skip tutorial", exact: true }).click();
  // Tester #06: keyboard Escape and Android Back share the same handler.
  // Dismissing a sheet must not exit the game or discard saved progress.
  await page.getByRole("button", { name: "Market", exact: true }).click();
  await page.getByRole("heading", { name: "WHOLESALE", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("heading", { name: "WHOLESALE", exact: true }).count(), 0);
  await page.getByRole("button", { name: "Game options", exact: true }).click();
  await page.getByRole("heading", { name: "GAME OPTIONS", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("heading", { name: "GAME OPTIONS", exact: true }).count(), 0);
  await page.keyboard.press("Escape");
  await page.getByRole("alertdialog", { name: "Return to main menu?" }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("alertdialog", { name: "Return to main menu?" }).count(), 0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Save & main menu" }).click();
  await page.getByRole("button", { name: /Continue Hollow Kings/ }).click();
  await page.getByRole("button", { name: "Close week", exact: true }).waitFor();
  if (await page.getByRole("button", { name: "Skip tutorial", exact: true }).count()) await page.getByRole("button", { name: "Skip tutorial", exact: true }).click();
  for (const [width, height] of [[393, 760], [360, 640], [320, 568], [852, 393], [1280, 900]]) {
    await page.setViewportSize({ width, height });
    if (await page.getByRole("button", { name: "Skip tutorial", exact: true }).count()) await page.getByRole("button", { name: "Skip tutorial", exact: true }).click();
    await page.getByRole("button", { name: "Ironworks, Iron Saints", exact: true }).click();
    await inside(page.getByRole("button", { name: "Travel here", exact: true }), width, height);
    await inside(page.getByRole("button", { name: "Attack · 1 move", exact: true }), width, height);
    await inside(page.getByRole("button", { name: "Manage", exact: true }), width, height);
    await inside(page.getByRole("button", { name: "Close week", exact: true }), width, height);
    const layout = await page.evaluate(() => {
      const items = [
        ["title", ".game-brand strong"],
        ["week and difficulty", ".game-brand span"],
        ["Deals", ".game-topbar .contacts-trigger"],
        ["sound", ".game-topbar .game-sound"],
        ["options", ".game-topbar .game-settings"],
      ].map(([name, selector]) => {
        const el = document.querySelector(selector);
        const rect = el.getBoundingClientRect();
        return { name, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, textFits: el.scrollWidth <= el.clientWidth + 1 };
      });
      return {
        pageHeight: document.documentElement.scrollHeight,
        pageWidth: document.documentElement.scrollWidth,
        header: document.querySelector(".game-topbar").getBoundingClientRect().height,
        map: document.querySelector(".city-scroll").getBoundingClientRect().height,
        items,
      };
    });
    assert.ok(layout.pageHeight <= height + 1, JSON.stringify(layout));
    assert.ok(layout.pageWidth <= width + 1, JSON.stringify(layout));
    assert.ok(layout.header < (width <= 480 ? 95 : 70), JSON.stringify(layout));
    assert.ok(layout.map > 120, JSON.stringify(layout));
    for (const item of layout.items) {
      assert.ok(item.left >= -1 && item.right <= width + 1 && item.textFits, `Header item clipped at ${width}x${height}: ${JSON.stringify(item)}`);
    }
    for (let i = 0; i < layout.items.length; i++) {
      for (let j = i + 1; j < layout.items.length; j++) {
        const a = layout.items[i], b = layout.items[j];
        const overlap = a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
        assert.ok(!overlap, `Header collision at ${width}x${height}: ${a.name} / ${b.name}`);
      }
    }
    await page.screenshot({ path: `test-results/city-${width}x${height}.png` });
    console.log(`PASS ${width}x${height}: map ${Math.round(layout.map)}px; Travel and Attack visible without scrolling`);
  }
  await page.setViewportSize({ width: 393, height: 760 });
  await page.getByRole("button", { name: "Blackwater, open", exact: true }).click();
  await page.evaluate(async () => { const { useRazor } = await import("/src/game/store.ts"); const g = structuredClone(useRazor.getState().game); g.seed = 42; useRazor.setState({ game: g }); });
  if (await page.getByRole("button", { name: "Skip tutorial", exact: true }).count()) await page.getByRole("button", { name: "Skip tutorial", exact: true }).click();
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
