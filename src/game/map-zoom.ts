export const MIN_MAP_ZOOM = 1;
export const MAX_MAP_ZOOM = 2.6;
export function clampMapZoom(value: number): number {
  if (!Number.isFinite(value)) return MIN_MAP_ZOOM;
  return Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, Math.round(value * 100) / 100));
}
export function pinchZoomTarget(startZoom: number, startDistance: number, distance: number): number {
  if (!Number.isFinite(startDistance) || startDistance <= 0 || !Number.isFinite(distance) || distance <= 0) return clampMapZoom(startZoom);
  return clampMapZoom(startZoom * distance / startDistance);
}
