import assert from "node:assert/strict";
import { createGame, endWeek, hit, recruit, continueReport } from "../src/game/logic";
import { medicalOf, recordCasualties, TREATMENT_COST, treatWounded, woundedCount, expireUntreated } from "../src/game/medical";
import { completeCityOrder, issueCityOrder } from "../src/game/city-map";
import type { GameState } from "../src/game/types";

const fresh = () => createGame({ boss: "Medic test", crew: "Crew", difficulty: "street", seed: 42 });
const legacy = fresh();
assert.equal(legacy.medical, undefined);
assert.equal(woundedCount(legacy), 0);
assert.equal(medicalOf(legacy).killed, 0);
assert.equal(treatWounded(legacy, 1).ok, false);
assert.equal(legacy.medical, undefined, "Legacy records must not be mutated by reads");

// Force a loss with several combat casualties to exercise BOTH fatal and recoverable outcomes.
const game = fresh();
game.districts.find(d => d.id === "iron")!.defense = 900;
const preFightCount = game.crewCounts.muscle;
const lost = hit(game, "iron", 5);
assert.ok(lost.ok);
const defeat = lost.state;
const removed = preFightCount - defeat.crewCounts.muscle;
const injured = woundedCount(defeat);
assert.ok(removed > 1);
assert.ok(medicalOf(defeat).killed > 0);
assert.ok(injured > 0);
assert.equal(medicalOf(defeat).killed + injured, removed);
assert.equal(game.crewCounts.muscle, preFightCount, "Battle must not mutate original state");
assert.equal(medicalOf(defeat).wounded[0].dueWeek, game.week + 1);
const revivedSave = JSON.parse(JSON.stringify(defeat)) as GameState;
assert.deepEqual(revivedSave.medical, defeat.medical, "Wounded should survive saving and reloading");
assert.equal(treatWounded(defeat, 0).ok, false);
assert.equal(treatWounded(defeat, 1.5).ok, false);
assert.equal(treatWounded(defeat, injured + 1).ok, false);
const broke = structuredClone(defeat); broke.cash = 0;
assert.equal(treatWounded(broke, 1).ok, false);
const travelBusy = structuredClone(defeat); travelBusy.cityMap = { locationId: "hollow", order: { kind: "travel", route: ["hollow", "iron"], startedAt: 1, arrivesAt: 2, endsAt: 2, soldiers: 0 } };
assert.equal(treatWounded(travelBusy, 1).ok, false);
const closePhase = structuredClone(defeat); closePhase.phase = "summary";
assert.equal(treatWounded(closePhase, 1).ok, false);

const healed = treatWounded(defeat, 1);
assert.ok(healed.ok);
assert.equal(healed.state.cash, defeat.cash - TREATMENT_COST);
assert.equal(healed.state.crewCounts.muscle, defeat.crewCounts.muscle + 1);
assert.equal(woundedCount(healed.state), injured - 1);
assert.equal(medicalOf(healed.state).recovered, 1);
assert.equal(woundedCount(defeat), injured, "Treatment must not mutate original state");
assert.equal(treatWounded(healed.state, injured).ok, false, "Cannot heal same soldier twice");
const fullyHealed = treatWounded(defeat, injured);
assert.ok(fullyHealed.ok);
assert.equal(woundedCount(fullyHealed.state), 0);
assert.equal(fullyHealed.state.crewCounts.muscle, defeat.crewCounts.muscle + injured);
console.log("PASS losses split into killed/wounded, save compatibility, cash-paid treatment, roster recovery, anti-duplication and action validation.");

// The next playable week is the last opportunity to rescue the injured.
const prior = structuredClone(defeat);
prior.week = medicalOf(prior).wounded[0].dueWeek;
assert.equal(expireUntreated(prior), 0);
const deadline = structuredClone(prior);
deadline.week += 1;
assert.equal(expireUntreated(deadline), injured);
assert.equal(woundedCount(deadline), 0);
assert.equal(medicalOf(deadline).untreatedDeaths, injured);
assert.equal(medicalOf(deadline).killed, medicalOf(defeat).killed + injured);
assert.equal(expireUntreated(deadline), 0, "Expired injuries cannot be counted twice");
const advancedGame = structuredClone(prior); advancedGame.phase = "play";
const advance = endWeek(advancedGame);
assert.ok(advance.ok);
assert.equal(woundedCount(advance.state), 0, "Week advance must expire untreated casualties");
assert.equal(medicalOf(advance.state).untreatedDeaths, injured);
console.log("PASS injuries expire precisely when the next game week ends, including regular week transitions.");

const cap = fresh(); cap.crewCounts.muscle = 39; cap.medical = { wounded: [{ count: 1, dueWeek: 2 }], killed: 0, recovered: 0, untreatedDeaths: 0 };
assert.equal(recruit(cap, "muscle").ok, false, "Reserved wounded slot must remain available for eventual recovery");
const newcomer = fresh(); const hired = recruit(newcomer, "muscle");
assert.ok(hired.ok);
assert.equal(hired.state.crewCounts.muscle, newcomer.crewCounts.muscle + 1);
assert.equal(hired.state.cash, newcomer.cash - 700);
assert.equal(hired.state.ap, newcomer.ap - 1);
console.log("PASS soldier recruitment costs $700 and a move, while reserving wounded roster slots.");

// A real timed battle should attach the after-action detail to its visible report.
const fightGame = fresh();
fightGame.districts.find(d => d.id === "iron")!.defense = 900;
const ordered = issueCityOrder(fightGame, ["iron"], 5, 1000);
assert.ok(ordered.ok);
const order = ordered.state.cityMap!.order!;
const complete = completeCityOrder(ordered.state, order.endsAt);
assert.ok(complete?.ok);
const scene = complete.state.fightScene;
assert.ok(scene && scene.status === "lost" && scene.afterAction);
assert.equal(scene.afterAction.deployed, 5);
assert.equal(scene.afterAction.killed + scene.afterAction.wounded, 5 - scene.afterAction.survivors);
assert.equal(scene.afterAction.xpEarned, 40);
assert.equal(scene.afterAction.creditsEarned, 2);
assert.match(scene.afterAction.territory, /enemy-held/);
console.log("PASS combat reports record deployed, survivors, fatal/wounded casualties, rewards and territory.");
