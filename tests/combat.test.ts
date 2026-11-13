import assert from "node:assert/strict";
import { createGame, endWeek, hit, hitOutlook } from "../src/game/logic";
import { ambushRisk, buyWeapon, combatMultiplier, combatOf, equipWeapon, grantFightRewards, levelOf, MAX_LEVEL, resolveAmbush, trainCombat, trainingCost, WEAPONS, xpForLevel } from "../src/game/combat";
import { completeCityOrder, issueCityOrder } from "../src/game/city-map";
import { tickEncounters } from "../src/game/encounters";
import { tradeRegion } from "../src/game/region-economy";
import type { GameState } from "../src/game/types";
import type { Result } from "../src/game/logic";
const fresh = (seed = 42) => createGame({ boss: "Test", crew: "Crew", difficulty: "street", seed });
const state = (r: Result | null): GameState => { assert.ok(r?.ok); return r.state; };
let g = fresh(); const old = structuredClone(g);
assert.equal(levelOf(g), 1); assert.equal(combatMultiplier(g), 1); assert.equal(combatOf(g).equipped, "fists");
assert.deepEqual(g, old);
g = state(buyWeapon(g, "street_pistol"));
assert.equal(g.cash, old.cash - 1200); assert.equal(combatOf(g).equipped, "street_pistol"); assert.equal(combatMultiplier(g), 1.08);
assert.equal(buyWeapon(g, "street_pistol").ok, false); assert.equal(buyWeapon(g, "rifle").ok, false);
assert.equal(equipWeapon(g, "lmg").ok, false);
g = state(equipWeapon(g, "fists")); assert.equal(combatMultiplier(g), 1);
assert.equal(trainCombat(g).ok, false);
g.combat!.credits = 25; g = state(trainCombat(g));
assert.equal(levelOf(g), 2); assert.equal(combatOf(g).credits, 0); assert.equal(trainingCost(g), 35);
g.combat!.credits = 10; g = state(trainCombat(g, 25)); assert.equal(levelOf(g), 3); assert.equal(combatOf(g).credits, 0);
g.combat!.xp = xpForLevel(MAX_LEVEL); assert.equal(trainCombat(g, 215).ok, false);
console.log("PASS Legacy profiles, weapon prices and unlocks, ownership, equipment bonuses, earned/purchased training splits and level caps.");

g = fresh(); g.crewCounts.muscle = 35;
const won = state(hit(g, "blackwater", 20));
assert.equal(won.districts.find(d => d.id === "blackwater")!.owner, "player");
assert.equal(combatOf(won).wins, 1); assert.ok(combatOf(won).xp > 0 && combatOf(won).credits > 0);
const lost = state(hit(fresh(), "iron", 1)); assert.equal(combatOf(lost).losses, 1); assert.equal(combatOf(lost).xp, 40);
const stronger = fresh(); stronger.cash = 100000; stronger.combat = { ...combatOf(stronger), xp: xpForLevel(13) };
const geared = state(buyWeapon(stronger, "lmg")); assert.ok(combatMultiplier(geared) > combatMultiplier(stronger));
assert.notEqual(hitOutlook(geared, "iron", 4), hitOutlook(fresh(), "iron", 4));
console.log("PASS Neutral and rival blocks can be fought over; fights award XP and credits, and equipment/levels improve actual combat power.");

function ambushed(s = fresh()): GameState {
 const moving = state(issueCityOrder(s, ["blackwater"], 0, 1000));
 moving.cityMap!.order!.ambush = { origin: "hollow", destination: "blackwater", location: "blackwater", attackers: 3, triggerAt: 1450 };
 const paused = state(completeCityOrder(moving, 1450));
 assert.equal(paused.cityMap!.order, null); assert.ok(combatOf(paused).ambush);
 return JSON.parse(JSON.stringify(paused));
}
const paused = ambushed();
assert.equal(completeCityOrder(paused, 999999), null);
assert.equal(endWeek(paused).ok, false); assert.equal(tradeRegion(paused, "blackwater", "dust", 1, "sell").ok, false);
assert.equal(buyWeapon(paused, "street_pistol").ok, false); assert.equal(issueCityOrder(paused, ["iron"]).ok, false);
assert.equal(tickEncounters(paused, 999999), null);
const cash = paused.cash, muscle = paused.crewCounts.muscle;
const surrendered = state(resolveAmbush(paused, "surrender", 2000));
assert.equal(surrendered.cash, cash - Math.round(cash * .1));
assert.equal(surrendered.stash.dust, 12); assert.equal(surrendered.crewCounts.muscle, muscle);
assert.equal(surrendered.cityMap!.locationId, "hollow"); assert.equal(combatOf(surrendered).surrenders, 1);
assert.equal(resolveAmbush(surrendered, "surrender").ok, false);
console.log("PASS Ambushes interrupt travel once, survive saves, block conflicting actions and resolve surrender without duplicate losses.");

let strong = ambushed(); strong.crewCounts.muscle = 40;
const victory = state(resolveAmbush(strong, "fight", 2000));
assert.equal(combatOf(victory).wins, 1); assert.ok(victory.cityMap!.order); assert.equal(victory.cityMap!.order!.ambush, undefined);
assert.ok(victory.cash > strong.cash);
const arrived = state(completeCityOrder(victory, 2900)); assert.equal(arrived.cityMap!.locationId, "blackwater");
assert.equal(completeCityOrder(arrived, 3000), null);
let weak = ambushed(); weak.crewCounts.muscle = weak.districts.reduce((n,d) => n + d.stationMuscle, 0); weak.combat!.ambush!.attackers = 10;
const defeat = state(resolveAmbush(weak, "fight", 2000)); assert.equal(combatOf(defeat).losses, 1); assert.equal(defeat.cityMap!.locationId, "hollow");
let escaped = false, failed = false;
for (const seed of [1,1000,2000,3000]) {
 const s = ambushed(); s.seed = seed; const r = state(resolveAmbush(s,"run"));
 if (combatOf(r).escapes) { escaped = true; assert.equal(r.cash,s.cash); } else { failed = true; assert.ok(r.cash < s.cash); }
 assert.equal(combatOf(r).xp, 0);
}
assert.ok(escaped && failed);
let clear = false, danger = false;
for (const seed of [42,1000,1972,2500,3000]) { const trip = state(issueCityOrder(fresh(seed),["blackwater"],0,1)); if (trip.cityMap!.order!.ambush) danger = true; else clear = true; }
assert.ok(clear && danger); assert.ok(ambushRisk(fresh(),["hollow","blackwater","cobra","neon"]) > ambushRisk(fresh(),["hollow","blackwater"]));
console.log("PASS Ambush fight/run outcomes, loot, XP and credit rewards, safe resumed travel, and risk that varies with route, heat and hostile ground.");
