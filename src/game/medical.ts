import type { GameState } from "./types";
import type { Result } from "./logic";

// Casualties leave the active soldier count immediately. Wounded may return
// if treated before the end of their deadline week; deaths are permanent.
export const TREATMENT_COST = 450;
export const SOLDIER_CAP = 40;
export interface WoundGroup { count: number; dueWeek: number }
export interface MedicalRecord {
  wounded: WoundGroup[];
  killed: number;
  recovered: number;
  untreatedDeaths: number;
}
export interface Casualties { killed: number; wounded: number; survivors: number }
export function medicalOf(s: GameState): MedicalRecord {
  return s.medical ?? { wounded: [], killed: 0, recovered: 0, untreatedDeaths: 0 };
}
export const woundedCount = (s: GameState) => medicalOf(s).wounded.reduce((n, group) => n + group.count, 0);

// 'losses' is the already-computed combat loss from the existing battle rules.
// Retain deterministic outcomes so a saved battle cannot reroll injuries.
export function recordCasualties(s: GameState, deployed: number, losses: number, won: boolean): Casualties {
  const taken = Math.min(Math.max(0, Math.trunc(deployed)), Math.max(0, Math.trunc(losses)));
  const killed = taken >= 2
    ? Math.max(1, Math.min(taken - 1, Math.floor(taken * (won ? .3 : .55))))
    : taken === 1 && !won && (s.seed & 1) === 1 ? 1 : 0;
  const wounded = taken - killed;
  const record = s.medical ??= structuredClone(medicalOf(s));
  record.killed += killed;
  if (wounded) {
    const group = record.wounded.find(g => g.dueWeek === s.week + 1);
    if (group) group.count += wounded;
    else record.wounded.push({ count: wounded, dueWeek: s.week + 1 });
  }
  return { killed, wounded, survivors: Math.max(0, deployed - taken) };
}

export function treatWounded(state: GameState, count: number): Result {
  if (state.phase !== "play") return { ok: false, error: "Wait until the next playable week." };
  if (state.cityMap?.order || state.combat?.ambush) return { ok: false, error: "Finish the current combat or travel order first." };
  if (!Number.isSafeInteger(count) || count <= 0) return { ok: false, error: "Choose how many wounded soldiers to treat." };
  if (woundedCount(state) < count) return { ok: false, error: "There aren't that many wounded soldiers." };
  if (state.crewCounts.muscle + count > SOLDIER_CAP) return { ok: false, error: "Your active soldier roster is full." };
  const cost = count * TREATMENT_COST;
  if (state.cash < cost) return { ok: false, error: "Not enough game cash for treatment." };
  const next = structuredClone(state);
  const medical = next.medical ??= structuredClone(medicalOf(next));
  let remaining = count;
  for (const group of medical.wounded.sort((a, b) => a.dueWeek - b.dueWeek)) {
    const toHeal = Math.min(remaining, group.count);
    group.count -= toHeal;
    remaining -= toHeal;
    if (!remaining) break;
  }
  medical.wounded = medical.wounded.filter(g => g.count > 0);
  medical.recovered += count;
  next.crewCounts.muscle += count;
  next.cash -= cost;
  next.stats.spent += cost;
  next.log.unshift({ id: ++next.logSeq, week: next.week, text: `Medics patched up ${count} wounded soldiers for $${cost.toLocaleString("en-US")}.`, tone: "gold" });
  next.log = next.log.slice(0, 70);
  return { ok: true, state: next, fx: "cash" };
}

// Call only after advancing the week number. Patients are lost once their
// due week has passed; a new week's start is the last chance for treatment.
export function expireUntreated(s: GameState): number {
  if (!s.medical) return 0;
  let deaths = 0;
  s.medical.wounded = s.medical.wounded.filter(group => {
    if (group.dueWeek >= s.week) return true;
    deaths += group.count;
    return false;
  });
  if (deaths) {
    s.medical.untreatedDeaths += deaths;
    s.medical.killed += deaths;
    s.log.unshift({ id: ++s.logSeq, week: s.week, text: `${deaths} untreated wounded soldiers died before medics could save them.`, tone: "blood" });
    s.log = s.log.slice(0, 70);
  }
  return deaths;
}
