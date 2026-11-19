import type { GameState } from "./types";
import type { Result } from "./logic";

export interface AfterAction {
  deployed: number;
  survivors: number;
  killed: number;
  wounded: number;
  xpEarned: number;
  creditsEarned: number;
  cashChange: number;
  territory: string;
}
export interface FightScene {
  id: string;
  kind: "block" | "ambush" | "retaliation";
  region: string;
  enemy: string;
  allies: number;
  enemyPower: number;
  playerPower: number;
  weapon: string;
  level: number;
  startedAt: number;
  endsAt: number;
  status: "active" | "won" | "lost";
  summary: string;
  dismissed: boolean;
  afterAction?: AfterAction;
}
export function dismissFight(state: GameState): Result {
  const s = structuredClone(state);
  if (s.fightScene) s.fightScene.dismissed = true;
  return { ok: true, state: s };
}
export function finishFight(s: GameState, won: boolean, summary: string, afterAction?: AfterAction) {
  if (s.fightScene?.status === "active") {
    s.fightScene.status = won ? "won" : "lost";
    s.fightScene.summary = summary;
    if (afterAction) s.fightScene.afterAction = afterAction;
  }
}
