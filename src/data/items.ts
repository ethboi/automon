import { ItemDef } from "../types/game";

export const ITEMS: ItemDef[] = [
  { id: "trail_ration", name: "Trail Ration", type: "food", price: 12, effects: { trainerHunger: 25 } },
  { id: "hearty_meal", name: "Hearty Meal", type: "food", price: 30, effects: { trainerHunger: 50, trainerEnergy: 10 } },
  { id: "automon_chow", name: "AutoMon Chow", type: "food", price: 16, effects: { automonHunger: 35, automonLoyalty: 3 } },
  { id: "lux_chow", name: "Lux Chow", type: "food", price: 40, effects: { automonHunger: 55, automonLoyalty: 8 } },
  { id: "basic_trap", name: "Basic Trap", type: "trap", price: 20 },
  { id: "pro_trap", name: "Pro Trap", type: "trap", price: 45 },
  { id: "bait", name: "Bait", type: "bait", price: 6 },
  { id: "ore", name: "Ore", type: "material", price: 18 },
  { id: "fiber", name: "Fiber", type: "material", price: 10 },
  { id: "herb", name: "Herb", type: "material", price: 14 },
  { id: "minor_potion", name: "Minor Potion", type: "potion", price: 24, effects: { automonHealth: 25 } },
  { id: "quick_berries_seed", name: "Quick Berries Seed", type: "seed", price: 8 },
  { id: "hearty_roots_seed", name: "Hearty Roots Seed", type: "seed", price: 14 },
  { id: "golden_apples_seed", name: "Golden Apples Seed", type: "seed", price: 28 },
];

export const ITEM_BY_ID: Record<string, ItemDef> = ITEMS.reduce((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {} as Record<string, ItemDef>);
