import { create } from "zustand";
import { playSound, resumeAudio, setAudioMuted, unlockAudio } from "@/game/audio";
import { continueReport, createGame, endWeek, isGameState, netWorth, resolveChoice, setSelected } from "@/game/logic";
import type { GameState, StartOpts } from "@/game/types";
import type { Result } from "@/game/logic";

const SAVE_KEY = "razor-city-save-v1";
const LEGACY_KEY = "razor-city-legacy-v1";
const MUTE_KEY = "razor-city-muted";

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
  } catch {
    /* ignore quota */
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
    return isGameState(parsed) ? parsed : null;
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

  boot: () => {
    if (get().booted) return;
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
    persist(null);
    set({ screen: "start", game: null, hasSave: false, saveMeta: null, modal: "none", toast: null });
  },

  select: (id) => {
    const game = get().game;
    if (!game) return;
    const result = setSelected(game, id);
    if (!result.ok) return;
    persist(result.state);
    set({ game: result.state });
  },

  commit: (result) => {
    if (!result.ok) {
      playSound("bad");
      set({ toast: result.error });
      return;
    }
    const prev = get().game;
    const game = result.state;
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
    if (!game || game.phase !== "play") return false;
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
