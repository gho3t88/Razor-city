import { buyWeapon, combatOf, equipWeapon, resolveAmbush, trainCombat, trainingCost } from "./combat";
import { creditWallet, spendCredits } from "@/lib/credits";
import { refreshRegionMarkets, tradeRegion } from "./region-economy";
import { tickEncounters, decideDeal, deliverDeal, resolveTalk } from "./encounters";
import { create } from "zustand";
import { playSound, resumeAudio, setAudioMuted, unlockAudio } from "@/game/audio";
import { continueReport, createGame, endWeek, isGameState, netWorth, refreshDefense, resolveChoice, setSelected } from "@/game/logic";
import type { GameState, ProductId, StartOpts } from "@/game/types";
import type { Result } from "@/game/logic";
import { cityMapOf, completeCityOrder, issueCityOrder } from "@/game/city-map";

import { refreshDistrictNames } from "@/game/content";

const SAVE_KEY = "razor-city-save-v1";
const LEGACY_KEY = "razor-city-legacy-v1";
const MUTE_KEY = "razor-city-muted";
const TRAINING_JOURNAL = "razor-paid-training-pending-v1";

export interface Legacy {
  wins: number;
  bestWorth: number;
  bestWeek: number | null;
  runs: number;
}

export interface SaveMeta {
  week: number;
  cash: number;
  crew: string;
  boss: string;
  phase: GameState["phase"];
}

interface RazorStore {
  booted: boolean;
  screen: "start" | "game";
  game: GameState | null;
  hasSave: boolean;
  saveMeta: SaveMeta | null;
  legacy: Legacy;
  modal: "none" | "market" | "ledger";
  toast: string | null;
  pulse: number;
  muted: boolean;
  billingBusy: boolean;
  premiumBalance: number;
  refreshWallet: () => Promise<void>;
  buyWeapon: (id: string) => void;
  equipWeapon: (id: string) => void;
  resolveAmbush: (choice: "run" | "fight" | "surrender") => void;
  trainCombat: () => Promise<void>;
  boot: () => void;
  startNew: (opts: StartOpts) => void;
  continueGame: () => void;
  abandon: () => void;
  select: (id: string) => void;
  commit: (result: Result) => void;
  closeWeek: () => void;
  choose: (optionId: string) => void;
  nextWeek: () => void;
  grantAdReward: () => boolean;
  setModal: (modal: "none" | "market" | "ledger") => void;
  clearToast: () => void;
  toggleMute: () => void;
  travel: (waypoints: string[]) => void;
  orderAttack: (id: string, soldiers: number) => void;
  tickCity: () => void;
  tickContacts: () => void;
  tradeRegion: (region: string, product: ProductId, quantity: number, side: "buy" | "sell") => void;
  decideDeal: (id: string, accept: boolean) => void;
  deliverDeal: (id: string) => void;
  replyToCrew: (choice: string) => void;
}

const emptyLegacy = (): Legacy => ({ wins: 0, bestWorth: 0, bestWeek: null, runs: 0 });

function readLegacy(): Legacy {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return emptyLegacy();
    const parsed = JSON.parse(raw) as Partial<Legacy>;
    return {
      wins: Number(parsed.wins) || 0,
      bestWorth: Number(parsed.bestWorth) || 0,
      bestWeek: parsed.bestWeek == null ? null : Number(parsed.bestWeek),
      runs: Number(parsed.runs) || 0,
    };
  } catch {
    return emptyLegacy();
  }
}

function writeLegacy(legacy: Legacy) {
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
  } catch {
    /* ignore quota */
  }
}

function persist(game: GameState | null) {
  try {
    if (!game) localStorage.removeItem(SAVE_KEY);
    else localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    return true;
  } catch {
    return false;
  }
}

function metaOf(game: GameState): SaveMeta {
  return { week: game.week, cash: game.cash, crew: game.crew, boss: game.boss, phase: game.phase };
}

function readSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isGameState(parsed)) return null;
    const game = { ...parsed, districts: refreshDistrictNames(parsed.districts) };
    refreshRegionMarkets(game);
    return game;
  } catch {
    return null;
  }
}

export const useRazor = create<RazorStore>((set, get) => ({
  booted: false,
  screen: "start",
  game: null,
  hasSave: false,
  saveMeta: null,
  legacy: emptyLegacy(),
  modal: "none",
  toast: null,
  pulse: 0,
  muted: false,
  billingBusy: false,
  premiumBalance: 0,

  boot: () => {
    if (get().booted) return;
    // Paid training has a durable journal, recovered before the player can load or start a run.
    try {
      const pending = localStorage.getItem(TRAINING_JOURNAL);
      if (pending) {
        set({ billingBusy: true });
        const journal = JSON.parse(pending) as { id: string; amount: number; after: GameState };
        if (!isGameState(journal.after) || !Number.isSafeInteger(journal.amount) || journal.amount < 1 || journal.amount > 215) throw new Error("Invalid training journal");
        spendCredits(journal.id, journal.amount).then(wallet => {
          if (!persist(journal.after)) throw new Error("Save unavailable");
          localStorage.removeItem(TRAINING_JOURNAL);
          set({ billingBusy: false, premiumBalance: wallet.balance, hasSave: true, saveMeta: metaOf(journal.after) });
        }).catch((error: { code?: string }) => {
          if (error.code === "INSUFFICIENT_CREDITS") { localStorage.removeItem(TRAINING_JOURNAL); set({ billingBusy: false, toast: "Training was not charged. Your previous save is ready." }); }
          else set({ billingBusy: true, toast: "Recovering paid training. Reopen the game to retry." });
        });
      }
    } catch { set({ billingBusy: true, toast: "Training recovery needs attention. Your save has been kept." }); }
    const save = readSave();
    let muted = false;
    try {
      muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      muted = false;
    }
    setAudioMuted(muted);
    set({
      booted: true,
      hasSave: !!save,
      saveMeta: save ? metaOf(save) : null,
      legacy: readLegacy(),
      muted,
    });
  },

  startNew: (opts) => {
    if (get().billingBusy) return;
    unlockAudio();
    const game = createGame(opts);
    const legacy = { ...get().legacy, runs: get().legacy.runs + 1 };
    writeLegacy(legacy);
    persist(game);
    set({
      screen: "game",
      game,
      hasSave: true,
      saveMeta: metaOf(game),
      legacy,
      modal: "none",
      toast: null,
    });
    playSound("tick");
  },

  continueGame: () => {
    if (get().billingBusy) return;
    unlockAudio();
    const save = readSave();
    if (!save) {
      set({ hasSave: false, saveMeta: null, toast: "No books on file." });
      return;
    }
    set({ screen: "game", game: save, hasSave: true, saveMeta: metaOf(save), modal: "none", toast: null });
    playSound("tick");
  },

  abandon: () => {
    if (get().billingBusy) return;
    persist(null);
    set({ screen: "start", game: null, hasSave: false, saveMeta: null, modal: "none", toast: null });
  },

  select: (id) => {
    if (get().billingBusy) return;
    const game = get().game;
    if (!game) return;
    const result = setSelected(game, id);
    if (!result.ok) return;
    persist(result.state);
    set({ game: result.state });
  },

  commit: (result) => {
    if (get().billingBusy) { set({ toast: "Please wait for your training payment to finish." }); return; }
    if (get().game && cityMapOf(get().game!).order) {
      set({ toast: "Your crew is carrying out an order. Wait for it to finish." });
      return;
    }
    if (!result.ok) {
      playSound("bad");
      set({ toast: result.error });
      return;
    }
    const prev = get().game;
    const game = result.state;
    refreshDefense(game);
    let legacy = get().legacy;
    const ended = game.phase === "won" || game.phase === "lost";
    const justEnded = ended && prev?.phase !== game.phase;
    if (justEnded) {
      const worth = netWorth(game);
      legacy = {
        ...legacy,
        wins: legacy.wins + (game.phase === "won" ? 1 : 0),
        bestWorth: Math.max(legacy.bestWorth, worth),
        bestWeek: game.phase === "won" ? Math.min(legacy.bestWeek ?? game.week, game.week) : legacy.bestWeek,
      };
      writeLegacy(legacy);
    }
    persist(game);
    set({
      game,
      legacy,
      saveMeta: metaOf(game),
      hasSave: true,
      toast: null,
      modal: game.phase === "play" ? get().modal : "none",
      pulse: result.fx === "hit" || result.fx === "raid" ? get().pulse + 1 : get().pulse,
    });
    if (result.fx) playSound(result.fx);
  },

  closeWeek: () => {
    const game = get().game;
    if (!game) return;
    if (combatOf(game).ambush) { set({ toast: "Resolve the ambush first." }); return; }
    if (game.encounters?.pending) { set({ toast: "Answer your contact first." }); return; }
    get().commit(endWeek(game));
  },

  choose: (optionId) => {
    const game = get().game;
    if (!game) return;
    get().commit(resolveChoice(game, optionId));
  },

  nextWeek: () => {
    const game = get().game;
    if (!game) return;
    get().commit(continueReport(game));
  },

  grantAdReward: () => {
    const game = get().game;
    if (!game || game.phase !== "play" || combatOf(game).ambush || cityMapOf(game).order) return false;
    const key = `razor-city-ad-reward-week-${game.week}`;
    try {
      if (localStorage.getItem(key) === "1") {
        set({ toast: "Ad bonus already claimed this week." });
        return false;
      }
      localStorage.setItem(key, "1");
    } catch { /* continue without persistence guard */ }
    const rewarded = { ...game, cash: game.cash + 1000 };
    persist(rewarded);
    set({ game: rewarded, saveMeta: metaOf(rewarded), toast: "$1,000 sponsor bonus added." });
    playSound("tick");
    return true;
  },

  setModal: (modal) => set({ modal }),

  travel: (waypoints) => {
    const game = get().game;
    if (game) get().commit(issueCityOrder(game, waypoints));
  },

  orderAttack: (id, soldiers) => {
    const game = get().game;
    if (game) get().commit(soldiers < 1
      ? { ok: false, error: "Send at least one soldier." }
      : issueCityOrder(game, [id], soldiers));
  },

  tickCity: () => {
    const game = get().game;
    if (!game) return;
    const result = completeCityOrder(game);
    if (!result) return;
    // Unlock only inside this synchronous completion, then use normal save/legacy handling.
    set({ game: { ...game, cityMap: { ...cityMapOf(game), order: null } } });
    get().commit(result);
  },

  refreshWallet: async () => { try { const wallet = await creditWallet(); set({ premiumBalance: wallet.balance }); } catch { /* earned credits remain usable offline */ } },
  buyWeapon: id => { const g = get().game; if (g) get().commit(buyWeapon(g, id)); },
  equipWeapon: id => { const g = get().game; if (g) get().commit(equipWeapon(g, id)); },
  resolveAmbush: choice => { const g = get().game; if (g) get().commit(resolveAmbush(g, choice)); },
  trainCombat: async () => {
    const game = get().game; if (!game || get().billingBusy) return;
    const amount = Math.max(0, trainingCost(game) - combatOf(game).credits);
    const result = trainCombat(game, amount);
    if (!result.ok) { get().commit(result); return; }
    if (!amount) { get().commit(result); return; }
    if (amount > get().premiumBalance) { set({ toast: "Win fights to earn Street Credits, or visit the credit shop." }); return; }
    const id = `training_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    try { localStorage.setItem(TRAINING_JOURNAL, JSON.stringify({ id, amount, after: result.state })); }
    catch { set({ toast: "Could not save your training. No credits charged." }); return; }
    set({ billingBusy: true });
    try {
      const wallet = await spendCredits(id, amount);
      if (!persist(result.state)) throw new Error("Save unavailable");
      localStorage.removeItem(TRAINING_JOURNAL);
      set({ billingBusy: false, premiumBalance: wallet.balance });
      get().commit(result);
    } catch (error) {
      if ((error as { code?: string }).code === "INSUFFICIENT_CREDITS") { localStorage.removeItem(TRAINING_JOURNAL); set({ billingBusy: false, toast: "Not enough purchased credits. No credits charged." }); }
      else set({ billingBusy: true, toast: "Training payment is being recovered. Reopen the game to retry safely." });
    }
  },
  tradeRegion: (region, product, quantity, side) => { const game = get().game; if (game) get().commit(tradeRegion(game, region, product, quantity, side)); },
  tickContacts: () => {
    const game = get().game;
    if (!game || get().billingBusy || combatOf(game).ambush || get().modal !== "none") return;
    const result = tickEncounters(game);
    if (!result?.ok) return;
    persist(result.state);
    set({ game: result.state, saveMeta: metaOf(result.state) });
    if (result.state.encounters?.pending) playSound("tick");
  },
  decideDeal: (id, accept) => { const game = get().game; if (game) get().commit(decideDeal(game, id, accept)); },
  deliverDeal: id => { const game = get().game; if (game) get().commit(deliverDeal(game, id)); },
  replyToCrew: choice => { const game = get().game; if (game) get().commit(resolveTalk(game, choice)); },
  clearToast: () => set({ toast: null }),

  toggleMute: () => {
    const muted = !get().muted;
    setAudioMuted(muted);
    if (!muted) unlockAudio();
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    set({ muted });
    resumeAudio();
  },
}));
