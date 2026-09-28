import { GANG_IDS, PRODUCTS, PRODUCT_IDS, WIN_BLOCKS, WIN_RESPECT, WIN_WORTH, makeDistricts, makeGangs } from "@/game/content";
import type {
  ChoiceEvent,
  Difficulty,
  District,
  Fx,
  GameState,
  Gang,
  GangId,
  LogLine,
  Owner,
  ProductId,
  SaleLine,
  StartOpts,
  Tone,
} from "@/game/types";

export type Result = { ok: true; state: GameState; fx?: Fx } | { ok: false; error: string };

const SAVE_VERSION = 1 as const;

export function money(n: number): string {
  const v = Math.round(n);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString("en-US")}`;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function nextRoll(seed: number): { seed: number; roll: number } {
  const a = (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
  return { seed: a, roll: a / 4294967296 };
}

function clone(state: GameState): GameState {
  return structuredClone(state);
}

function roller(state: GameState): () => number {
  return () => {
    const n = nextRoll(state.seed);
    state.seed = n.seed;
    return n.roll;
  };
}

function pushLog(state: GameState, text: string, tone: Tone): LogLine {
  state.logSeq += 1;
  const line: LogLine = { id: state.logSeq, week: state.week, text, tone };
  state.log.unshift(line);
  if (state.log.length > 70) state.log.length = 70;
  return line;
}

export function districtById(state: GameState, id: string): District | undefined {
  return state.districts.find((d) => d.id === id);
}

export function neighborsOf(state: GameState, id: string): District[] {
  const d = districtById(state, id);
  if (!d) return [];
  return state.districts.filter(
    (o) => o.id !== id && Math.abs(o.col - d.col) + Math.abs(o.row - d.row) === 1,
  );
}

export function playerBlocks(state: GameState): District[] {
  return state.districts.filter((d) => d.owner === "player");
}

export function isGangId(owner: Owner): owner is GangId {
  return owner !== "player" && owner !== "neutral";
}

export function stationedMuscle(state: GameState): number {
  return state.districts.reduce((sum, d) => sum + (d.owner === "player" ? d.stationMuscle : 0), 0);
}

export function stationedDealers(state: GameState): number {
  return state.districts.reduce((sum, d) => sum + (d.owner === "player" ? d.stationDealers : 0), 0);
}

export function freeMuscle(state: GameState): number {
  return Math.max(0, state.crewCounts.muscle - stationedMuscle(state));
}

export function freeDealers(state: GameState): number {
  return Math.max(0, state.crewCounts.dealers - stationedDealers(state));
}

export function adjacentToPlayer(state: GameState, id: string): boolean {
  return neighborsOf(state, id).some((n) => n.owner === "player");
}

export function playerDefense(d: District): number {
  return 6 + d.stationMuscle * 7 + d.corners * 4 + Math.round(d.loyalty / 12);
}

export function refreshDefense(state: GameState) {
  for (const d of state.districts) {
    if (d.owner === "player") d.defense = playerDefense(d);
    else if (isGangId(d.owner)) {
      const g = state.gangs[d.owner];
      const home = d.id === g.home ? 16 : 0;
      d.defense = Math.round(10 + g.muscle * 0.7 + home);
    }
  }
}

function clampStations(state: GameState) {
  let muscleLeft = state.crewCounts.muscle;
  let dealersLeft = state.crewCounts.dealers;
  for (const d of state.districts) {
    if (d.owner !== "player") {
      d.stationMuscle = 0;
      d.stationDealers = 0;
      continue;
    }
    d.stationMuscle = clamp(d.stationMuscle, 0, muscleLeft);
    muscleLeft -= d.stationMuscle;
    d.stationDealers = clamp(d.stationDealers, 0, dealersLeft);
    dealersLeft -= d.stationDealers;
  }
}

export function netWorth(state: GameState): number {
  let stash = 0;
  for (const id of PRODUCT_IDS) stash += state.stash[id] * state.prices[id].wholesale;
  return Math.round(state.cash + stash + playerBlocks(state).length * 15000);
}

export function relationWord(n: number, truceWeeks: number): string {
  if (truceWeeks > 0 && n > -20) return "Truce";
  if (n < -60) return "War";
  if (n < -35) return "Hostile";
  if (n < -15) return "Cold";
  if (n < 20) return "Wary";
  return "Quiet";
}

export function wealthWord(wealth: number): string {
  if (wealth < 0.9) return "Lean";
  if (wealth < 1.25) return "Steady";
  return "Rich";
}

export function heatWord(mod: number): string {
  if (mod < 0.92) return "Quiet";
  if (mod < 1.2) return "Watched";
  return "Lit";
}

export function aliveGangs(state: GameState): Gang[] {
  return GANG_IDS.map((id) => state.gangs[id]).filter((g) => g.alive);
}

export function victoryReason(state: GameState): string | null {
  if (playerBlocks(state).length >= WIN_BLOCKS) {
    return `You hold ${WIN_BLOCKS} blocks. The city answers to ${state.crew}.`;
  }
  if (GANG_IDS.every((id) => !state.gangs[id].alive)) {
    return "Every rival banner is gone. The streets are yours alone.";
  }
  if (netWorth(state) >= WIN_WORTH && state.respect >= WIN_RESPECT) {
    return `The books say ${state.boss} is untouchable.`;
  }
  return null;
}

export function defeatReason(state: GameState): string | null {
  if (state.strikes >= 3) return "Three raids. The task force closes the book on you.";
  if (playerBlocks(state).length === 0 && state.crewCounts.muscle <= 1 && state.cash < 2000) {
    return "No blocks, no crew, no cash. The city forgets your name.";
  }
  return null;
}

function finish(state: GameState, fx?: Fx): Result {
  const before = state.phase;
  if (state.phase === "play") {
    const win = victoryReason(state);
    if (win) {
      state.phase = "won";
      state.ending = win;
    }
  }
  refreshDefense(state);
  let out = fx;
  if (state.phase === "won" && before !== "won") out = "win";
  if (state.phase === "lost" && before !== "lost") out = "raid";
  return { ok: true, state, fx: out };
}

function fail(error: string): Result {
  return { ok: false, error };
}

function spendAp(state: GameState): string | null {
  if (state.phase !== "play") return "Wait until the week is open.";
  if (state.ap < 1) return "No moves left. Close the week.";
  state.ap -= 1;
  return null;
}

export function fortifyCost(corners: number): number | null {
  if (corners <= 0) return 2600;
  if (corners === 1) return 2600;
  if (corners === 2) return 6400;
  return null;
}

export function moveInCost(d: District): number {
  return Math.round(1600 + d.wealth * 3200);
}

export function bribeCost(state: GameState): number {
  return 1000 + Math.round(state.heat) * 45;
}

export function truceCost(g: Gang): number {
  return 2200 + Math.round(Math.max(0, -g.relation) * 28);
}

function releaseCrew(state: GameState, d: District, muscleKeep: number, dealerKeep: number) {
  const muscleLoss = d.stationMuscle - Math.round(d.stationMuscle * muscleKeep);
  const dealerLoss = d.stationDealers - Math.round(d.stationDealers * dealerKeep);
  state.crewCounts.muscle = Math.max(0, state.crewCounts.muscle - Math.max(0, muscleLoss));
  state.crewCounts.dealers = Math.max(0, state.crewCounts.dealers - Math.max(0, dealerLoss));
  d.stationMuscle = 0;
  d.stationDealers = 0;
}

function giveBlockToPlayer(state: GameState, d: District, loyalty: number, muscle: number, dealers: number) {
  d.owner = "player";
  d.corners = Math.max(1, d.corners || 1);
  d.loyalty = loyalty;
  d.focus = "auto";
  d.stationMuscle = 0;
  d.stationDealers = 0;
  clampStations(state);
  const fm = freeMuscle(state);
  const fd = freeDealers(state);
  d.stationMuscle = Math.min(muscle, fm);
  d.stationDealers = Math.min(dealers, fd);
  state.stats.blocksTaken += 1;
  state.respect = clamp(state.respect + 3, 0, 100);
}

export function quoteDistrict(state: GameState, d: District, stash: Record<ProductId, number>): SaleLine | null {
  if (d.owner !== "player" || d.stationDealers < 1 || d.loyalty <= 0) return null;
  const ranked = [...PRODUCT_IDS].sort((a, b) => {
    const score = (p: ProductId) => state.prices[p].street * (d.demand[p] / 100) * PRODUCTS[p].volume;
    return score(b) - score(a);
  });
  const order = d.focus === "auto" ? ranked : [d.focus, ...ranked.filter((p) => p !== d.focus)];
  for (const product of order) {
    const demand = d.demand[product];
    if (demand < 18 && d.focus !== product) continue;
    if (stash[product] <= 0) continue;
    let cap = Math.round(
      (3 + d.stationDealers * 5) *
        Math.max(1, d.corners) *
        (0.4 + demand / 140) *
        (0.62 + d.loyalty / 220) *
        PRODUCTS[product].volume,
    );
    if (state.bonus && state.bonus.weeks > 0 && state.bonus.product === product) {
      cap = Math.round(cap * state.bonus.mult);
    }
    cap = Math.max(0, cap);
    const units = Math.min(stash[product], cap);
    if (units < 1) continue;
    const heatTax = state.heat >= 80 ? 0.78 : state.heat >= 60 ? 0.9 : 1;
    const unit = state.prices[product].street * d.wealth * (0.58 + d.loyalty / 200) * heatTax;
    const cash = Math.max(1, Math.round(units * unit));
    const heat = units * PRODUCTS[product].heat * d.heatMod * 0.42;
    return { districtId: d.id, district: d.name, product, units, cash, heat };
  }
  return null;
}

export function previewSales(state: GameState): { lines: SaleLine[]; cash: number; heat: number } {
  const stash = { ...state.stash };
  const lines: SaleLine[] = [];
  for (const d of state.districts) {
    const q = quoteDistrict(state, d, stash);
    if (!q) continue;
    stash[q.product] -= q.units;
    lines.push(q);
  }
  const cash = lines.reduce((s, l) => s + l.cash, 0);
  const heat = lines.reduce((s, l) => s + l.heat, 0);
  return { lines, cash, heat };
}

export function hitOutlook(state: GameState, districtId: string, commit: number): string {
  const d = districtById(state, districtId);
  if (!d) return "";
  const mid = commit * (5.5 + state.respect / 30);
  const ratio = mid / Math.max(1, d.defense);
  if (ratio > 1.35) return "Favored";
  if (ratio > 0.95) return "Even";
  if (ratio > 0.7) return "Bloody";
  return "Suicide";
}

function cleanName(raw: string, fallback: string, max: number): string {
  const t = raw.replace(/\s+/g, " ").trim().slice(0, max);
  return t.length ? t : fallback;
}

export function createGame(opts: StartOpts): GameState {
  const seed = opts.seed && opts.seed > 0 ? opts.seed >>> 0 : ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0) || 1;
  const prices = {} as GameState["prices"];
  for (const id of PRODUCT_IDS) {
    const p = PRODUCTS[id];
    const wholesale = p.baseWholesale;
    prices[id] = { wholesale, street: Math.round(wholesale * p.markup) };
  }
  const difficulty: Difficulty = opts.difficulty === "war" ? "war" : "street";
  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    logSeq: 0,
    difficulty,
    boss: cleanName(opts.boss, "Reyes", 18),
    crew: cleanName(opts.crew, "Hollow Kings", 22),
    week: 1,
    phase: "play",
    cash: difficulty === "war" ? 12000 : 15400,
    heat: difficulty === "war" ? 18 : 8,
    respect: 16,
    strikes: 0,
    ap: 3,
    maxAp: 3,
    apPenalty: 0,
    loud: false,
    crewCounts: { muscle: difficulty === "war" ? 5 : 6, dealers: 3 },
    stash: { dust: 16, velvet: 0, ice: 0, grow: 8 },
    prices,
    districts: makeDistricts(),
    gangs: makeGangs(),
    log: [],
    selectedId: "hollow",
    pending: null,
    report: null,
    bonus: null,
    ending: "",
    stats: { earned: 0, spent: 0, blocksTaken: 0, raids: 0, productSold: 0 },
  };
  if (difficulty === "war") {
    for (const id of GANG_IDS) state.gangs[id].muscle = Math.round(state.gangs[id].muscle * 1.3);
  }
  refreshDefense(state);
  pushLog(state, `${state.boss} opens the books for the ${state.crew}.`, "gold");
  pushLog(state, "Hollow Docks is yours. The Iron Saints share your fence.", "paper");
  pushLog(state, "Corners sell when you close the week. Moves are for taking ground.", "mute");
  return state;
}

export function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const o = value as GameState;
  return o.version === 1 && Array.isArray(o.districts) && o.districts.length === 12 && typeof o.cash === "number" && !!o.gangs;
}

export function setSelected(state: GameState, id: string): Result {
  if (!districtById(state, id)) return fail("No such block.");
  const next = clone(state);
  next.selectedId = id;
  return { ok: true, state: next };
}

export function setStation(state: GameState, id: string, kind: "muscle" | "dealers", value: number): Result {
  if (state.phase !== "play") return fail("Crew stays put until the week opens.");
  const next = clone(state);
  const d = districtById(next, id);
  if (!d || d.owner !== "player") return fail("You can only station crew on your blocks.");
  const cap = kind === "muscle" ? next.crewCounts.muscle : next.crewCounts.dealers;
  const others = next.districts.reduce((sum, block) => {
    if (block.id === id || block.owner !== "player") return sum;
    return sum + (kind === "muscle" ? block.stationMuscle : block.stationDealers);
  }, 0);
  const nextValue = clamp(Math.floor(value), 0, Math.max(0, cap - others));
  if (kind === "muscle") d.stationMuscle = nextValue;
  else d.stationDealers = nextValue;
  refreshDefense(next);
  return { ok: true, state: next };
}

export function setFocus(state: GameState, id: string, focus: ProductId | "auto"): Result {
  if (state.phase !== "play") return fail("Wait for the week to open.");
  const next = clone(state);
  const d = districtById(next, id);
  if (!d || d.owner !== "player") return fail("Not your block.");
  d.focus = focus;
  return { ok: true, state: next };
}

export function buy(state: GameState, product: ProductId, qty: number): Result {
  if (state.phase !== "play") return fail("The market is shut.");
  const next = clone(state);
  const price = next.prices[product].wholesale;
  let n = Math.floor(qty);
  if (n < 1) return fail("Buy at least one.");
  const affordable = Math.floor(next.cash / price);
  if (affordable < 1) return fail("Too broke for that.");
  if (n > affordable) n = affordable;
  const cost = price * n;
  next.cash -= cost;
  next.stash[product] += n;
  next.stats.spent += cost;
  pushLog(next, `Bought ${n} ${PRODUCTS[product].name} for ${money(cost)}.`, "mute");
  return { ok: true, state: next, fx: "cash" };
}

export function recruit(state: GameState, kind: "muscle" | "dealers"): Result {
  const next = clone(state);
  const ap = spendAp(next);
  if (ap) return fail(ap);
  if (kind === "muscle") {
    if (next.crewCounts.muscle >= 40) return fail("No more muscle will take your money.");
    const cost = 700;
    if (next.cash < cost) return fail(`Hiring muscle costs ${money(cost)}.`);
    next.cash -= cost;
    next.stats.spent += cost;
    next.crewCounts.muscle += 1;
    pushLog(next, "A new soldier joins the crew.", "paper");
  } else {
    if (next.crewCounts.dealers >= 16) return fail("Your corners are already full of talkers.");
    const cost = 1500;
    if (next.cash < cost) return fail(`A dealer costs ${money(cost)}.`);
    next.cash -= cost;
    next.stats.spent += cost;
    next.crewCounts.dealers += 1;
    pushLog(next, "A dealer takes your colors.", "paper");
  }
  return finish(next, "tick");
}

export function layLow(state: GameState): Result {
  const next = clone(state);
  if (next.heat < 8) return fail("The street is already quiet.");
  const ap = spendAp(next);
  if (ap) return fail(ap);
  const drop = next.difficulty === "war" ? 10 : 14;
  next.heat = clamp(next.heat - drop, 0, 100);
  next.respect = clamp(next.respect - 1, 0, 100);
  pushLog(next, "You pull the crew indoors. Heat falls. So does respect.", "mute");
  return finish(next, "tick");
}

export function bribe(state: GameState): Result {
  const next = clone(state);
  const ap = spendAp(next);
  if (ap) return fail(ap);
  const cost = bribeCost(next);
  if (next.cash < cost) return fail(`The sergeant wants ${money(cost)}.`);
  next.cash -= cost;
  next.stats.spent += cost;
  next.heat = clamp(next.heat - 22, 0, 100);
  pushLog(next, `An envelope of ${money(cost)} buys a quieter week.`, "gold");
  return finish(next, "cash");
}

export function fortify(state: GameState, id: string): Result {
  const next = clone(state);
  const d = districtById(next, id);
  if (!d || d.owner !== "player") return fail("Fortify your own block.");
  const cost = fortifyCost(d.corners);
  if (cost == null) return fail("That corner is already as loud as it gets.");
  const ap = spendAp(next);
  if (ap) return fail(ap);
  if (next.cash < cost) return fail(`The build costs ${money(cost)}.`);
  next.cash -= cost;
  next.stats.spent += cost;
  d.corners += 1;
  d.loyalty = clamp(d.loyalty + 4, 0, 100);
  pushLog(next, `${d.name} grows a stronger corner.`, "gold");
  return finish(next, "tick");
}

export function cook(state: GameState, id: string, product: "dust" | "grow"): Result {
  const next = clone(state);
  const d = districtById(next, id);
  if (!d || d.owner !== "player" || !d.lab) return fail("You need a lab you own.");
  const ap = spendAp(next);
  if (ap) return fail(ap);
  const units = 14;
  const cost = product === "dust" ? 560 : 392;
  if (next.cash < cost) return fail(`The lab needs ${money(cost)} in front.`);
  next.cash -= cost;
  next.stats.spent += cost;
  next.stash[product] += units;
  next.heat = clamp(next.heat + (product === "dust" ? 3 : 2), 0, 100);
  next.loud = true;
  pushLog(next, `The lab at ${d.name} turns out ${units} ${PRODUCTS[product].name}.`, "gold");
  return finish(next, "tick");
}

export function truce(state: GameState, gangId: GangId): Result {
  const next = clone(state);
  const g = next.gangs[gangId];
  if (!g?.alive) return fail("Nothing left to bargain with.");
  if (g.truceWeeks > 0 && g.relation > 10) return fail("The truce still holds.");
  const ap = spendAp(next);
  if (ap) return fail(ap);
  const cost = truceCost(g);
  if (next.cash < cost) return fail(`They want ${money(cost)} to sit down.`);
  next.cash -= cost;
  next.stats.spent += cost;
  g.relation = clamp(g.relation + 40, -100, 80);
  g.truceWeeks = 4;
  next.respect = clamp(next.respect - 2, 0, 100);
  pushLog(next, `A bought truce with ${g.name}. Four quiet weeks, if they keep it.`, "paper");
  return finish(next, "tick");
}

export function moveIn(state: GameState, id: string): Result {
  const next = clone(state);
  const d = districtById(next, id);
  if (!d || d.owner !== "neutral") return fail("That block is not open.");
  if (!adjacentToPlayer(next, id)) return fail("You need a block on its border.");
  if (freeMuscle(next) < 2) return fail("Hold back at least 2 free muscle.");
  if (freeDealers(next) < 1) return fail("Send a dealer with them.");
  const cost = moveInCost(d);
  const ap = spendAp(next);
  if (ap) return fail(ap);
  if (next.cash < cost) return fail(`Quiet money costs ${money(cost)}.`);
  next.cash -= cost;
  next.stats.spent += cost;
  const roll = roller(next)();
  const chance = (next.difficulty === "war" ? 0.72 : 0.82) + next.respect / 500;
  if (roll < chance) {
    giveBlockToPlayer(next, d, 50, 1, 1);
    next.heat = clamp(next.heat + 5, 0, 100);
    pushLog(next, `${d.name} comes over quiet. It is yours.`, "gold");
    return finish(next, "cash");
  }
  next.heat = clamp(next.heat + 7, 0, 100);
  d.defense += 3;
  if (roller(next)() < 0.3 && next.crewCounts.muscle > 0) {
    next.crewCounts.muscle -= 1;
    clampStations(next);
  }
  pushLog(next, `${d.name} keeps the envelope and stays open. Money burned.`, "blood");
  return finish(next, "bad");
}

export function shake(state: GameState, id: string): Result {
  const next = clone(state);
  const d = districtById(next, id);
  if (!d || d.owner !== "neutral") return fail("Nothing neutral there to lean on.");
  if (!adjacentToPlayer(next, id)) return fail("You need a block on its border.");
  const ap = spendAp(next);
  if (ap) return fail(ap);
  const cost = 500;
  if (next.cash < cost) return fail("Even a shake costs $500.");
  next.cash -= cost;
  next.stats.spent += cost;
  next.loud = true;
  const roll = roller(next)();
  const chance = 0.5 + next.respect / 320 - d.defense / 180;
  if (roll < chance) {
    giveBlockToPlayer(next, d, 32, freeMuscle(next) > 0 ? 1 : 0, 0);
    next.heat = clamp(next.heat + 12, 0, 100);
    next.respect = clamp(next.respect + 2, 0, 100);
    pushLog(next, `${d.name} folds. Loud, but yours.`, "gold");
    return finish(next, "hit");
  }
  next.heat = clamp(next.heat + 9, 0, 100);
  next.respect = clamp(next.respect - 1, 0, 100);
  d.defense += 4;
  if (roller(next)() < 0.5) {
    const gangs = neighborsOf(next, id).map((n) => n.owner).filter(isGangId);
    const taker = gangs[0] ?? aliveGangs(next)[0]?.id;
    if (taker && next.gangs[taker].alive) {
      d.owner = taker;
      d.corners = 1;
      pushLog(next, `The shake fails. ${next.gangs[taker].name} move into ${d.name}.`, "blood");
      return finish(next, "bad");
    }
  }
  pushLog(next, `${d.name} laughs off the shake and digs in.`, "blood");
  return finish(next, "bad");
}

export function hit(state: GameState, id: string, commit: number): Result {
  const next = clone(state);
  const d = districtById(next, id);
  if (!d || !isGangId(d.owner)) return fail("Hit a rival block.");
  if (!adjacentToPlayer(next, id)) return fail("No approach from your blocks.");
  const gang = next.gangs[d.owner];
  if (!gang.alive) return fail("That crew is already gone.");
  const send = Math.floor(commit);
  if (send < 1) return fail("Send at least one soldier.");
  if (send > freeMuscle(next)) return fail("That muscle is already stationed.");
  const ap = spendAp(next);
  if (ap) return fail(ap);
  next.loud = true;
  const rng = roller(next);
  const atk = send * (5.5 + next.respect / 30) * (0.72 + rng() * 0.55);
  const def = d.defense;
  if (atk > def) {
    const losses = Math.min(send, Math.max(1, Math.round(send * (0.1 + rng() * 0.16))));
    next.crewCounts.muscle = Math.max(0, next.crewCounts.muscle - losses);
    clampStations(next);
    const wasHome = d.id === gang.home;
    gang.muscle = Math.max(0, gang.muscle - Math.max(2, Math.round(send * 0.4)));
    gang.relation = clamp(Math.min(gang.relation, -50) - (wasHome ? 40 : 18), -100, 80);
    gang.truceWeeks = 0;
    d.owner = "player";
    d.corners = 1;
    d.loyalty = 40;
    d.focus = "auto";
    d.stationMuscle = 0;
    d.stationDealers = 0;
    clampStations(next);
    d.stationMuscle = Math.min(Math.max(0, send - losses), freeMuscle(next));
    next.heat = clamp(next.heat + 16, 0, 100);
    next.respect = clamp(next.respect + 6, 0, 100);
    next.stats.blocksTaken += 1;
    const homeLine = wasHome ? " You took their house." : "";
    pushLog(next, `${d.name} falls. Lost ${losses} muscle.${homeLine}`, "blood");
    return finish(next, "hit");
  }
  const losses = Math.min(send, Math.max(1, Math.round(send * (0.34 + rng() * 0.28))));
  next.crewCounts.muscle = Math.max(0, next.crewCounts.muscle - losses);
  clampStations(next);
  gang.relation = clamp(gang.relation - 14, -100, 80);
  gang.truceWeeks = 0;
  next.heat = clamp(next.heat + 10, 0, 100);
  next.respect = clamp(next.respect - 2, 0, 100);
  pushLog(next, `${gang.name} hold ${d.name}. You lose ${losses} muscle.`, "blood");
  return finish(next, "hit");
}

function applySales(state: GameState): SaleLine[] {
  const stash = state.stash;
  const sold: SaleLine[] = [];
  for (const d of state.districts) {
    const q = quoteDistrict(state, d, stash);
    if (!q) continue;
    stash[q.product] -= q.units;
    state.cash += q.cash;
    state.heat += q.heat;
    state.stats.earned += q.cash;
    state.stats.productSold += q.units;
    d.loyalty = clamp(d.loyalty + 4, 0, 100);
    if (d.stationMuscle < 1) d.loyalty = clamp(d.loyalty - 2, 0, 100);
    sold.push(q);
    pushLog(state, `${d.name} moves ${q.units} ${PRODUCTS[q.product].name} for ${money(q.cash)}.`, "gold");
  }
  state.heat = clamp(state.heat, 0, 100);
  return sold;
}

function loyaltyDrift(state: GameState, soldIds: Set<string>) {
  for (const d of state.districts) {
    if (d.owner !== "player" || soldIds.has(d.id)) continue;
    let drop = 0;
    if (d.stationDealers < 1) drop += 8;
    if (d.stationMuscle < 1) drop += 3;
    if (!drop) continue;
    d.loyalty = clamp(d.loyalty - drop, 0, 100);
    if (d.loyalty <= 0) {
      releaseCrew(state, d, 0.5, 0.5);
      d.owner = "neutral";
      d.loyalty = 0;
      d.corners = 0;
      d.defense = 12;
      d.focus = "auto";
      pushLog(state, `${d.name} walks. Nobody was feeding it.`, "blood");
    } else if (drop >= 8) {
      pushLog(state, `${d.name} cools off. Loyalty is slipping.`, "mute");
    }
  }
}

function captureByGang(state: GameState, d: District, gang: Gang, rng: () => number, vengeance: boolean) {
  if (d.owner === "player") {
    releaseCrew(state, d, vengeance ? 0.25 : 0.45, 0.5);
    state.respect = clamp(state.respect - 3, 0, 100);
    state.heat = clamp(state.heat + 4, 0, 100);
  } else if (isGangId(d.owner) && d.owner !== gang.id) {
    const other = state.gangs[d.owner];
    other.muscle = Math.max(0, other.muscle - 2);
    other.relation = clamp(other.relation - 8, -100, 80);
  }
  d.owner = gang.id;
  d.corners = 1;
  d.loyalty = 0;
  d.stationMuscle = 0;
  d.stationDealers = 0;
  d.focus = "auto";
  gang.muscle = Math.max(2, gang.muscle - (vengeance ? 2 : 1 + Math.floor(rng() * 2)));
  const verb = vengeance ? "come back through" : "take";
  const tone: Tone = d.id === "hollow" ? "blood" : "blood";
  pushLog(state, `${gang.name} ${verb} ${d.name}.`, tone);
}

function gangTurn(state: GameState, id: GangId, rng: () => number) {
  const g = state.gangs[id];
  if (!g.alive) return;
  let owned = state.districts.filter((d) => d.owner === id);
  if (owned.length === 0) {
    const targets = playerBlocks(state);
    if (targets.length && g.muscle >= 4 && g.truceWeeks === 0) {
      const target = [...targets].sort((a, b) => a.defense - b.defense)[0];
      if (!target) {
        g.alive = false;
        return;
      }
      const atk = g.muscle * (1.25 + rng() * 0.85);
      if (atk > target.defense) {
        captureByGang(state, target, g, rng, true);
        pushLog(state, `${g.name} had nothing left and spent it on you.`, "blood");
        return;
      }
      pushLog(state, `${g.name} die trying to claw back a block.`, "paper");
    } else {
      pushLog(state, `${g.name} are finished.`, "paper");
    }
    g.alive = false;
    g.muscle = 0;
    return;
  }

  g.cash += Math.round(owned.length * (650 + g.muscle * 30));
  if (g.cash > 4800 && g.muscle < 32 && rng() < 0.55) {
    const n = rng() < 0.35 ? 2 : 1;
    g.muscle += n;
    g.cash -= n * 650;
  }
  if (g.truceWeeks > 0) g.truceWeeks -= 1;

  owned = state.districts.filter((d) => d.owner === id);
  const border = new Map<string, District>();
  for (const d of owned) {
    for (const n of neighborsOf(state, d.id)) {
      if (n.owner !== id) border.set(n.id, n);
    }
  }
  const edge = [...border.values()];
  const neutrals = edge.filter((d) => d.owner === "neutral");
  const playerEdge = edge.filter((d) => d.owner === "player");
  const rivals = edge.filter((d) => isGangId(d.owner));
  if (playerEdge.length && g.truceWeeks === 0) g.relation -= state.difficulty === "war" ? 6 : 4;
  else g.relation += 1;
  g.relation = clamp(g.relation, -100, 70);

  const hostile = g.relation < -34 && g.truceWeeks === 0;
  const expandP = state.difficulty === "war" ? 0.74 : 0.52;
  let target: District | null = null;
  let kind: "player" | "neutral" | "rival" | null = null;
  if (hostile && playerEdge.length && rng() < 0.48 + g.aggression * 0.35) {
    target = [...playerEdge].sort((a, b) => a.defense - b.defense)[0] ?? null;
    kind = "player";
  } else if (neutrals.length && rng() < expandP) {
    target = neutrals[Math.floor(rng() * neutrals.length)] ?? null;
    kind = "neutral";
  } else if (rivals.length && rng() < 0.38) {
    target = [...rivals].sort((a, b) => a.defense - b.defense)[0] ?? null;
    kind = "rival";
  }
  if (!target || !kind) return;
  const atk = g.muscle * (0.5 + rng() * 0.75);
  const need = kind === "neutral" ? target.defense * 0.62 : target.defense;
  if (atk > need) captureByGang(state, target, g, rng, false);
  else if (kind === "player") {
    g.muscle = Math.max(2, g.muscle - 1);
    state.respect = clamp(state.respect + 1, 0, 100);
    state.heat = clamp(state.heat + 3, 0, 100);
    pushLog(state, `${g.name} test ${target.name} and bleed on the curb.`, "paper");
  }
}

function driftPrices(state: GameState, rng: () => number) {
  for (const id of PRODUCT_IDS) {
    const base = PRODUCTS[id].baseWholesale;
    const shock = 0.86 + rng() * 0.3;
    let wholesale = state.prices[id].wholesale * shock;
    wholesale = wholesale * 0.72 + base * 0.28;
    wholesale = clamp(wholesale, base * 0.55, base * 1.85);
    const rounded = Math.max(1, Math.round(wholesale));
    state.prices[id] = { wholesale: rounded, street: Math.round(rounded * PRODUCTS[id].markup) };
  }
}

function maybeFlavor(state: GameState, rng: () => number) {
  const roll = rng();
  if (roll < 0.25) {
    state.prices.dust.wholesale = Math.round(state.prices.dust.wholesale * 1.12);
    state.prices.dust.street = Math.round(state.prices.dust.wholesale * PRODUCTS.dust.markup);
    pushLog(state, "Dock gossip: Dust is short this week.", "mute");
  } else if (roll < 0.5) {
    state.respect = clamp(state.respect + 1, 0, 100);
    pushLog(state, "The paper runs a nothing story. You look steady.", "mute");
  } else if (roll < 0.75) {
    const alive = aliveGangs(state);
    if (alive.length >= 2) {
      const g = alive[Math.floor(rng() * alive.length)];
      if (g) {
        g.muscle = Math.max(2, g.muscle - 2);
        pushLog(state, `${g.name} lose people in somebody else's fight.`, "mute");
      }
    }
  } else if (!state.bonus) {
    state.bonus = { product: "velvet", mult: 1.35, weeks: 1 };
    pushLog(state, "The clubs are thirsty. Velvet will move next week.", "gold");
  }
}

function makeEvent(state: GameState, rng: () => number): ChoiceEvent | null {
  type Maker = () => ChoiceEvent | null;
  const makers: Maker[] = [
    () => ({
      id: "snitch",
      title: "A snitch in the crew",
      body: "Someone is pricing a conversation with the task force. Handle it before the week hardens.",
      options: [
        { id: "pay", label: "Silence them", detail: `${money(4000)} and it never happened.` },
        { id: "ice", label: "Make an example", detail: "Lose a soldier. Heat rises. Respect too." },
        { id: "ignore", label: "Call it gossip", detail: "Cheap. The heat may not be." },
      ],
    }),
    () =>
      state.heat >= 22
        ? {
            id: "sergeant",
            title: "The crooked sergeant",
            body: `A night-shift sergeant offers to misfile you. The number is ${money(5000)}.`,
            options: [
              { id: "pay", label: "Pay the sergeant", detail: "Heat drops hard." },
              { id: "refuse", label: "Tell them to walk", detail: "They will remember the insult." },
            ],
          }
        : null,
    () =>
      playerBlocks(state).some((d) => d.lab || d.id === "hollow" || d.id === "blackwater")
        ? {
            id: "container",
            title: "A container with no owner",
            body: `Twenty-four Dust, half the street wholesale (${money(Math.round(state.prices.dust.wholesale * 0.5 * 24))}). The crane operator is not asking loud questions.`,
            options: [
              { id: "buy", label: "Take the container", detail: "If you can pay." },
              { id: "leave", label: "Leave it", detail: "Somebody else will not." },
            ],
          }
        : null,
    () =>
      state.crewCounts.muscle + state.crewCounts.dealers >= 8
        ? {
            id: "lieutenant",
            title: "Your lieutenant wants in",
            body: "They kept the corners alive. Now they want a cut of the book, or they start forgetting things.",
            options: [
              { id: "cut", label: "Give them a cut", detail: "8% of cash. Loyalty rises across your blocks." },
              { id: "refuse", label: "Remind them who is boss", detail: "One block takes it personally." },
            ],
          }
        : null,
    () => ({
      id: "festival",
      title: "A permit for the strip",
      body: "Somebody can make next week's clubs very thirsty. Velvet will fly if you bankroll the noise.",
      options: [
        { id: "pay", label: "Bankroll it", detail: `${money(2000)}. Velvet surges next week.` },
        { id: "skip", label: "Let it pass", detail: "Save the cash." },
      ],
    }),
    () => {
      const alive = aliveGangs(state).filter((g) => g.relation > -75);
      if (!alive.length) return null;
      const g = [...alive].sort((a, b) => b.relation - a.relation)[0];
      if (!g) return null;
      return {
        id: "sitdown",
        title: `A sit-down with ${g.name}`,
        subject: g.id,
        body: `${g.boss} will hear you. They are ${relationWord(g.relation, g.truceWeeks).toLowerCase()} right now.`,
        options: [
          { id: "pay", label: "Buy the peace", detail: `${money(4500)} and a real truce.` },
          { id: "flex", label: "Flex instead", detail: "Respect up. They will not forget." },
        ],
      };
    },
    () =>
      state.heat >= 40
        ? {
            id: "rumor",
            title: "Undercover rumor",
            body: "A car has been too patient outside the docks. It might be nothing. It might be the case.",
            options: [
              { id: "quiet", label: "Go dark", detail: "Heat falls. You lose a move next week." },
              { id: "bluff", label: "Call the bluff", detail: "If you are wrong, the raid comes early." },
            ],
          }
        : null,
  ];
  const start = Math.floor(rng() * makers.length);
  for (let i = 0; i < makers.length; i++) {
    const made = makers[(start + i) % makers.length]?.();
    if (made) return made;
  }
  return null;
}

function raid(state: GameState, rng: () => number, bonusHeat = 0) {
  const threshold = state.difficulty === "war" ? 28 : 36;
  const span = state.difficulty === "war" ? 125 : 175;
  const chance = Math.max(0, (state.heat + bonusHeat - threshold) / span);
  if (rng() >= chance) return;
  state.strikes += 1;
  state.stats.raids += 1;
  const cashLoss = Math.round(state.cash * (0.16 + rng() * 0.22));
  state.cash = Math.max(0, state.cash - cashLoss);
  const held = PRODUCT_IDS.filter((id) => state.stash[id] > 0);
  let lostName = "";
  if (held.length) {
    const product = held[Math.floor(rng() * held.length)] ?? "dust";
    const lose = Math.max(1, Math.ceil(state.stash[product] * (0.25 + rng() * 0.3)));
    state.stash[product] = Math.max(0, state.stash[product] - lose);
    lostName = ` ${lose} ${PRODUCTS[product].name} seized.`;
  }
  if (state.crewCounts.dealers > 1 && rng() < 0.4) {
    state.crewCounts.dealers -= 1;
    clampStations(state);
  }
  state.heat = clamp(state.heat * 0.5, 0, 100);
  state.respect = clamp(state.respect - 4, 0, 100);
  pushLog(state, `Raid. ${money(cashLoss)} gone.${lostName} Strike ${state.strikes} of 3.`, "blood");
}

export function endWeek(state: GameState): Result {
  if (state.phase !== "play") return fail("The week is already closed.");
  const next = clone(state);
  const rng = roller(next);
  const cashBefore = next.cash;
  const heatBefore = next.heat;
  const linesStart = next.logSeq;
  const sold = applySales(next);
  if (!sold.length) pushLog(next, "No corners ran. Station a dealer and keep product in the stash.", "mute");
  const soldCash = sold.reduce((s, l) => s + l.cash, 0);
  if (soldCash >= 8000) next.respect = clamp(next.respect + 2, 0, 100);
  else if (soldCash >= 2500) next.respect = clamp(next.respect + 1, 0, 100);
  loyaltyDrift(next, new Set(sold.map((s) => s.districtId)));
  for (const id of GANG_IDS) {
    if (next.phase === "lost") break;
    gangTurn(next, id, rng);
    refreshDefense(next);
  }
  if (next.bonus) {
    next.bonus.weeks -= 1;
    if (next.bonus.weeks <= 0) next.bonus = null;
  }
  driftPrices(next, rng);
  const decay = next.loud ? 1 : next.difficulty === "war" ? 3 : 5;
  next.heat = clamp(next.heat - decay, 0, 100);
  raid(next, rng);
  const closedWeek = next.week;
  next.week += 1;
  next.ap = Math.max(1, next.maxAp - next.apPenalty);
  next.apPenalty = 0;
  next.loud = false;
  const freshLines = next.log.filter((l) => l.id > linesStart);
  next.report = {
    closedWeek,
    lines: freshLines,
    cashBefore,
    cashAfter: next.cash,
    heatBefore: Math.round(heatBefore),
    heatAfter: Math.round(next.heat),
    sold,
  };
  const win = victoryReason(next);
  const loss = defeatReason(next);
  if (win) {
    next.phase = "won";
    next.ending = win;
    next.pending = null;
    return finish(next, "win");
  }
  if (loss) {
    next.phase = "lost";
    next.ending = loss;
    next.pending = null;
    return finish(next, "raid");
  }
  const eventChance = closedWeek <= 1 ? 0.12 : 0.4;
  if (rng() < eventChance) {
    const ev = makeEvent(next, rng);
    if (ev) {
      next.pending = ev;
      next.phase = "event";
      refreshDefense(next);
      return { ok: true, state: next, fx: soldCash > 0 ? "cash" : "tick" };
    }
  }
  if (rng() < 0.55) maybeFlavor(next, rng);
  next.phase = "summary";
  next.pending = null;
  if (next.report) {
    next.report.lines = next.log.filter((l) => l.id > linesStart);
    next.report.cashAfter = next.cash;
    next.report.heatAfter = Math.round(next.heat);
  }
  refreshDefense(next);
  return { ok: true, state: next, fx: sold.some((s) => s.heat > 8) ? "raid" : soldCash > 0 ? "cash" : "tick" };
}

export function resolveChoice(state: GameState, optionId: string): Result {
  if (state.phase !== "event" || !state.pending) return fail("Nothing is asking.");
  const next = clone(state);
  const ev = next.pending;
  if (!ev) return fail("Nothing is asking.");
  const rng = roller(next);
  const mark = next.logSeq;
  const opt = ev.options.find((o) => o.id === optionId);
  if (!opt) return fail("That is not on the table.");

  if (ev.id === "snitch" && optionId === "pay") {
    if (next.cash < 4000) {
      next.heat = clamp(next.heat + 10, 0, 100);
      pushLog(next, "You could not pay. The snitch keeps talking. Heat climbs.", "blood");
    } else {
      next.cash -= 4000;
      next.stats.spent += 4000;
      pushLog(next, "The snitch takes the money and disappears.", "paper");
    }
  } else if (ev.id === "snitch" && optionId === "ice") {
    if (next.crewCounts.muscle < 1) {
      next.heat = clamp(next.heat + 8, 0, 100);
      pushLog(next, "No soldier left to make the point.", "blood");
    } else {
      next.crewCounts.muscle -= 1;
      clampStations(next);
      next.heat = clamp(next.heat + 6, 0, 100);
      next.respect = clamp(next.respect + 4, 0, 100);
      pushLog(next, "An example is made. The crew gets very quiet.", "blood");
    }
  } else if (ev.id === "snitch" && optionId === "ignore") {
    next.heat = clamp(next.heat + 14, 0, 100);
    if (next.crewCounts.dealers > 1 && rng() < 0.45) {
      next.crewCounts.dealers -= 1;
      clampStations(next);
      pushLog(next, "Gossip was a warrant. A dealer is picked up. Heat surges.", "blood");
    } else {
      pushLog(next, "You ignore it. Heat finds you anyway.", "blood");
    }
  } else if (ev.id === "sergeant" && optionId === "pay") {
    const cost = 5000;
    if (next.cash < cost) {
      next.heat = clamp(next.heat + 8, 0, 100);
      pushLog(next, "The sergeant wanted cash you do not have.", "blood");
    } else {
      next.cash -= cost;
      next.stats.spent += cost;
      next.heat = clamp(next.heat - 26, 0, 100);
      pushLog(next, "The sergeant misfiles the week.", "gold");
    }
  } else if (ev.id === "sergeant" && optionId === "refuse") {
    next.heat = clamp(next.heat + 12, 0, 100);
    pushLog(next, "The sergeant leaves angry. Patrols thicken.", "blood");
  } else if (ev.id === "container" && optionId === "buy") {
    const cost = Math.round(next.prices.dust.wholesale * 0.5 * 24);
    if (next.cash < cost) pushLog(next, "The operator wants cash. You do not have it. The box vanishes.", "mute");
    else {
      next.cash -= cost;
      next.stats.spent += cost;
      next.stash.dust += 24;
      next.heat = clamp(next.heat + 4, 0, 100);
      pushLog(next, `The container is yours. 24 Dust for ${money(cost)}.`, "gold");
    }
  } else if (ev.id === "container" && optionId === "leave") {
    const g = aliveGangs(next)[Math.floor(rng() * Math.max(1, aliveGangs(next).length))];
    if (g) {
      g.cash += 4000;
      g.muscle += 1;
      pushLog(next, `${g.name} take the container instead.`, "mute");
    } else pushLog(next, "The container disappears into the river.", "mute");
  } else if (ev.id === "lieutenant" && optionId === "cut") {
    const cut = Math.round(next.cash * 0.08);
    next.cash -= cut;
    next.stats.spent += cut;
    next.respect = clamp(next.respect + 4, 0, 100);
    for (const d of next.districts) if (d.owner === "player") d.loyalty = clamp(d.loyalty + 8, 0, 100);
    pushLog(next, `You cut in ${money(cut)}. The blocks feel looked after.`, "gold");
  } else if (ev.id === "lieutenant" && optionId === "refuse") {
    const mine = playerBlocks(next);
    const d = mine[Math.floor(rng() * mine.length)];
    if (d) d.loyalty = clamp(d.loyalty - 18, 0, 100);
    next.respect = clamp(next.respect - 1, 0, 100);
    pushLog(next, `${d ? d.name : "A block"} takes the refusal badly.`, "blood");
  } else if (ev.id === "festival" && optionId === "pay") {
    if (next.cash < 2000) pushLog(next, "The promoter shrugs. You are short.", "mute");
    else {
      next.cash -= 2000;
      next.stats.spent += 2000;
      next.bonus = { product: "velvet", mult: 1.75, weeks: 1 };
      pushLog(next, "Next week's clubs will beg for Velvet.", "gold");
    }
  } else if (ev.id === "festival" && optionId === "skip") {
    pushLog(next, "You let the permit die.", "mute");
  } else if (ev.id === "sitdown" && ev.subject) {
    const g = next.gangs[ev.subject];
    if (optionId === "pay") {
      if (next.cash < 4500) {
        g.relation = clamp(g.relation - 10, -100, 80);
        pushLog(next, `${g.name} came to be paid. You were empty-handed.`, "blood");
      } else {
        next.cash -= 4500;
        next.stats.spent += 4500;
        g.relation = clamp(g.relation + 36, -100, 80);
        g.truceWeeks = Math.max(g.truceWeeks, 5);
        pushLog(next, `${g.boss} takes the peace. ${g.name} stand down.`, "paper");
      }
    } else {
      g.relation = clamp(g.relation - 22, -100, 80);
      g.truceWeeks = 0;
      next.respect = clamp(next.respect + 4, 0, 100);
      pushLog(next, `You flex on ${g.name}. The room goes cold.`, "blood");
    }
  } else if (ev.id === "rumor" && optionId === "quiet") {
    next.heat = clamp(next.heat - 12, 0, 100);
    next.apPenalty += 1;
    pushLog(next, "You go dark. Next week you get one fewer move.", "mute");
  } else if (ev.id === "rumor" && optionId === "bluff") {
    pushLog(next, "You call the bluff.", "paper");
    raid(next, rng, 18);
  } else {
    pushLog(next, "The moment passes.", "mute");
  }

  next.pending = null;
  const extra = next.log.filter((l) => l.id > mark);
  if (next.report) {
    next.report.lines = [...extra, ...next.report.lines];
    next.report.cashAfter = next.cash;
    next.report.heatAfter = Math.round(next.heat);
  }
  const win = victoryReason(next);
  const loss = defeatReason(next);
  if (win) {
    next.phase = "won";
    next.ending = win;
    return finish(next, "win");
  }
  if (loss) {
    next.phase = "lost";
    next.ending = loss;
    return finish(next, "raid");
  }
  next.phase = "summary";
  return finish(next, "tick");
}

export function continueReport(state: GameState): Result {
  if (state.phase !== "summary") return fail("Nothing to turn.");
  const next = clone(state);
  next.phase = "play";
  next.report = null;
  return finish(next, "tick");
}

export { WIN_BLOCKS, WIN_RESPECT, WIN_WORTH, PRODUCTS, PRODUCT_IDS, GANG_IDS };
