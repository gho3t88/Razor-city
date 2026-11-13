import { combatOf } from "./combat";
import { PRODUCTS, PRODUCT_IDS } from "./content";
import type { GameState, ProductId } from "./types";
import type { Result } from "./logic";

export const CHARACTERS = [
  { id: "marv", name: "Big Marv", role: "Wholesale connector", tile: 0, color: "#b85f73", line: "Big order. Big money. Keep your word and we keep doing business." },
  { id: "nyx", name: "Nyx", role: "Private buyer", tile: 1, color: "#aa82d9", line: "No speeches. Tell me you can deliver, then deliver." },
  { id: "dre", name: "Uncle Dre", role: "Old-school broker", tile: 2, color: "#d6aa62", line: "A name is worth more than a handshake. Let's see what yours is worth." },
  { id: "rico", name: "Rico", role: "Club promoter", tile: 3, color: "#59bdbe", line: "I've got a whole weekend booked. You bring the stock, I bring the money." },
  { id: "jax", name: "Jax", role: "Enforcer", tile: 4, color: "#91ad74", line: "Somebody has to watch the corners." },
  { id: "mina", name: "Mina", role: "Accountant", tile: 5, color: "#d7b65e", line: "I count it twice because you all spend it once." },
  { id: "saint", name: "Saint", role: "Lieutenant", tile: 6, color: "#7caae0", line: "A crew sticks together, or it doesn't last." },
  { id: "taz", name: "Taz", role: "Scout", tile: 7, color: "#e58273", line: "You hear a rumor. I find out if it's real." },
] as const;
export type CharacterId = typeof CHARACTERS[number]["id"];
export const character = (id: CharacterId) => CHARACTERS.find(c => c.id === id)!;
export interface Deal {
  id: string; buyer: CharacterId; product: ProductId; quantity: number; delivered: number;
  payment: number; bonus: 10000; offeredWeek: number; dueWeek: number;
  status: "offered" | "active" | "completed" | "expired" | "declined";
}
export interface TalkChoice { id: string; label: string; detail: string; cash: number; respect: number; loyalty: number; reply: string }
export interface CrewTalk { id: string; title: string; lines: { speaker: CharacterId; text: string }[]; choices: TalkChoice[] }
export interface Encounters {
  nextBuyerAt: number; nextTalkAt: number; lastTalkWeek: number;
  buyerBag: CharacterId[]; lastBuyer?: CharacterId; talkBag: string[]; lastTalk?: string;
  crewBag: CharacterId[];
  deals: Deal[]; pending: { kind: "buyer"; dealId: string } | { kind: "talk"; talk: CrewTalk } | null;
  completed: number;
}
function roll(s: GameState) { s.seed = (Math.imul(s.seed >>> 0, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; }
const delay = (s: GameState, min: number, max: number) => Math.round((min + roll(s) * (max - min)) * 1000);
function initialize(s: GameState, now: number): Encounters {
  return s.encounters ??= { nextBuyerAt: now + delay(s, 35, 65), nextTalkAt: now + delay(s, 80, 120), lastTalkWeek: 0, buyerBag: [], talkBag: [], crewBag: [], deals: [], pending: null, completed: 0 };
}
function log(s: GameState, text: string, tone: "gold" | "paper" | "blood" = "paper") {
  s.log.unshift({ id: ++s.logSeq, week: s.week, text, tone }); s.log = s.log.slice(0, 70);
}
function ready(s: GameState): string | null {
  return combatOf(s).ambush ? "Resolve the ambush first." : s.phase !== "play" ? "Wait until the week is open." : s.cityMap?.order ? "Wait for your crew's order to finish." : null;
}
function success(s: GameState, cash = false): Result { return { ok: true, state: s, fx: cash ? "cash" : "tick" }; }
const fail = (error: string): Result => ({ ok: false, error });

export function tickEncounters(state: GameState, now = Date.now()): Result | null {
  if (ready(state) || state.encounters?.pending) return null;
  if (state.encounters && now < state.encounters.nextBuyerAt && (state.encounters.lastTalkWeek === state.week || now < state.encounters.nextTalkAt)) return null;
  const s = structuredClone(state); const e = initialize(s, now);
  if (now >= e.nextTalkAt && e.lastTalkWeek !== s.week) {
    e.pending = { kind: "talk", talk: makeTalk(s) }; e.lastTalkWeek = s.week;
  } else if (now >= e.nextBuyerAt) {
    e.nextBuyerAt = now + delay(s, 110, 220);
    if (e.deals.filter(d => d.status === "active").length < 3) {
      if (!e.buyerBag.length) e.buyerBag = ["marv", "nyx", "dre", "rico"].filter(id => id !== e.lastBuyer) as CharacterId[];
      const index = Math.floor(roll(s) * e.buyerBag.length);
      const buyer = e.buyerBag.splice(index, 1)[0]; e.lastBuyer = buyer;
      const products = PRODUCT_IDS.filter(p => p !== "ice" || s.cash >= 25000);
      const product = products[Math.floor(roll(s) * products.length)];
      const quantity = Math.max(40, Math.min(240, Math.round(Math.max(12000, s.cash * .65) / s.prices[product].wholesale / 10) * 10));
      const deal: Deal = { id: `deal-${s.week}-${++s.logSeq}`, buyer, product, quantity, delivered: 0, payment: Math.round(quantity * s.prices[product].wholesale * (1.65 + roll(s) * .35)), bonus: 10000, offeredWeek: s.week, dueWeek: s.week + 2 + Math.floor(roll(s) * 3), status: "offered" };
      e.deals = [...e.deals.filter(d => d.status === "active" || d.status === "offered"), ...e.deals.filter(d => d.status !== "active" && d.status !== "offered").slice(-15), deal];
      e.pending = { kind: "buyer", dealId: deal.id };
      log(s, `${character(buyer).name} called with a bulk order for ${quantity} ${PRODUCTS[product].name}.`);
    }
  }
  return success(s);
}

export function decideDeal(state: GameState, id: string, accept: boolean, now = Date.now()): Result {
  const error = ready(state); if (error) return fail(error);
  const s = structuredClone(state); const e = initialize(s, now); const d = e.deals.find(d => d.id === id);
  if (!d || d.status !== "offered") return fail("That offer is no longer available.");
  if (accept && e.deals.filter(d => d.status === "active").length >= 3) return fail("Finish an active deal first. Three deals maximum.");
  if (s.week > d.dueWeek) return fail("That offer has expired.");
  d.status = accept ? "active" : "declined";
  if (e.pending?.kind === "buyer" && e.pending.dealId === id) e.pending = null;
  e.nextBuyerAt = now + delay(s, 110, 220);
  log(s, `${accept ? "Accepted" : "Declined"} ${character(d.buyer).name}'s bulk order.${accept ? ` Due by the end of week ${d.dueWeek}.` : ""}`);
  return success(s);
}

export function deliverDeal(state: GameState, id: string): Result {
  const error = ready(state); if (error) return fail(error);
  const s = structuredClone(state); const e = s.encounters; const d = e?.deals.find(d => d.id === id);
  if (!e || !d || d.status !== "active" || s.week > d.dueWeek) return fail("That deal is not active.");
  const quantity = Math.min(s.stash[d.product], d.quantity - d.delivered);
  if (quantity <= 0) return fail(`You need ${PRODUCTS[d.product].name} in your stash.`);
  s.stash[d.product] -= quantity; d.delivered += quantity;
  if (d.delivered === d.quantity) {
    d.status = "completed"; e.completed++; s.cash += d.payment + d.bonus;
    s.stats.earned += d.payment + d.bonus; s.stats.productSold += d.quantity;
    s.respect = Math.min(100, s.respect + 3);
    log(s, `${character(d.buyer).name}: order complete. $${d.payment.toLocaleString("en-US")} paid + $10,000 completion bonus.`, "gold");
    return success(s, true);
  }
  log(s, `Reserved ${quantity} ${PRODUCTS[d.product].name} for ${character(d.buyer).name} (${d.delivered}/${d.quantity}).`);
  return success(s);
}

// Called after advancing the week. The entire displayed deadline week is playable.
export function advanceEncounters(s: GameState, now = Date.now()) {
  const e = s.encounters; if (!e) return;
  for (const d of e.deals) {
    if ((d.status === "active" || d.status === "offered") && s.week > d.dueWeek) {
      // Incomplete reserved stock returns to the stash; no hidden cash penalty.
      s.stash[d.product] += d.delivered; d.delivered = 0; d.status = "expired";
      log(s, `${character(d.buyer).name}'s deadline passed. Deal lost; reserved stock returned.`, "blood");
      if (e.pending?.kind === "buyer" && e.pending.dealId === d.id) e.pending = null;
    }
  }
  e.nextTalkAt = now + delay(s, 25, 70);
}

function makeTalk(s: GameState): CrewTalk {
  const e = s.encounters!;
  const active = e.deals.find(d => d.status === "active");
  const recent = s.log.filter(l => l.week >= s.week - 1).map(l => l.text).join(" ");
  const scenes = [
    { id: "expansion", title: "More ground, more trouble", lines: [{ speaker: "saint", text: "New streets, new faces. People are starting to say our name." }, { speaker: "jax", text: "Then let's make sure nobody comes to take those streets back." }] },
    { id: "money", title: "The books don't lie", lines: [{ speaker: "mina", text: "We're spending like we own the city. We don't." }, { speaker: "jax", text: "Can't build an empire by staring at a calculator." }, { speaker: "mina", text: "Can't build one with an empty wallet either." }] },
    { id: "deal", title: "Corners or contracts?", lines: [{ speaker: "mina", text: active ? `${character(active.buyer).name} is waiting on ${active.quantity - active.delivered} more ${PRODUCTS[active.product].name}. That bonus is worth planning for.` : "Those big buyers pay well. We should keep some stock ready." }, { speaker: "saint", text: "Just don't forget the people keeping our corners running." }] },
    { id: "losses", title: "An empty chair", lines: [{ speaker: "saint", text: "The crew noticed who didn't come home. They're waiting to hear from you." }, { speaker: "jax", text: "We look after our own. That has to mean something." }] },
    { id: "heat", title: "Eyes on the block", lines: [{ speaker: "taz", text: "Same car went past twice. Maybe nothing. Maybe we stop being so loud." }, { speaker: "jax", text: "Fine by me. I could use one quiet night." }] },
    { id: "banter", title: "Who ate my lunch?", lines: [{ speaker: "mina", text: "Who put 'office supplies' in the ledger for twelve sandwiches?" }, { speaker: "jax", text: "Morale is an office supply." }, { speaker: "taz", text: "Then why did you eat all the morale?" }] },
    { id: "rumor", title: "Word on the street", lines: [{ speaker: "taz", text: "People talk when they think nobody's listening. That's why I listen." }, { speaker: "saint", text: "Bring us something solid before we move. Rumors don't stop bullets." }] },
    { id: "cut", title: "Everybody wants a cut", lines: [{ speaker: "jax", text: "Crew's working hard. They want to know if you've noticed." }, { speaker: "mina", text: "I've noticed the payroll. But a little appreciation wouldn't hurt." }] },
  ] as { id: string; title: string; lines: { speaker: CharacterId; text: string }[] }[];
  // Context first, then a shuffled roster of scenes; rotate the lead speaker too.
  const contextual = active ? "deal" : /Lost \d+ muscle|lose \d+ muscle/.test(recent) ? "losses" : /falls\./.test(recent) ? "expansion" : s.cash < 8000 ? "money" : s.heat >= 40 ? "heat" : null;
  const eligible = scenes.filter(t => t.id === "losses" ? /Lost \d+ muscle|lose \d+ muscle/.test(recent)
    : t.id === "expansion" ? s.stats.blocksTaken > 0
    : t.id === "money" ? s.cash < 8000
    : t.id === "heat" ? s.heat >= 40
    : t.id === "deal" ? !!active : true);
  let scene = contextual && contextual !== e.lastTalk ? eligible.find(t => t.id === contextual) : undefined;
  if (!scene) {
    e.talkBag = e.talkBag.filter(id => eligible.some(t => t.id === id) && id !== e.lastTalk);
    if (!e.talkBag.length) e.talkBag = eligible.map(t => t.id).filter(id => id !== e.lastTalk);
    const id = e.talkBag.splice(Math.floor(roll(s) * e.talkBag.length), 1)[0]; scene = scenes.find(t => t.id === id)!;
  }
  if (!e.crewBag.length) e.crewBag = ["jax", "mina", "saint", "taz"];
  const speaker = e.crewBag.splice(Math.floor(roll(s) * e.crewBag.length), 1)[0];
  if (!scene.lines.some(l => l.speaker === speaker)) scene = { ...scene, lines: [...scene.lines, { speaker, text: character(speaker).line }] };
  e.lastTalk = scene.id;
  return { ...scene, choices: [
    { id: "pay", label: "Look after the crew · $500", detail: "+5 loyalty on your blocks, +1 respect", cash: 500, loyalty: 5, respect: 1, reply: "Saint: You showed up for the crew. They'll remember that." },
    { id: "focus", label: "Keep everyone focused", detail: "+2 respect · no cost", cash: 0, loyalty: 0, respect: 2, reply: "Jax: All right, boss. Back to work." },
    { id: "listen", label: "Hear them out", detail: "+2 loyalty on your blocks · no cost", cash: 0, loyalty: 2, respect: 0, reply: "Mina: Sometimes listening is the smartest move you make all week." },
  ] };
}

export function resolveTalk(state: GameState, choiceId: string): Result {
  const error = ready(state); if (error) return fail(error);
  const talk = state.encounters?.pending;
  if (talk?.kind !== "talk") return fail("Nobody is waiting to talk.");
  const choice = talk.talk.choices.find(c => c.id === choiceId);
  if (!choice) return fail("Choose one of the available replies.");
  if (state.cash < choice.cash) return fail("You don't have $500 to spare.");
  const s = structuredClone(state); s.cash -= choice.cash; s.stats.spent += choice.cash;
  s.respect = Math.min(100, Math.max(0, s.respect + choice.respect));
  for (const d of s.districts) if (d.owner === "player") d.loyalty = Math.min(100, d.loyalty + choice.loyalty);
  s.encounters!.pending = null; log(s, `${talk.talk.title} — ${choice.reply}`);
  return success(s);
}
