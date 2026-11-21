/** The input may be blank during editing; never submit a blank or zero quantity. */
export function validTradeQuantity(raw: string): boolean {
  if (!/^\d{1,4}$/.test(raw)) return false;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 1 && n <= 9999;
}
export function normalizeTradeQuantity(raw: string): string {
  if (!raw.trim()) return "1";
  const n = Number(raw);
  return String(Number.isFinite(n) ? Math.max(1, Math.min(9999, Math.floor(n))) : 1);
}
