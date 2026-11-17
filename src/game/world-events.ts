import type { GameState, ProductId } from "./types";
export type RegionEventKind = "lockdown" | "festival" | "clubnight" | "blackout";
export interface RegionEvent { week: number; kind: RegionEventKind; name: string; description: string }
const definitions: Record<RegionEventKind, { name: string; description: string }> = {
  lockdown: { name: "Police lockdown", description: "Extra patrols: fewer buyers, lower prices and more dangerous travel. Sales create extra heat." },
  festival: { name: "Street festival", description: "Crowds boost Dust and Grow demand, local businesses and selling prices." },
  clubnight: { name: "Club night", description: "Velvet and Black Ice are in demand. Nightclubs earn more, but the streets are busier and riskier." },
  blackout: { name: "Rolling blackout", description: "Supply disruptions push prices up. Businesses slow down and travel becomes more dangerous." },
};
export function regionEvent(s: GameState, id: string): RegionEvent | null {
  if (s.regionEvents?.week === s.week) return s.regionEvents.events[id] ?? null;
  let n = s.seed >>> 0;
  for (const c of `${s.week}:${id}:event`) n = Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0;
  const roll = () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
  if (roll() > .42) return null;
  const kind = (["lockdown", "festival", "clubnight", "blackout"] as const)[Math.floor(roll() * 4)];
  return { week: s.week, kind, ...definitions[kind] };
}
export function refreshRegionEvents(s: GameState) {
  const events = Object.fromEntries(s.districts.map(d => [d.id, regionEvent(s, d.id)]));
  s.regionEvents = { week: s.week, events };
}
export function eventEffects(s: GameState, id: string, product?: ProductId) {
  const kind = regionEvent(s, id)?.kind;
  if (kind === "lockdown") return { price: .85, demand: .55, risk: .12, heat: 1.5, income: .65 };
  if (kind === "festival") return { price: product === "dust" || product === "grow" ? 1.25 : 1.08, demand: product === "dust" || product === "grow" ? 1.4 : 1.1, risk: .02, heat: 1.1, income: 1.25 };
  if (kind === "clubnight") return { price: product === "velvet" ? 1.55 : product === "ice" ? 1.3 : 1, demand: product === "velvet" || product === "ice" ? 1.6 : 1, risk: .06, heat: 1.2, income: 1.4 };
  if (kind === "blackout") return { price: 1.15, demand: .8, risk: .1, heat: .8, income: .75 };
  return { price: 1, demand: 1, risk: 0, heat: 1, income: 1 };
}
