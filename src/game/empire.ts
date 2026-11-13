import type { GameState, GangId } from "./types";
import type { Result } from "./logic";
import { eventEffects } from "./world-events";
export const FRONT_TYPES = [
  { id: "garage", name: "Auto Garage", price: 6000, income: 850, heat: 1, description: "A steady workshop. Each level also improves escape odds by 3%." },
  { id: "bar", name: "Corner Bar", price: 8000, income: 1200, heat: 2, description: "Neighborhood income and a front that takes pressure off the crew." },
  { id: "club", name: "Nightclub", price: 18000, income: 2600, heat: 3, description: "A high-income front, especially during local club nights." },
] as const;
export type FrontType = typeof FRONT_TYPES[number]["id"];
export interface Business { region: string; type: FrontType; level: number; invested: number; lastPaidWeek: number; totalEarned: number }
export const RECRUITS = [
  { id: "jax", name: "Jax", role: "Enforcer", cost: 4500, wage: 150, description: "Adds fight power. Learns from victories and defeats.", skill: "power" },
  { id: "mina", name: "Mina", role: "Negotiator", cost: 3500, wage: 125, description: "Negotiates higher bulk-order payouts. Learns by completing contracts.", skill: "deals" },
  { id: "saint", name: "Saint", role: "Medic", cost: 3000, wage: 100, description: "Reduces soldier losses in fights. Remembers how you treat the crew.", skill: "medicine" },
  { id: "taz", name: "Taz", role: "Driver", cost: 2200, wage: 75, description: "Improves escape odds and reduces travel ambush risk. Learns on trips.", skill: "escape" },
] as const;
export type RecruitId = typeof RECRUITS[number]["id"];
export interface NamedCrew { id: RecruitId; xp: number; loyalty: number; hiredWeek: number; memories: { week: number; text: string }[] }
export interface Retaliation { id: string; gang: GangId; region: string; dueWeek: number; strength: number; status: "pending" | "paid" | "truce" | "defended" | "lost" | "cancelled"; report?: string }
export interface Empire { businesses: Business[]; crew: NamedCrew[]; threats: Retaliation[]; lastUpkeepWeek: number }
export const empireOf = (s: GameState): Empire => s.empire ?? { businesses: [], crew: [], threats: [], lastUpkeepWeek: 0 };
export const crewLevel = (c: NamedCrew) => Math.min(10, 1 + Math.floor(c.xp / 100));
const init = (s: GameState) => s.empire ??= structuredClone(empireOf(s));
function log(s: GameState, text: string, tone: "gold" | "paper" | "blood" = "paper") { s.log.unshift({ id: ++s.logSeq, week: s.week, text, tone }); s.log = s.log.slice(0, 70); }
function memory(s: GameState, c: NamedCrew, text: string, loyalty = 0, xp = 0) { c.loyalty = Math.min(100, Math.max(0, c.loyalty + loyalty)); c.xp = Math.min(900, c.xp + xp); c.memories.unshift({ week: s.week, text }); c.memories = c.memories.slice(0, 6); }
function ready(s: GameState): string | null { return s.phase !== "play" ? "Wait until the week is open." : s.cityMap?.order || s.combat?.ambush ? "Finish your crew's current order first." : null; }
export function specialistBonus(s: GameState, skill: typeof RECRUITS[number]["skill"]) {
  const def = RECRUITS.find(r => r.skill === skill)!; const c = empireOf(s).crew.find(c => c.id === def.id);
  if (!c || c.loyalty < 20) return 0;
  const scale = (.5 + c.loyalty / 200);
  return (skill === "power" ? .04 : skill === "medicine" ? .12 : skill === "deals" ? .04 : .04) * Math.min(skill === "medicine" ? 3 : 6, crewLevel(c)) * scale;
}
export const medicalLosses = (s: GameState, raw: number) => Math.max(0, Math.round(raw * (1 - specialistBonus(s, "medicine"))));
export function garageEscapeBonus(s: GameState) { return Math.min(.12, empireOf(s).businesses.filter(b => b.type === "garage" && s.districts.find(d => d.id === b.region)?.owner === "player").reduce((n,b) => n + b.level * .03, 0)); }
export function rememberCrewChoice(s: GameState, choice: "pay" | "focus" | "listen") {
  for (const c of empireOf(s).crew) memory(s, c, choice === "pay" ? "You shared the money with us." : choice === "listen" ? "You listened when the crew had something to say." : "You asked us to stay focused on the job.", choice === "pay" ? 8 : choice === "listen" ? 4 : 1, 10);
}
export function rememberFight(s: GameState, won: boolean) { for (const c of empireOf(s).crew) memory(s,c,won ? "We won a fight under your command." : "We lost a fight. The crew is looking to you for the next move.",won ? 3 : -4,won ? 60 : 35); }
export function rememberTravel(s: GameState) { const c = empireOf(s).crew.find(c => c.id === "taz"); if (c) { c.xp = Math.min(900,c.xp+15); } }
export function rememberDeal(s: GameState, buyer: string) { const c = empireOf(s).crew.find(c => c.id === "mina"); if(c) memory(s,c,`We kept our word to ${buyer} and completed the contract.`,3,60); }
export function rememberEscape(s: GameState, decision: string) { for (const c of empireOf(s).crew) memory(s,c,decision === "surrender" ? "You gave up the cargo to keep the crew alive." : "You chose to pull us out of an ambush.",decision === "surrender" ? 2 : 1,c.id === "taz" ? 20 : 5); }
export function buyBusiness(state: GameState, region: string, type: string): Result {
  const error=ready(state);if(error)return {ok:false,error};const def=FRONT_TYPES.find(b=>b.id===type);
  if(!def||state.districts.find(d=>d.id===region)?.owner!=="player")return {ok:false,error:"Capture this region before opening a front."};
  if(empireOf(state).businesses.some(b=>b.region===region))return {ok:false,error:"One business per region. Upgrade your existing front."};
  if(state.ap<1||state.cash<def.price)return {ok:false,error:`Requires one move and $${def.price.toLocaleString("en-US")}.`};
  const s=structuredClone(state);s.ap--;s.cash-=def.price;s.stats.spent+=def.price;init(s).businesses.push({region,type:def.id,level:1,invested:def.price,lastPaidWeek:0,totalEarned:0});
  log(s,`${def.name} opened in ${s.districts.find(d=>d.id===region)!.name}.` ,"gold");return {ok:true,state:s,fx:"cash"};
}
export function upgradeBusiness(state: GameState, region: string): Result {
  const error=ready(state);if(error)return {ok:false,error};const old=empireOf(state).businesses.find(b=>b.region===region);
  if(!old||state.districts.find(d=>d.id===region)?.owner!=="player"||old.level>=3)return {ok:false,error:"Choose an owned business below level 3."};
  const def=FRONT_TYPES.find(b=>b.id===old.type)!;const cost=Math.round(def.price*.7*old.level);
  if(state.ap<1||state.cash<cost)return {ok:false,error:`Requires one move and $${cost.toLocaleString("en-US")}.`};
  const s=structuredClone(state);const b=init(s).businesses.find(b=>b.region===region)!;b.level++;b.invested+=cost;s.ap--;s.cash-=cost;s.stats.spent+=cost;log(s,`${def.name} upgraded to level ${b.level}.`,"gold");return {ok:true,state:s,fx:"cash"};
}
export function recruitSpecialist(state: GameState,id:string):Result {
  const error=ready(state);if(error)return {ok:false,error};const def=RECRUITS.find(c=>c.id===id);
  if(!def||empireOf(state).crew.some(c=>c.id===id))return {ok:false,error:"Choose a specialist who is not already recruited."};
  if(state.ap<1||state.cash<def.cost)return {ok:false,error:`Requires one move and $${def.cost.toLocaleString("en-US")}.`};
  const s=structuredClone(state);s.ap--;s.cash-=def.cost;s.stats.spent+=def.cost;init(s).crew.push({id:def.id,xp:0,loyalty:65,hiredWeek:s.week,memories:[{week:s.week,text:"You gave me a place in the crew."}]});log(s,`${def.name} joined as your ${def.role.toLowerCase()}.`,"gold");return {ok:true,state:s,fx:"tick"};
}
export function supportSpecialist(state:GameState,id:string):Result {
  const error=ready(state);if(error)return {ok:false,error};if(state.cash<500||!empireOf(state).crew.some(c=>c.id===id))return {ok:false,error:"Requires a recruited specialist and $500."};
  const s=structuredClone(state);s.cash-=500;s.stats.spent+=500;const c=init(s).crew.find(c=>c.id===id)!;memory(s,c,"You paid a personal bonus and looked after me.",15);log(s,`${RECRUITS.find(r=>r.id===id)!.name} appreciated the $500 bonus.`);return {ok:true,state:s,fx:"cash"};
}
export function businessIncome(s:GameState,b:Business) { const def=FRONT_TYPES.find(d=>d.id===b.type)!;return s.districts.find(d=>d.id===b.region)?.owner==="player"?Math.round(def.income*b.level*eventEffects(s,b.region).income):0; }
export function applyEmpireWeek(s:GameState) {
  const e=s.empire;if(!e)return;
  let income=0,heat=0;for(const b of e.businesses){if(b.lastPaidWeek===s.week)continue;b.lastPaidWeek=s.week;const earned=businessIncome(s,b);if(!earned)continue;b.totalEarned+=earned;income+=earned;heat+=FRONT_TYPES.find(d=>d.id===b.type)!.heat*b.level;}
  if(income){s.cash+=income;s.stats.earned+=income;s.heat=Math.max(0,s.heat-Math.min(10,heat));log(s,`Businesses paid $${income.toLocaleString("en-US")} and reduced heat by ${Math.min(10,heat)}.`,"gold");}
  if(e.lastUpkeepWeek===s.week)return;e.lastUpkeepWeek=s.week;
  for(const c of e.crew){const wage=RECRUITS.find(r=>r.id===c.id)!.wage;if(s.cash>=wage){s.cash-=wage;s.stats.spent+=wage;c.loyalty=Math.min(100,c.loyalty+1);c.xp=Math.min(900,c.xp+10);}else memory(s,c,"You couldn't cover my weekly pay.",-12);}
  if(e.crew.length)log(s,`Named crew payroll: $${e.crew.reduce((n,c)=>n+RECRUITS.find(r=>r.id===c.id)!.wage,0)} scheduled. Low loyalty weakens specialist skills.`);
}
function roll(s:GameState){s.seed=(Math.imul(s.seed>>>0,1664525)+1013904223)>>>0;return s.seed/4294967296;}
export function queueRetaliation(s:GameState,gang:GangId,region:string){
  if(roll(s)>.7)return;const e=init(s);if(e.threats.some(t=>t.gang===gang&&t.status==="pending"))return;
  const threat:Retaliation={id:`revenge-${s.week}-${s.logSeq}-${gang}`,gang,region,dueWeek:s.week+1+Math.floor(roll(s)*2),strength:Math.max(10,Math.round(s.gangs[gang].muscle*1.6+s.week*.5)),status:"pending"};
  e.threats=[...e.threats.filter(t=>t.status==="pending"),...e.threats.filter(t=>t.status!=="pending").slice(-10),threat];log(s,`${s.gangs[gang].name}: "You took ${s.districts.find(d=>d.id===region)!.name}. We'll be back." Counterattack due at the end of week ${threat.dueWeek}.`,"blood");
}
export const hasThreat=(s:GameState,gang:GangId)=>empireOf(s).threats.some(t=>t.gang===gang&&t.status==="pending");
export const threatPayoff=(t:Retaliation)=>2000+t.strength*100;
export function payOffThreat(state:GameState,id:string):Result {
  const error=ready(state);if(error)return {ok:false,error};const t=empireOf(state).threats.find(t=>t.id===id&&t.status==="pending");if(!t)return {ok:false,error:"That threat is no longer active."};const cost=threatPayoff(t);
  if(state.cash<cost||state.ap<1)return {ok:false,error:`Requires one move and $${cost.toLocaleString("en-US")}.`};const s=structuredClone(state);const next=init(s).threats.find(t=>t.id===id)!;next.status="paid";next.report="You paid off the counterattack and secured a two-week truce.";s.gangs[t.gang].truceWeeks=Math.max(2,s.gangs[t.gang].truceWeeks);s.cash-=cost;s.stats.spent+=cost;s.ap--;log(s,`${s.gangs[t.gang].name} called off their counterattack for $${cost.toLocaleString("en-US")}.`);return {ok:true,state:s,fx:"cash"};
}
export function resolveRetaliations(s:GameState,rng:()=>number,capture:(gang:GangId,region:string)=>void,onBattle:(won:boolean,strength:number,region:string,gang:GangId)=>void){
 const acted=new Set<GangId>();for(const t of empireOf(s).threats){if(t.status!=="pending")continue;const gang=s.gangs[t.gang];const d=s.districts.find(d=>d.id===t.region)!;
 if(gang.truceWeeks>0){t.status="truce";t.report="A truce stopped the attack.";log(s,`${gang.name} honored their truce and cancelled the counterattack.`);continue;}
 if(d.owner!=="player"||!gang.alive){t.status="cancelled";t.report="The target or rival crew is no longer available.";continue;}
 if(t.dueWeek>s.week)continue;acted.add(t.gang);const won=d.defense*(.9+specialistBonus(s,"power"))>=t.strength*(.82+rng()*.4);
 t.status=won?"defended":"lost";t.report=won?`${d.name} held against ${gang.name}.`:`${gang.name} recaptured ${d.name}.`;
 onBattle(won,t.strength,t.region,t.gang);if(!won)capture(t.gang,t.region);else gang.muscle=Math.max(1,gang.muscle-2);log(s,t.report,won?"gold":"blood");
 }return acted;
}
