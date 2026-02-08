export type Element = "fire" | "water" | "earth" | "air" | "electric" | "shadow" | "light";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type Weather = "clear" | "rain" | "storm" | "fog" | "heat";
export type TimeOfDay = "dawn" | "morning" | "afternoon" | "evening" | "night";

export type AutoMonStatus = "healthy" | "injured" | "exhausted" | "fainted";

export interface Stats {
  attack: number;
  defense: number;
  speed: number;
  stamina: number;
}

export interface AbilityDef {
  id: string;
  name: string;
  element: Element;
  power: number;
  staminaCost: number;
  unlockLevel: number;
}

export interface SpeciesDef {
  id: string;
  name: string;
  element: Element;
  rarity: Rarity;
  habitats: string[];
  baseStats: Stats;
  personalityPool: string[];
  evolveAtLevel?: number;
  evolvesTo?: string;
  baseAbilities: string[];
}

export interface ItemDef {
  id: string;
  name: string;
  type: "food" | "trap" | "bait" | "material" | "potion" | "seed";
  price: number;
  effects?: Partial<Record<"trainerHunger" | "trainerEnergy" | "automonHunger" | "automonHealth" | "automonLoyalty", number>>;
}

export interface LocationConnection {
  to: string;
  travelTicks: number;
}

export interface SpawnEntry {
  speciesId: string;
  weight: number;
  minLevel: number;
  maxLevel: number;
}

export interface LocationDef {
  id: string;
  name: string;
  dangerLevel: number;
  actions: string[];
  connections: LocationConnection[];
  spawnTable: SpawnEntry[];
}

export interface MarketState {
  prices: Record<string, number>;
  trend: Record<string, "up" | "down" | "steady">;
}

export interface Inventory {
  [itemId: string]: number;
}

export interface AutoMon {
  id: string;
  speciesId: string;
  nickname: string;
  element: Element;
  level: number;
  xp: number;
  health: number;
  maxHealth: number;
  hunger: number;
  loyalty: number;
  stats: Stats;
  abilities: string[];
  status: AutoMonStatus;
  personality: string;
  staminaCurrent: number;
}

export interface CropPlot {
  cropType: "quick_berries" | "hearty_roots" | "golden_apples";
  plantedAtTick: number;
  wateredTicks: number;
  growthTicks: number;
}

export interface Trainer {
  id: string;
  name: string;
  health: number;
  energy: number;
  hunger: number;
  gold: number;
  locationId: string;
  inventory: Inventory;
  stableCapacity: number;
  automons: AutoMon[];
  crops: CropPlot[];
  busyUntilTick?: number;
  busyAction?: string;
  pendingTravelTo?: string;
  elo: number;
}

export interface AgentDecision {
  action: string;
  target?: string;
  reasoning: string;
}

export interface EventLog {
  tick: number;
  day: number;
  type: string;
  trainerId?: string;
  message: string;
  reasoning?: string;
}

export interface GameConfig {
  tickMs: number;
  ticksPerDay: number;
  maxLogEntries: number;
}

export interface GameState {
  tick: number;
  day: number;
  weather: Weather;
  timeOfDay: TimeOfDay;
  trainers: Trainer[];
  market: MarketState;
  events: EventLog[];
  leaderboard: Array<{ trainerId: string; elo: number }>;
}

export interface AgentContext {
  trainer: Trainer;
  nearbyAgents: Array<Pick<Trainer, "id" | "name" | "locationId" | "gold" | "elo">>;
  availableActions: string[];
  market: MarketState;
  location: LocationDef;
  recentEvents: EventLog[];
  worldTick: number;
  day: number;
  weather: Weather;
  timeOfDay: TimeOfDay;
}
