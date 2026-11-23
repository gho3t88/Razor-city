import { cityMapOf } from "./city-map";
import { combatOf } from "./combat";
import type { GameState } from "./types";

/** Persist rewards on the save, not a device-wide week key shared by different runs. */
export function sponsorBonusClaimed(game: GameState): boolean {
  return game.sponsorBonusWeek === game.week;
}

export function canClaimSponsorBonus(game: GameState): boolean {
  return game.phase === "play"
    && !combatOf(game).ambush
    && !cityMapOf(game).order
    && !sponsorBonusClaimed(game);
}

/** Called only after the native ad SDK confirms the earned reward. */
export function applySponsorBonus(game: GameState): GameState | null {
  if (!canClaimSponsorBonus(game)) return null;
  return { ...game, sponsorBonusWeek: game.week, cash: game.cash + 1000 };
}
