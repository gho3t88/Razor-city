import { chromium } from "playwright";
import { createServer } from "vite";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const server = await createServer({ server: { host: "127.0.0.1", port: 5181 } });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 393, height: 760 } });
const errors = []; page.on("pageerror", e => errors.push(e.message));
await fs.mkdir("test-results", { recursive: true });
async function readGame() { return page.evaluate(async () => (await import('/src/game/store.ts')).useRazor.getState().game); }
try {
  await page.goto("http://127.0.0.1:5181");
  await page.getByRole("button", { name: "Take the docks", exact: true }).click();
  await page.getByRole("button", { name: "Black market and training" }).click();
  await page.getByRole("dialog", { name: "BLACK MARKET & TRAINING" }).waitFor();
  assert.equal(await page.locator(".weapon-card").count(), 9);
  for (const [width,height] of [[393,760],[320,568],[852,393]]) {
    await page.setViewportSize({width,height});
    const box = await page.getByRole("dialog").boundingBox();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.screenshot({ path: `test-results/black-market-${width}x${height}.png` });
  }
  await page.setViewportSize({width:393,height:760});
  const before = await readGame();
  await page.locator(".weapon-card").filter({has:page.getByRole("heading",{name:"Street Pistol",exact:true})}).getByRole("button",{name:"Buy & equip",exact:true}).click();
  assert.equal((await readGame()).cash,before.cash-1200);
  assert.equal((await readGame()).combat.equipped,"street_pistol");
  await page.getByRole("button",{name:"Training",exact:true}).click();
  await page.evaluate(async () => { const {useRazor}=await import('/src/game/store.ts');const g=structuredClone(useRazor.getState().game);g.combat.credits=25;useRazor.setState({game:g}); });
  await page.getByRole("button",{name:"Level up · 25 Street Credits",exact:true}).click();
  assert.equal((await readGame()).combat.xp,150);
  assert.equal((await readGame()).combat.credits,0);
  await page.screenshot({path:"test-results/combat-training.png"});
  await page.getByRole("button",{name:"Credit shop",exact:true}).click();
  assert.equal(await page.getByRole("button",{name:"Not available",exact:true}).count(),3);
  for (const button of await page.getByRole("button",{name:"Not available",exact:true}).all()) assert.equal(await button.isDisabled(),true);
  await page.screenshot({path:"test-results/credit-shop-preview.png"});
  await page.getByRole("button",{name:"Close contacts",exact:true}).click();
  await page.evaluate(async () => {
    const {useRazor}=await import('/src/game/store.ts');const g=structuredClone(useRazor.getState().game);
    g.combat.ambush={origin:"hollow",destination:"blackwater",location:"blackwater",attackers:4,triggerAt:1};
    g.cityMap={locationId:"blackwater",order:null,report:"Ambush!"};
    useRazor.getState().commit({ok:true,state:g});
  });
  await page.getByRole("dialog",{name:"AMBUSH ON THE STREET"}).waitFor();
  await page.screenshot({path:"test-results/travel-ambush.png"});
  for (const name of [/Run ·/,/Fight ·/,/^Surrender/]) await page.getByRole("button",{name}).waitFor();
  await page.reload();
  await page.getByRole("button",{name:/Continue Hollow Kings/}).click();
  await page.getByRole("dialog",{name:"AMBUSH ON THE STREET"}).waitFor();
  const cash = (await readGame()).cash;
  await page.getByRole("button",{name:/^Surrender/}).click();
  assert.equal((await readGame()).cash,cash-Math.round(cash*.1));
  assert.equal((await readGame()).combat.ambush,null);
  await page.evaluate(async () => {
    const {useRazor}=await import('/src/game/store.ts');const g=structuredClone(useRazor.getState().game);
    g.crewCounts.muscle=35;g.seed=42;useRazor.setState({game:g});
  });
  await page.getByRole("button",{name:"Blackwater, open",exact:true}).click();
  await page.getByLabel("Attack soldiers",{exact:true}).selectOption("20");
  await page.getByRole("button",{name:"Attack · 1 move",exact:true}).click();
  await page.getByText(/Blackwater captured/).waitFor();
  const captured = await readGame();
  assert.equal(captured.districts.find(d=>d.id==="blackwater").owner,"player");
  assert.ok(captured.combat.wins > 0 && captured.combat.xp > 150);
  assert.deepEqual(errors,[]);
  console.log("PASS weapon shop layouts, purchases/equipment, earned-credit training, disabled preview purchases, ambush choices/save recovery and neutral-block capture.");
} finally { await browser.close(); await server.close(); }
