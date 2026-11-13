import assert from "node:assert/strict";
import { cityMapOf, completeCityOrder, crewPoint, issueCityOrder, streetRoute, waypointRoute } from "../src/game/city-map";
import { createGame, hit } from "../src/game/logic";
import { useRazor } from "../src/game/store";
import type { GameState } from "../src/game/types";

const fresh = () => createGame({ boss: "Test", crew: "Test crew", difficulty: "street", seed: 42 });
const checks: string[] = [];

const game = fresh();
assert.equal(game.cityMap, undefined);
assert.equal(cityMapOf(game).locationId, "hollow");
assert.deepEqual(streetRoute(game, "hollow", "missing"), []);
for (const a of game.districts) for (const b of game.districts) {
  const route = streetRoute(game, a.id, b.id);
  assert.equal(route.length - 1, Math.abs(a.col - b.col) + Math.abs(a.row - b.row));
  for (let i = 1; i < route.length; i++) {
    const p = game.districts.find(d => d.id === route[i - 1])!;
    const n = game.districts.find(d => d.id === route[i])!;
    assert.equal(Math.abs(p.col - n.col) + Math.abs(p.row - n.row), 1);
  }
}
assert.deepEqual(waypointRoute(game, ["blackwater", "sinks"]), ["hollow", "blackwater", "cobra", "sinks"]);
checks.push("Legacy saves initialize at the docks; all district routes use connected streets.");

const travel = issueCityOrder(game, ["blackwater", "sinks"], 0, 1000);
assert.ok(travel.ok);
assert.equal(game.cityMap, undefined, "Ordering must not mutate the source save");
assert.equal(completeCityOrder(travel.state, 1001), null);
const halfway = crewPoint(travel.state, 1450);
assert.ok(halfway.x > crewPoint(travel.state, 1000).x);
const restored = JSON.parse(JSON.stringify(travel.state)) as GameState;
const arrived = completeCityOrder(restored, 999999)!;
assert.ok(arrived.ok);
assert.equal(cityMapOf(arrived.state).locationId, "sinks");
assert.equal(arrived.state.ap, game.ap);
assert.equal(arrived.state.cash, game.cash);
assert.deepEqual(arrived.state.districts, game.districts, "Scouting must not capture or station troops");
assert.equal(completeCityOrder(arrived.state, 999999), null);
checks.push("Waypoint travel survives serialization, costs no moves, and never captures a region.");

assert.equal(issueCityOrder(game, ["lantern"], 1, 1000).ok, false, "Non-border attacks must fail");
assert.equal(issueCityOrder(game, ["iron"], 999, 1000).ok, false);
assert.equal(issueCityOrder(game, ["iron"], NaN, 1000).ok, false);
for (const soldiers of [1, 4, 20]) {
  const source = fresh();
  if (soldiers === 20) source.crewCounts.muscle = 30;
  const attack = issueCityOrder(source, ["iron"], soldiers, 1000);
  assert.ok(attack.ok);
  const order = cityMapOf(attack.state).order!;
  assert.equal(completeCityOrder(attack.state, order.endsAt - 1), null);
  const result = completeCityOrder(attack.state, order.endsAt)!;
  const expected = hit(source, "iron", soldiers);
  assert.ok(result.ok && expected.ok);
  const { cityMap: _map, ...actualGame } = result.state;
  assert.deepEqual(actualGame, expected.state, "Battle must preserve original RNG, losses, heat, AP and ownership");
  assert.equal(result.state.ap, game.ap - 1);
  assert.equal(result.state.districts.find(d => d.id === "iron")?.owner === "player", soldiers === 20);
  assert.equal(completeCityOrder(result.state, order.endsAt + 1), null);
}
const scouted = fresh();
scouted.cityMap = { locationId: "glass", order: null };
const approach = issueCityOrder(scouted, ["iron"], 4, 1000);
assert.ok(approach.ok);
assert.equal(cityMapOf(approach.state).order!.route.slice(0, -1).includes("iron"), false);
checks.push("Ordered battles preserve existing combat results and charge exactly one move.");

useRazor.setState({ game: travel.state });
useRazor.getState().closeWeek();
assert.equal(useRazor.getState().game?.week, 1);
assert.equal(useRazor.getState().game?.phase, "play");
assert.equal(useRazor.getState().grantAdReward(), false);
const bad = issueCityOrder(travel.state, ["glass"]);
assert.equal(bad.ok, false);
checks.push("Active orders block conflicting gameplay, rewards and duplicate movement orders.");

// Simulate reopening after the order's real-time deadline, with audio unavailable.
Object.assign(globalThis, { window: {} });
useRazor.getState().tickCity();
assert.equal(cityMapOf(useRazor.getState().game!).locationId, "sinks");
const completedSave = useRazor.getState().game;
useRazor.getState().tickCity();
assert.equal(useRazor.getState().game, completedSave);
const attack = issueCityOrder(fresh(), ["iron"], 4, 1);
assert.ok(attack.ok);
useRazor.setState({ game: JSON.parse(JSON.stringify(attack.state)) });
useRazor.getState().tickCity();
assert.equal(useRazor.getState().game?.ap, 2);
const completedAttack = useRazor.getState().game;
useRazor.getState().tickCity();
assert.equal(useRazor.getState().game, completedAttack);
checks.push("Reopening completes overdue orders exactly once through the store/save pipeline.");

console.log(checks.map(s => `PASS ${s}`).join("\n"));
