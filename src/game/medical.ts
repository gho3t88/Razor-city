import type { GameState } from "./types";
import type { Result } from "./logic";

export const TREATMENT_COST = 350;
/** Clinics lower treatment expense and extend the recovery window. */
export function clinicLevel(s: GameState): number {
  return s.districts.reduce((sum,d) => sum + (d.owner === "player" ? (d.clinic ?? 0) : 0), 0);
}
export function treatmentCostPerSoldier(s: GameState): number {
  return Math.round(TREATMENT_COST * (1 - Math.min(0.5, clinicLevel(s) * 0.1)));
}
export const woundGraceWeeks = (s: GameState): number => clinicLevel(s) > 0 ? 2 : 1;

/** Convert battlefield casualties into deaths and survivors needing treatment.
 * Wounded soldiers are removed from active strength until treated. */
export function applyCasualties(s: GameState, casualties: number): { dead: number; wounded: number } {
  const count = Math.max(0, Math.min(s.crewCounts.muscle, Math.floor(casualties)));
  const wounded = Math.floor(count / 2);
  const dead = count - wounded;
  s.crewCounts.muscle -= count;
  if (wounded) {
    const current = s.wounded?.count ?? 0;
    s.wounded = { count: current + wounded, sinceWeek: Math.min(s.wounded?.sinceWeek ?? s.week, s.week) };
  }
  return { dead, wounded };
}

export function treatWounded(state: GameState, count: number): Result {
  if (state.phase !== "play" || state.cityMap?.order || state.combat?.ambush)
    return { ok: false, error: "Finish the current order before treating soldiers." };
  if (!Number.isSafeInteger(count) || count < 1 || count > (state.wounded?.count ?? 0))
    return { ok: false, error: "Choose an available wounded soldier." };
  const cost = count * treatmentCostPerSoldier(state);
  if (state.cash < cost) return { ok: false, error: "Not enough game cash for treatment." };
  const s = structuredClone(state);
  s.cash -= cost; s.stats.spent += cost;
  s.crewCounts.muscle += count;
  s.wounded!.count -= count;
  if (!s.wounded!.count) s.wounded = undefined;
  s.log.unshift({ id: ++s.logSeq, week: s.week, tone: "gold", text: `Treated ${count} wounded soldier${count === 1 ? "" : "s"} for $${cost.toLocaleString("en-US")}. Returned to active duty.` });
  s.log = s.log.slice(0, 70);
  return { ok: true, state: s, fx: "cash" };
}

/** Untreated soldiers have one week to receive care. */
export function expireWounded(s: GameState): number {
  if (!s.wounded?.count || s.week < s.wounded.sinceWeek + woundGraceWeeks(s)) return 0;
  const lost = s.wounded.count;
  s.wounded = undefined;
  s.log.unshift({ id: ++s.logSeq, week: s.week, tone: "blood", text: `${lost} untreated wounded soldier${lost === 1 ? "" : "s"} died. Treat casualties before the recovery deadline.` });
  s.log = s.log.slice(0, 70);
  return lost;
}
