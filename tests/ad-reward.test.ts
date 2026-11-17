import assert from "node:assert/strict";
import { applySponsorBonus, canClaimSponsorBonus, sponsorBonusClaimed } from "../src/game/ad-reward";
import { createGame } from "../src/game/logic";

const newGame = () => createGame({ boss: "Tester", crew: "Crew", difficulty: "street", seed: 73 });
const original = newGame();
assert.equal(canClaimSponsorBonus(original), true);
assert.equal(sponsorBonusClaimed(original), false);
const firstReward = applySponsorBonus(original)!;
assert.equal(firstReward.cash, original.cash + 1000);
assert.equal(firstReward.sponsorBonusWeek, original.week);
assert.equal(sponsorBonusClaimed(firstReward), true);
assert.equal(canClaimSponsorBonus(firstReward), false);
assert.equal(applySponsorBonus(firstReward), null, "Never grant a second reward during the same week");

// The claimed week survives save/reload.
const restored = JSON.parse(JSON.stringify(firstReward));
assert.equal(canClaimSponsorBonus(restored), false);

// A new week and a separate new run can each earn their own sponsored reward.
const nextWeek = { ...firstReward, week: firstReward.week + 1 };
assert.equal(canClaimSponsorBonus(nextWeek), true);
assert.equal(applySponsorBonus(nextWeek)?.cash, firstReward.cash + 1000);
assert.equal(canClaimSponsorBonus(newGame()), true, "One run cannot block a different save");

// Do not advertise a reward while the game is paused or showing the weekly report.
assert.equal(canClaimSponsorBonus({ ...original, phase: "summary" }), false);
console.log("PASS Sponsored rewards can only be claimed once per save-week; new weeks and new games work.");
