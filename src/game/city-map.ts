import { hit, neighborsOf } from "./logic";
import type { Result } from "./logic";
import type { CityMapState, GameState } from "./types";
import { districtPoint } from "./city-geometry";

export const STREET_MS = 900;
export const BATTLE_MS = 3200;

export function cityMapOf(game: GameState): CityMapState {
  return game.cityMap ?? { locationId: game.districts.find(d => d.owner === "player")?.id ?? "hollow", order: null };
}

// The same orthogonal street connections used by the territory rules.
export function streetRoute(game: GameState, from: string, to: string, avoid?: string): string[] {
  if (!game.districts.some(d => d.id === from) || !game.districts.some(d => d.id === to)) return [];
  const queue = [[from]];
  const seen = new Set([from]);
  for (let i = 0; i < queue.length; i++) {
    const route = queue[i];
    const last = route[route.length - 1];
    if (last === to) return route;
    for (const neighbor of neighborsOf(game, last)) {
      if (seen.has(neighbor.id) || neighbor.id === avoid) continue;
      seen.add(neighbor.id);
      queue.push([...route, neighbor.id]);
    }
  }
  return [];
}

export function waypointRoute(game: GameState, stops: string[]): string[] {
  const route = [cityMapOf(game).locationId];
  for (const stop of stops) {
    const leg = streetRoute(game, route[route.length - 1], stop);
    if (!leg.length) return [];
    route.push(...leg.slice(1));
  }
  return route;
}

export function issueCityOrder(game: GameState, stops: string[], soldiers = 0, now = Date.now()): Result {
  const map = cityMapOf(game);
  if (game.phase !== "play") return { ok: false, error: "Wait until the week is open." };
  if (map.order) return { ok: false, error: "Wait for your crew to finish its order." };
  if (!stops.length || stops.length > 6) return { ok: false, error: "Choose up to six waypoints." };
  const attack = soldiers > 0;
  if (!Number.isFinite(soldiers) || soldiers < 0 || !Number.isInteger(soldiers)) return { ok: false, error: "Choose a whole number of soldiers." };
  let route = waypointRoute(game, stops);
  const target = stops[stops.length - 1];
  if (attack) {
    const check = hit(game, target, soldiers);
    if (!check.ok) return check;
    // Enter the target from a player-held border, as the existing attack rules require.
    const approaches = neighborsOf(game, target).filter(d => d.owner === "player")
      .map(d => streetRoute(game, map.locationId, d.id, target)).filter(p => p.length)
      .sort((a, b) => a.length - b.length);
    route = [...(approaches[0] ?? []), target];
  }
  if (!route.length) return { ok: false, error: "No street route to that region." };
  if (!attack && route.length < 2) return { ok: false, error: "Your crew is already there." };
  const arrivesAt = now + Math.max(1, route.length - 1) * STREET_MS;
  const next = structuredClone(game);
  next.cityMap = {
    locationId: map.locationId,
    order: { kind: attack ? "attack" : "travel", route, startedAt: now, arrivesAt, endsAt: arrivesAt + (attack ? BATTLE_MS : 0), soldiers },
  };
  return { ok: true, state: next, fx: "tick" };
}

export function completeCityOrder(game: GameState, now = Date.now()): Result | null {
  const map = cityMapOf(game);
  const order = map.order;
  if (!order || now < order.endsAt) return null;
  const target = order.route[order.route.length - 1];
  const name = game.districts.find(d => d.id === target)?.name ?? target;
  if (order.kind === "travel") {
    const next = structuredClone(game);
    next.cityMap = { locationId: target, order: null, report: `Crew arrived at ${name}.` };
    return { ok: true, state: next, fx: "tick" };
  }
  const result = hit(game, target, order.soldiers);
  if (!result.ok) {
    const next = structuredClone(game);
    next.cityMap = { locationId: map.locationId, order: null, report: result.error };
    return { ok: true, state: next, fx: "bad" };
  }
  const taken = result.state.districts.find(d => d.id === target)?.owner === "player";
  result.state.cityMap = {
    locationId: taken ? target : order.route[Math.max(0, order.route.length - 2)],
    order: null,
    report: taken ? `${name} captured. Your crew holds the streets.` : `Attack repelled at ${name}. Survivors pulled back.`,
  };
  return result;
}

export function crewPoint(game: GameState, now: number): { x: number; y: number } {
  const map = cityMapOf(game);
  const point = (id: string) => {
    const d = game.districts.find(d => d.id === id) ?? game.districts[0];
    return districtPoint(d);
  };
  if (!map.order) return point(map.locationId);
  const { route, startedAt, arrivesAt } = map.order;
  const step = Math.min(route.length - 1, Math.max(0, (now - startedAt) / (arrivesAt - startedAt)) * (route.length - 1));
  const a = point(route[Math.floor(step)]);
  const b = point(route[Math.min(route.length - 1, Math.floor(step) + 1)]);
  const t = step % 1;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
