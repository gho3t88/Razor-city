import type { GameState } from "./types";
import type { Result } from "./logic";
import { refreshDefense } from "./logic";

export const TERRITORY_UPGRADES = {
  cameras: { label: "Surveillance cameras", cost: 1500, defense: 8, max: 3 },
  barracks: { label: "Crew barracks", cost: 2500, defense: 6, max: 3 },
} as const;
export type TerritoryUpgrade = keyof typeof TERRITORY_UPGRADES;
export function territoryCost(kind: TerritoryUpgrade, level: number) {
  return TERRITORY_UPGRADES[kind].cost * (level + 1);
}
export function upgradeTerritory(state: GameState, id: string, kind: TerritoryUpgrade): Result {
  const d = state.districts.find(d => d.id === id);
  const def = TERRITORY_UPGRADES[kind];
  if (!d || !def || d.owner !== "player") return { ok: false, error: "Only your controlled blocks can be upgraded." };
  if (state.phase !== "play" || state.cityMap?.order || state.combat?.ambush)
    return { ok: false, error: "Finish your current order before upgrading a territory." };
  const level = d[kind] ?? 0;
  if (level >= def.max) return { ok: false, error: "This upgrade is already at maximum level." };
  const cost = territoryCost(kind, level);
  if (state.cash < cost || state.ap < 1) return { ok: false, error: "Not enough cash or moves for this upgrade." };
  const s = structuredClone(state);
  const target = s.districts.find(d => d.id === id)!;
  target[kind] = level + 1;
  s.cash -= cost; s.stats.spent += cost; s.ap--;
  refreshDefense(s);
  s.log.unshift({ id: ++s.logSeq, week: s.week, tone: "gold", text: `${def.label} upgraded to level ${level + 1} in ${target.name} for $${cost.toLocaleString("en-US")}.` });
  s.log = s.log.slice(0, 70);
  return { ok: true, state: s, fx: "cash" };
}
