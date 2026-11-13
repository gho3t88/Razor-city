import { PRODUCTS, PRODUCT_IDS } from "./content";
import type { District, GameState, ProductId } from "./types";
import type { Result } from "./logic";

export interface LocalQuote {
  sell: number; buy: number; previousSell: number;
  demand: number; buyers: number; supply: number;
}
export interface RegionEconomy {
  week: number; visits: number;
  headline: string; eventProduct: ProductId | null; event: "surge" | "slump" | "steady";
  products: Record<ProductId, LocalQuote>;
}
const limit = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
function randomFor(s: GameState, id: string, salt: string) {
  let n = s.seed >>> 0;
  for (const c of `${id}:${s.week}:${salt}`) n = Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0;
  return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
}
function setPrice(q: LocalQuote, price: number, product: ProductId) {
  q.sell = Math.max(1, Math.round(limit(price, PRODUCTS[product].baseWholesale * .35, PRODUCTS[product].baseWholesale * 9)));
  q.buy = Math.max(q.sell + 1, Math.round(q.sell * 1.13));
}
function generate(s: GameState, d: District, previous?: RegionEconomy): RegionEconomy {
  const rng = randomFor(s, d.id, "weekly");
  const e: RegionEconomy = { week: s.week, visits: 0, headline: "Normal trading. Local prices and demand vary.", event: "steady", eventProduct: null, products: {} as RegionEconomy["products"] };
  for (const product of PRODUCT_IDS) {
    const demand = Math.round(limit(d.demand[product] * (.55 + rng() * 1.05), 8, 100));
    const capacity = Math.round((18 + demand * 1.1) * PRODUCTS[product].volume);
    const q: LocalQuote = { sell: 0, buy: 0, previousSell: previous?.products[product].sell ?? 0, demand, buyers: Math.max(8, capacity), supply: Math.round(18 + rng() * 100) };
    setPrice(q, s.prices[product].street * d.wealth * (.45 + demand / 140) * (.52 + rng() * .95), product);
    if (!previous) q.previousSell = q.sell;
    e.products[product] = q;
  }
  if (rng() < .65) event(e, rng);
  return e;
}
function event(e: RegionEconomy, rng: () => number) {
  const product = PRODUCT_IDS[Math.floor(rng() * PRODUCT_IDS.length)];
  const surge = rng() < .5; const q = e.products[product];
  e.event = surge ? "surge" : "slump"; e.eventProduct = product;
  setPrice(q, q.sell * (surge ? 1.45 + rng() * .45 : .45 + rng() * .25), product);
  q.demand = Math.round(limit(q.demand * (surge ? 1.35 : .6), 5, 100));
  e.headline = surge ? `${PRODUCTS[product].name} shortage—local buyers are paying a premium.` : `${PRODUCTS[product].name} glut—prices have dropped across this region.`;
}

// Reading the board never rolls new prices. Missing legacy markets are derived safely.
export function regionMarket(s: GameState, id: string): RegionEconomy {
  const d = s.districts.find(d => d.id === id);
  if (!d) throw new Error("Unknown market region");
  const existing = s.regionMarkets?.[id];
  return existing?.week === s.week ? existing : generate(s, d, existing);
}
export function refreshRegionMarkets(s: GameState) {
  s.regionMarkets = Object.fromEntries(s.districts.map(d => [d.id, regionMarket(s, d.id)]));
}
export function visitRegionMarket(s: GameState, id: string) {
  const e = structuredClone(regionMarket(s, id));
  e.visits++;
  const rng = randomFor(s, id, `visit-${e.visits}`);
  for (const product of PRODUCT_IDS) {
    const q = e.products[product]; q.previousSell = q.sell;
    const movement = rng() < .5 ? .84 + rng() * .13 : 1.03 + rng() * .17;
    setPrice(q, q.sell * movement, product);
    q.demand = Math.round(limit(q.demand + (rng() - .5) * 18, 5, 100));
  }
  e.event = "steady"; e.eventProduct = null; e.headline = "The market moved while you were away. Fresh quotes on arrival.";
  if (rng() < .3) event(e, rng);
  s.regionMarkets = { ...s.regionMarkets, [id]: e };
}
export function consumeLocalDemand(s: GameState, region: string, product: ProductId, units: number) {
  const e = structuredClone(regionMarket(s, region)); const q = e.products[product];
  q.buyers = Math.max(0, q.buyers - units);
  setPrice(q, q.sell * (1 - Math.min(.12, units / 600)), product);
  s.regionMarkets = { ...s.regionMarkets, [region]: e };
}
export function tradeRegion(state: GameState, region: string, product: ProductId, quantity: number, side: "buy" | "sell"): Result {
  if (state.phase !== "play") return { ok: false, error: "Wait until the week is open." };
  if (state.cityMap?.order) return { ok: false, error: "Finish traveling before trading." };
  const location = state.cityMap?.locationId ?? state.districts.find(d => d.owner === "player")?.id ?? "hollow";
  if (location !== region) return { ok: false, error: "Travel to this region to trade here." };
  if (!state.districts.some(d => d.id === region) || !PRODUCT_IDS.includes(product) || !Number.isSafeInteger(quantity) || quantity < 1 || !["buy", "sell"].includes(side)) return { ok: false, error: "Choose a valid product and whole number of units." };
  const e = structuredClone(regionMarket(state, region)); const q = e.products[product];
  if (side === "sell" && (state.stash[product] < quantity || q.buyers < quantity)) return { ok: false, error: "Your stash or local buyer demand cannot fill that sale." };
  if (side === "buy" && (q.supply < quantity || state.cash < q.buy * quantity)) return { ok: false, error: "Not enough cash or local stock for that purchase." };
  const s = structuredClone(state); const total = quantity * (side === "sell" ? q.sell : q.buy);
  if (side === "sell") {
    s.stash[product] -= quantity; s.cash += total; s.stats.earned += total; s.stats.productSold += quantity;
    const d = s.districts.find(d => d.id === region)!;
    s.heat = Math.min(100, s.heat + quantity * PRODUCTS[product].heat * d.heatMod * .25);
    q.buyers -= quantity; setPrice(q, q.sell * (1 - Math.min(.12, quantity / 600)), product);
  } else {
    s.cash -= total; s.stash[product] += quantity; s.stats.spent += total;
    q.supply -= quantity; setPrice(q, q.sell * (1 + Math.min(.08, quantity / 800)), product);
  }
  s.regionMarkets = { ...s.regionMarkets, [region]: e };
  const d = s.districts.find(d => d.id === region)!;
  s.log.unshift({ id: ++s.logSeq, week: s.week, text: `${side === "sell" ? "Sold" : "Bought"} ${quantity} ${PRODUCTS[product].name} in ${d.name} for $${total.toLocaleString("en-US")}.`, tone: side === "sell" ? "gold" : "mute" });
  s.log = s.log.slice(0, 70);
  return { ok: true, state: s, fx: "cash" };
}
