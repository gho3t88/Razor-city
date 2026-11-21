import assert from "node:assert/strict";
import { createGame, recruit, soldierCapacity } from "../src/game/logic";
import { territoryCost, upgradeTerritory } from "../src/game/territory";

const s = createGame({ boss: "Test", crew: "Test Crew", difficulty: "street", seed: 31 });
const owned = s.districts.find(d => d.owner === "player")!;
assert.ok(owned, "A starting territory is required");
const before = owned.defense;
const cash = s.cash;
const ap = s.ap;
const r = upgradeTerritory(s, owned.id, "cameras");
assert.ok(r.ok);
assert.equal(r.state.districts.find(d => d.id === owned.id)!.cameras, 1);
assert.equal(r.state.districts.find(d => d.id === owned.id)!.defense, before + 8);
assert.equal(r.state.cash, cash - territoryCost("cameras", 0));
assert.equal(r.state.ap, ap - 1);
assert.equal(owned.cameras ?? 0, 0, "Original saved game must remain unchanged");
assert.equal(upgradeTerritory(s, s.districts.find(d => d.owner !== "player")!.id, "cameras").ok, false);
const broke = structuredClone(s); broke.cash = 0;
assert.equal(upgradeTerritory(broke, owned.id, "cameras").ok, false);
console.log("PASS Territory upgrades, defenses, cash, action points, and save immutability.");

// Barracks expand recruitment capacity only while the upgraded block is owned.
const full = structuredClone(s);
full.crewCounts.muscle = 40;
full.cash = 10000;
assert.equal(soldierCapacity(full), 40);
assert.equal(recruit(full, "muscle").ok, false);
const expanded = upgradeTerritory(full, owned.id, "barracks");
assert.ok(expanded.ok);
assert.equal(soldierCapacity(expanded.state), 44);
const hired = recruit(expanded.state, "muscle");
assert.ok(hired.ok);
assert.equal(hired.state.crewCounts.muscle, 41);
const seized = structuredClone(expanded.state);
seized.districts.find(d => d.id === owned.id)!.owner = "neutral";
assert.equal(soldierCapacity(seized), 40);
assert.equal(recruit(seized, "muscle").ok, false);
console.log("PASS Barracks increase recruitment capacity and losing territory removes that capacity.");

const clinicUpgrade = upgradeTerritory(s, owned.id, "clinic");
assert.ok(clinicUpgrade.ok);
assert.equal(clinicUpgrade.state.districts.find(d => d.id === owned.id)!.clinic, 1);
assert.equal(clinicUpgrade.state.districts.find(d => d.id === owned.id)!.defense, before);
assert.equal(clinicUpgrade.state.cash, cash - territoryCost("clinic", 0));
console.log("PASS clinic upgrade state and cash accounting.");
