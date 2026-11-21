/** Keep sponsor bonuses relevant without destabilizing early game progression. */
export function sponsorRewardForLevel(level: number): number {
  if (!Number.isFinite(level) || level <= 3) return 500;
  if (level <= 6) return 1000;
  if (level <= 10) return 2500;
  if (level <= 15) return 5000;
  return 10000;
}
