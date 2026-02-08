import { LocationDef } from "../types/game";

export const LOCATIONS: LocationDef[] = [
  {
    id: "starter_town",
    name: "Starter Town",
    dangerLevel: 1,
    actions: ["rest", "sleep", "eat", "buy", "sell", "heal_automon", "travel"],
    connections: [
      { to: "town_arena", travelTicks: 1 },
      { to: "green_meadows", travelTicks: 1 },
      { to: "town_market", travelTicks: 1 },
      { to: "community_farm", travelTicks: 1 },
    ],
    spawnTable: [
      { speciesId: "cindercub", weight: 3, minLevel: 1, maxLevel: 4 },
      { speciesId: "sparkit", weight: 3, minLevel: 1, maxLevel: 4 },
      { speciesId: "lumina", weight: 1, minLevel: 4, maxLevel: 6 },
    ],
  },
  {
    id: "town_arena",
    name: "Town Arena",
    dangerLevel: 2,
    actions: ["battle_pve", "battle_pvp", "train_automon", "travel"],
    connections: [
      { to: "starter_town", travelTicks: 1 },
      { to: "town_market", travelTicks: 1 },
    ],
    spawnTable: [],
  },
  {
    id: "green_meadows",
    name: "Green Meadows",
    dangerLevel: 2,
    actions: ["explore", "catch_automon", "gather", "travel"],
    connections: [
      { to: "starter_town", travelTicks: 1 },
      { to: "old_pond", travelTicks: 1 },
      { to: "dark_forest", travelTicks: 2 },
    ],
    spawnTable: [
      { speciesId: "sparkit", weight: 6, minLevel: 1, maxLevel: 7 },
      { speciesId: "spriglet", weight: 6, minLevel: 1, maxLevel: 7 },
      { speciesId: "mistrail", weight: 3, minLevel: 3, maxLevel: 8 },
    ],
  },
  {
    id: "old_pond",
    name: "Old Pond",
    dangerLevel: 2,
    actions: ["fish", "explore", "catch_automon", "travel"],
    connections: [
      { to: "green_meadows", travelTicks: 1 },
      { to: "river_delta", travelTicks: 2 },
    ],
    spawnTable: [
      { speciesId: "drizzlefin", weight: 8, minLevel: 2, maxLevel: 8 },
      { speciesId: "mistrail", weight: 2, minLevel: 3, maxLevel: 7 },
    ],
  },
  {
    id: "community_farm",
    name: "Community Farm",
    dangerLevel: 1,
    actions: ["plant", "water", "harvest", "travel"],
    connections: [
      { to: "starter_town", travelTicks: 1 },
      { to: "town_market", travelTicks: 1 },
    ],
    spawnTable: [{ speciesId: "spriglet", weight: 4, minLevel: 1, maxLevel: 6 }],
  },
  {
    id: "town_market",
    name: "Town Market",
    dangerLevel: 1,
    actions: ["buy", "sell", "craft", "travel"],
    connections: [
      { to: "starter_town", travelTicks: 1 },
      { to: "town_arena", travelTicks: 1 },
      { to: "community_farm", travelTicks: 1 },
      { to: "river_delta", travelTicks: 2 },
    ],
    spawnTable: [],
  },
  {
    id: "dark_forest",
    name: "Dark Forest",
    dangerLevel: 5,
    actions: ["explore", "catch_automon", "gather", "battle_pve", "travel"],
    connections: [
      { to: "green_meadows", travelTicks: 2 },
      { to: "crystal_caves", travelTicks: 2 },
    ],
    spawnTable: [
      { speciesId: "gloomimp", weight: 6, minLevel: 6, maxLevel: 13 },
      { speciesId: "pyrofang", weight: 2, minLevel: 10, maxLevel: 15 },
      { speciesId: "umbrahowl", weight: 1, minLevel: 14, maxLevel: 18 },
    ],
  },
  {
    id: "river_delta",
    name: "River Delta",
    dangerLevel: 3,
    actions: ["fish", "catch_automon", "explore", "travel"],
    connections: [
      { to: "old_pond", travelTicks: 2 },
      { to: "town_market", travelTicks: 2 },
      { to: "crystal_caves", travelTicks: 2 },
    ],
    spawnTable: [
      { speciesId: "drizzlefin", weight: 5, minLevel: 5, maxLevel: 12 },
      { speciesId: "torrenthorn", weight: 2, minLevel: 10, maxLevel: 16 },
      { speciesId: "mistrail", weight: 3, minLevel: 6, maxLevel: 12 },
    ],
  },
  {
    id: "crystal_caves",
    name: "Crystal Caves",
    dangerLevel: 7,
    actions: ["mine", "explore", "catch_automon", "battle_pve", "travel"],
    connections: [
      { to: "dark_forest", travelTicks: 2 },
      { to: "river_delta", travelTicks: 2 },
    ],
    spawnTable: [
      { speciesId: "aeronyx", weight: 3, minLevel: 12, maxLevel: 20 },
      { speciesId: "umbrahowl", weight: 2, minLevel: 12, maxLevel: 20 },
      { speciesId: "solaris", weight: 1, minLevel: 18, maxLevel: 24 },
      { speciesId: "thornox", weight: 4, minLevel: 10, maxLevel: 17 },
    ],
  },
];

export const LOCATION_BY_ID: Record<string, LocationDef> = LOCATIONS.reduce((acc, location) => {
  acc[location.id] = location;
  return acc;
}, {} as Record<string, LocationDef>);
