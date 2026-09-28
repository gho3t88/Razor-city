export type ProductId = "dust" | "velvet" | "ice" | "grow";
export type GangId = "vultures" | "lanterns" | "saints" | "cobras";
export type Owner = "player" | "neutral" | GangId;
export type Phase = "play" | "event" | "summary" | "won" | "lost";
export type Tone = "gold" | "blood" | "paper" | "mute";
export type Difficulty = "street" | "war";
export type Fx = "tick" | "cash" | "hit" | "bad" | "raid" | "win";

export interface ProductDef {
  id: ProductId;
  name: string;
  blurb: string;
  heat: number;
  volume: number;
  markup: number;
  baseWholesale: number;
}

export interface District {
  id: string;
  name: string;
  short: string;
  blurb: string;
  col: number;
  row: number;
  wealth: number;
  heatMod: number;
  lab: boolean;
  demand: Record<ProductId, number>;
  owner: Owner;
  defense: number;
  corners: number;
  loyalty: number;
  stationMuscle: number;
  stationDealers: number;
  focus: ProductId | "auto";
}

export interface Gang {
  id: GangId;
  name: string;
  tag: string;
  boss: string;
  blurb: string;
  portrait: string;
  muscle: number;
  cash: number;
  relation: number;
  truceWeeks: number;
  alive: boolean;
  home: string;
  aggression: number;
}

export interface LogLine {
  id: number;
  week: number;
  text: string;
  tone: Tone;
}

export interface ChoiceOption {
  id: string;
  label: string;
  detail: string;
}

export interface ChoiceEvent {
  id: string;
  title: string;
  body: string;
  subject?: GangId;
  options: ChoiceOption[];
}

export interface SaleLine {
  districtId: string;
  district: string;
  product: ProductId;
  units: number;
  cash: number;
  heat: number;
}

export interface WeekReport {
  closedWeek: number;
  lines: LogLine[];
  cashBefore: number;
  cashAfter: number;
  heatBefore: number;
  heatAfter: number;
  sold: SaleLine[];
}

export interface GameState {
  version: 1;
  seed: number;
  logSeq: number;
  difficulty: Difficulty;
  boss: string;
  crew: string;
  week: number;
  phase: Phase;
  cash: number;
  heat: number;
  respect: number;
  strikes: number;
  ap: number;
  maxAp: number;
  apPenalty: number;
  loud: boolean;
  crewCounts: { muscle: number; dealers: number };
  stash: Record<ProductId, number>;
  prices: Record<ProductId, { wholesale: number; street: number }>;
  districts: District[];
  gangs: Record<GangId, Gang>;
  log: LogLine[];
  selectedId: string;
  pending: ChoiceEvent | null;
  report: WeekReport | null;
  bonus: { product: ProductId; mult: number; weeks: number } | null;
  ending: string;
  stats: {
    earned: number;
    spent: number;
    blocksTaken: number;
    raids: number;
    productSold: number;
  };
}

export interface StartOpts {
  boss: string;
  crew: string;
  difficulty: Difficulty;
  seed?: number;
}
