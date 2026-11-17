import type { GameState } from "./types";
import type { Result } from "./logic";
export interface FightScene {
  id:string;kind:"block"|"ambush"|"retaliation";region:string;enemy:string;allies:number;enemyPower:number;playerPower:number;
  weapon:string;level:number;startedAt:number;endsAt:number;status:"active"|"won"|"lost";summary:string;dismissed:boolean;
}
export function dismissFight(state:GameState):Result {const s=structuredClone(state);if(s.fightScene)s.fightScene.dismissed=true;return {ok:true,state:s};}
export function finishFight(s:GameState,won:boolean,summary:string){if(s.fightScene?.status==="active"){s.fightScene.status=won?"won":"lost";s.fightScene.summary=summary;}}
