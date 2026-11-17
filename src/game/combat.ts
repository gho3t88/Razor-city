import { garageEscapeBonus, medicalLosses, rememberEscape, rememberFight, specialistBonus } from "./empire";
import { eventEffects } from "./world-events";
import type { GameState } from "./types";
import type { Result } from "./logic";

export const WEAPONS = [
  { id: "fists", name: "Bare Knuckles", tier: 0, price: 0, level: 1, bonus: 0, description: "Your starting loadout. No equipment bonus." },
  { id: "street_pistol", name: "Street Pistol", tier: 1, price: 1200, level: 1, bonus: .08, description: "An affordable first step up." },
  { id: "revolver", name: "Heavy Revolver", tier: 1, price: 2800, level: 2, bonus: .15, description: "Reliable street muscle." },
  { id: "machine_pistol", name: "Machine Pistol", tier: 2, price: 6500, level: 3, bonus: .24, description: "Compact firepower for a growing crew." },
  { id: "shotgun", name: "Street Sweeper", tier: 2, price: 11000, level: 4, bonus: .32, description: "A shotgun loadout built for block fights." },
  { id: "smg", name: "Nightshift SMG", tier: 3, price: 18000, level: 6, bonus: .42, description: "A serious upgrade for seasoned crews." },
  { id: "carbine", name: "Ironline Carbine", tier: 3, price: 32000, level: 8, bonus: .54, description: "Professional equipment for hard fights." },
  { id: "rifle", name: "Blackout Rifle", tier: 4, price: 55000, level: 10, bonus: .66, description: "Top-end gear for taking rival strongholds." },
  { id: "lmg", name: "Warlord LMG", tier: 5, price: 85000, level: 13, bonus: .8, description: "The black market's most expensive crew loadout." },
] as const;
export type WeaponId = typeof WEAPONS[number]["id"];
export interface Ambush {
  origin: string; destination: string; location: string; attackers: number; triggerAt: number;
}
export interface CombatProfile {
  xp: number; credits: number; equipped: WeaponId; owned: WeaponId[];
  wins: number; losses: number; escapes: number; surrenders: number; ambush: Ambush | null;
}
export const MAX_LEVEL = 20;
export const xpForLevel = (level: number) => Math.max(0, level * (level - 1) * 75);
export const combatOf = (s: GameState): CombatProfile => s.combat ?? { xp: 0, credits: 0, equipped: "fists", owned: ["fists"], wins: 0, losses: 0, escapes: 0, surrenders: 0, ambush: null };
export function levelOf(s: GameState) { let level = 1; while (level < MAX_LEVEL && combatOf(s).xp >= xpForLevel(level + 1)) level++; return level; }
export const weaponOf = (s: GameState) => WEAPONS.find(w => w.id === combatOf(s).equipped) ?? WEAPONS[0];
export const combatMultiplier = (s: GameState) => 1 + weaponOf(s).bonus + (levelOf(s) - 1) * .04 + specialistBonus(s, "power");
export const trainingCost = (s: GameState) => 25 + (levelOf(s) - 1) * 10;
export function combatLog(s: GameState, text: string, tone: "gold" | "paper" | "blood" = "paper") {
  s.log.unshift({ id: ++s.logSeq, week: s.week, text, tone }); s.log = s.log.slice(0, 70);
}
export function grantFightRewards(s: GameState, won: boolean, opponents: number) {
  const c = s.combat ??= structuredClone(combatOf(s)); const before = levelOf(s);
  const xp = won ? 125 + Math.max(1, opponents) * 12 : 40;
  const credits = won ? 8 + Math.min(12, opponents) : 2;
  c.xp = Math.min(xpForLevel(MAX_LEVEL), c.xp + xp); c.credits += credits;
  if (won) c.wins++; else c.losses++;
  rememberFight(s, won);
  combatLog(s, `Fight rewards: +${xp} XP, +${credits} Street Credits.`, "gold");
  if (levelOf(s) > before) combatLog(s, `Level up! Combat level ${levelOf(s)}. New black-market gear may be available.`, "gold");
}
function ready(s: GameState): string | null {
  return s.phase !== "play" ? "Wait until the week is open." : s.cityMap?.order ? "Wait for your crew to finish traveling." : combatOf(s).ambush ? "Resolve the ambush first." : null;
}
export function buyWeapon(state: GameState, id: string): Result {
  const error = ready(state); if (error) return { ok: false, error };
  const w = WEAPONS.find(w => w.id === id);
  if (!w || w.id === "fists") return { ok: false, error: "Choose a black-market weapon." };
  if (combatOf(state).owned.includes(w.id)) return { ok: false, error: "You already own this loadout." };
  if (levelOf(state) < w.level) return { ok: false, error: `Reach combat level ${w.level} to unlock this weapon.` };
  if (state.cash < w.price) return { ok: false, error: "Not enough game cash for that loadout." };
  const s = structuredClone(state); const c = s.combat ??= structuredClone(combatOf(s));
  s.cash -= w.price; s.stats.spent += w.price; c.owned.push(w.id); c.equipped = w.id;
  combatLog(s, `Bought and equipped ${w.name} for $${w.price.toLocaleString("en-US")}.`, "gold");
  return { ok: true, state: s, fx: "cash" };
}
export function equipWeapon(state: GameState, id: string): Result {
  const error = ready(state); if (error) return { ok: false, error };
  if (!WEAPONS.some(w => w.id === id) || !combatOf(state).owned.includes(id as WeaponId)) return { ok: false, error: "Buy this loadout before equipping it." };
  const s = structuredClone(state); const c = s.combat ??= structuredClone(combatOf(s)); c.equipped = id as WeaponId;
  return { ok: true, state: s, fx: "tick" };
}
// paidCredits is supplied only after a durable native wallet debit in the store.
export function trainCombat(state: GameState, paidCredits = 0): Result {
  const error = ready(state); if (error) return { ok: false, error };
  if (levelOf(state) >= MAX_LEVEL) return { ok: false, error: "Maximum combat level reached." };
  const cost = trainingCost(state), earned = Math.min(cost, combatOf(state).credits);
  if (!Number.isSafeInteger(paidCredits) || paidCredits !== cost - earned) return { ok: false, error: `Training requires ${cost} Street Credits. Win fights or visit the credit shop.` };
  const s = structuredClone(state); const c = s.combat ??= structuredClone(combatOf(s));
  c.credits -= earned; c.xp = xpForLevel(levelOf(s) + 1);
  combatLog(s, `Training complete: combat level ${levelOf(s)}. Spent ${cost} Street Credits.`, "gold");
  return { ok: true, state: s, fx: "win" };
}
function roll(s: GameState) { s.seed = (Math.imul(s.seed >>> 0, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; }
export function ambushRisk(s: GameState, route: string[]) {
  const hostile = route.slice(1).filter(id => { const o = s.districts.find(d => d.id === id)?.owner; return o && o !== "player" && o !== "neutral"; }).length;
  const eventRisk = route.slice(1).reduce((n,id)=>n+eventEffects(s,id).risk,0) / Math.max(1,route.length-1);
  const revenge = s.empire?.threats.some(t=>t.status==="pending"&&route.includes(t.region)) ? .08 : 0;
  return Math.max(.02, Math.min(.65, .06 + (route.length - 1) * .025 + hostile * .025 + s.heat * .001 + eventRisk + revenge - specialistBonus(s,"escape")*.5));
}
export function planAmbush(s: GameState, route: string[], now: number, arrivesAt: number): Ambush | undefined {
  if (roll(s) >= ambushRisk(s, route)) return;
  return { origin: route[0], destination: route[route.length - 1], location: route[Math.min(route.length - 1, Math.max(1, Math.floor((route.length - 1) / 2)))], attackers: Math.max(2, Math.min(10, 2 + Math.floor(roll(s) * 3) + Math.floor(s.week / 5))), triggerAt: now + (arrivesAt - now) * .5 };
}
export const escapeChance = (s:GameState) => Math.min(.96, .6 + (levelOf(s)-1)*.015 + specialistBonus(s,"escape") + garageEscapeBonus(s));
export function ambushOutlook(s: GameState) {
  const a = combatOf(s).ambush; if (!a) return "";
  const free = s.crewCounts.muscle - s.districts.reduce((n, d) => n + d.stationMuscle, 0);
  const ratio = (2 + Math.max(0, free)) * combatMultiplier(s) / (a.attackers * (1.05 + s.week * .015));
  return ratio > 1.4 ? "Favored" : ratio > .95 ? "Even" : ratio > .65 ? "Dangerous" : "Outmatched";
}
export function resolveAmbush(state: GameState, choice: "run" | "fight" | "surrender", now = Date.now()): Result {
  const ambush = combatOf(state).ambush;
  if (!ambush || !["run", "fight", "surrender"].includes(choice)) return { ok: false, error: "No ambush is waiting for that choice." };
  if (state.phase !== "play") return { ok: false, error: "Wait until the week is open." };
  const s = structuredClone(state); const c = s.combat!; c.ambush = null;
  const free = Math.max(0, s.crewCounts.muscle - s.districts.reduce((n, d) => n + d.stationMuscle, 0));
  let won = false, report = "";
  function robbery(cashRate: number, stockRate: number) {
    const cash = Math.min(5000, Math.round(s.cash * cashRate)); s.cash -= cash; s.stats.spent += cash;
    let stock = 0;
    for (const p of Object.keys(s.stash) as (keyof GameState["stash"])[]) { const loss = Math.floor(s.stash[p] * stockRate); s.stash[p] -= loss; stock += loss; }
    return `$${cash.toLocaleString("en-US")} and ${stock} unreserved units lost.`;
  }
  if (choice === "fight") {
    won = (2 + free) * combatMultiplier(s) * (.7 + roll(s) * .65) > ambush.attackers * (1.05 + s.week * .015);
    grantFightRewards(s, won, ambush.attackers);
    s.heat = Math.min(100, s.heat + (won ? 6 : 4));
    if (won) { const loot = 400 + ambush.attackers * 180; s.cash += loot; s.stats.earned += loot; report = `Ambush beaten. +$${loot.toLocaleString("en-US")}. Continuing your trip.`; }
    else { const losses = Math.min(free, medicalLosses(s, Math.max(1, Math.floor(ambush.attackers / 3)))); s.crewCounts.muscle -= losses; report = `Ambush lost. ${losses} muscle lost. ${robbery(.12, .2)} Retreated to safety.`; }
  } else if (choice === "run") {
    const escaped = roll(s) < escapeChance(s);
    if (escaped) { c.escapes++; report = "You escaped the ambush and returned to your starting block."; }
    else report = `Escape failed. ${robbery(.08, .12)} You got back to your starting block.`;
  } else { c.surrenders++; report = `You surrendered. ${robbery(.1, .25)} Returned to your starting block.`; }
  if (choice !== "fight") rememberEscape(s, choice);
  combatLog(s, report, won ? "gold" : choice === "run" ? "paper" : "blood");
  if (won) s.cityMap = { locationId: ambush.location, report, order: { kind: "travel", route: [ambush.location, ambush.destination], startedAt: now, arrivesAt: now + 900, endsAt: now + 900, soldiers: 0 } };
  else s.cityMap = { locationId: ambush.origin, order: null, report };
  return { ok: true, state: s, fx: won ? "hit" : "bad" };
}

export function beginAmbushFight(state:GameState,now=Date.now()):Result {
  const a=combatOf(state).ambush;if(!a||state.cityMap?.order||state.phase!=="play")return {ok:false,error:"No ambush is waiting for a fight."};
  const s=structuredClone(state);const free=Math.max(0,s.crewCounts.muscle-s.districts.reduce((n,d)=>n+d.stationMuscle,0));
  s.cityMap={locationId:a.location,report:"Fighting off the ambush…",order:{kind:"ambush",route:[a.location,a.location],startedAt:now,arrivesAt:now,endsAt:now+2600,soldiers:free}};
  s.fightScene={id:`ambush-${s.week}-${s.logSeq}`,kind:"ambush",region:a.location,enemy:"Street attackers",allies:free+2,enemyPower:a.attackers*(1.05+s.week*.015),playerPower:(free+2)*combatMultiplier(s),weapon:weaponOf(s).name,level:levelOf(s),startedAt:now,endsAt:now+2600,status:"active",summary:"Your crew is fighting to get through.",dismissed:false};
  return {ok:true,state:s,fx:"hit"};
}
