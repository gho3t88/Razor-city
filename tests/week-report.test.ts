import assert from "node:assert/strict";
import { createGame, endWeek, resolveChoice, continueReport } from "../src/game/logic";
import { PRODUCT_IDS } from "../src/game/content";

let foundEvent = false;
for (let seed = 1; seed <= 80; seed++) {
  const initial = createGame({ boss: "Tester", crew: "Test crew", difficulty: "street", seed });
  const original = structuredClone(initial);
  const closed = endWeek(initial);
  assert.ok(closed.ok);
  assert.deepEqual(initial, original);
  let game = closed.state;
  assert.equal(game.report?.closedWeek, initial.week);
  assert.deepEqual(game.report?.inventoryBefore, initial.stash);
  assert.deepEqual(game.report?.inventoryAfter, game.stash);
  assert.equal(endWeek(game).ok, false);
  if (game.phase === "event") {
    foundEvent = true;
    const resolved = resolveChoice(game, game.pending!.options[0].id);
    assert.ok(resolved.ok);
    game = resolved.state;
    assert.deepEqual(game.report?.inventoryAfter, game.stash);
  }
  if (game.phase === "summary") {
    const reloaded = JSON.parse(JSON.stringify(game));
    const continued = continueReport(reloaded);
    assert.ok(continued.ok);
    assert.equal(continued.state.week, initial.week + 1);
    assert.equal(continued.state.phase, "play");
    assert.equal(continued.state.report, null);
    assert.equal(continueReport(continued.state).ok, false);
    for (const id of PRODUCT_IDS) assert.equal(continued.state.stash[id], game.stash[id]);
  }
}
assert.ok(foundEvent, "Exercise event-to-summary inventory reporting");
console.log("PASS week report inventory, reload, event resolution, and single continuation");
