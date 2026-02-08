import { SpeciesDef } from "../types/game";

export const SPECIES: SpeciesDef[] = [
  { id: "sparkit", name: "Sparkit", element: "electric", rarity: "common", habitats: ["green_meadows"], baseStats: { attack: 8, defense: 6, speed: 10, stamina: 12 }, personalityPool: ["playful", "bold", "curious"], evolveAtLevel: 10, evolvesTo: "voltruff", baseAbilities: ["volt_peck"] },
  { id: "voltruff", name: "Voltruff", element: "electric", rarity: "rare", habitats: ["river_delta", "crystal_caves"], baseStats: { attack: 14, defense: 10, speed: 16, stamina: 16 }, personalityPool: ["fierce", "loyal"], baseAbilities: ["volt_peck", "thunder_roll"] },
  { id: "spriglet", name: "Spriglet", element: "earth", rarity: "common", habitats: ["green_meadows", "community_farm"], baseStats: { attack: 9, defense: 9, speed: 7, stamina: 12 }, personalityPool: ["calm", "gentle", "stubborn"], evolveAtLevel: 12, evolvesTo: "thornox", baseAbilities: ["stone_knuckle"] },
  { id: "thornox", name: "Thornox", element: "earth", rarity: "rare", habitats: ["dark_forest", "crystal_caves"], baseStats: { attack: 16, defense: 15, speed: 8, stamina: 18 }, personalityPool: ["stoic", "guarded"], baseAbilities: ["stone_knuckle", "fault_spike"] },
  { id: "cindercub", name: "Cindercub", element: "fire", rarity: "common", habitats: ["starter_town", "dark_forest"], baseStats: { attack: 10, defense: 7, speed: 9, stamina: 11 }, personalityPool: ["brash", "friendly", "reckless"], evolveAtLevel: 11, evolvesTo: "pyrofang", baseAbilities: ["ember_burst"] },
  { id: "pyrofang", name: "Pyrofang", element: "fire", rarity: "rare", habitats: ["dark_forest", "crystal_caves"], baseStats: { attack: 17, defense: 11, speed: 13, stamina: 15 }, personalityPool: ["feral", "proud"], baseAbilities: ["ember_burst", "flare_lash"] },
  { id: "drizzlefin", name: "Drizzlefin", element: "water", rarity: "common", habitats: ["old_pond", "river_delta"], baseStats: { attack: 9, defense: 8, speed: 8, stamina: 13 }, personalityPool: ["chill", "social", "timid"], evolveAtLevel: 10, evolvesTo: "torrenthorn", baseAbilities: ["tidal_jab"] },
  { id: "torrenthorn", name: "Torrenthorn", element: "water", rarity: "rare", habitats: ["river_delta"], baseStats: { attack: 15, defense: 12, speed: 10, stamina: 18 }, personalityPool: ["confident", "watchful"], baseAbilities: ["tidal_jab", "wave_crush"] },
  { id: "mistrail", name: "Mistrail", element: "air", rarity: "uncommon", habitats: ["green_meadows", "river_delta"], baseStats: { attack: 8, defense: 7, speed: 14, stamina: 12 }, personalityPool: ["skittish", "clever", "restless"], evolveAtLevel: 13, evolvesTo: "aeronyx", baseAbilities: ["gale_slice"] },
  { id: "aeronyx", name: "Aeronyx", element: "air", rarity: "epic", habitats: ["crystal_caves"], baseStats: { attack: 14, defense: 11, speed: 19, stamina: 17 }, personalityPool: ["precise", "aloof"], baseAbilities: ["gale_slice", "cyclone_drive"] },
  { id: "gloomimp", name: "Gloomimp", element: "shadow", rarity: "uncommon", habitats: ["dark_forest"], baseStats: { attack: 12, defense: 8, speed: 11, stamina: 13 }, personalityPool: ["sly", "greedy", "chaotic"], evolveAtLevel: 14, evolvesTo: "umbrahowl", baseAbilities: ["shade_bite"] },
  { id: "umbrahowl", name: "Umbrahowl", element: "shadow", rarity: "epic", habitats: ["dark_forest", "crystal_caves"], baseStats: { attack: 19, defense: 12, speed: 14, stamina: 18 }, personalityPool: ["menacing", "cold"], baseAbilities: ["shade_bite", "night_maw"] },
  { id: "lumina", name: "Lumina", element: "light", rarity: "epic", habitats: ["starter_town", "crystal_caves"], baseStats: { attack: 16, defense: 14, speed: 12, stamina: 17 }, personalityPool: ["kind", "noble"], evolveAtLevel: 18, evolvesTo: "solaris", baseAbilities: ["lumen_strike"] },
  { id: "solaris", name: "Solaris", element: "light", rarity: "legendary", habitats: ["crystal_caves"], baseStats: { attack: 23, defense: 18, speed: 15, stamina: 22 }, personalityPool: ["regal", "unyielding"], baseAbilities: ["lumen_strike", "solar_surge"] },
];

export const SPECIES_BY_ID: Record<string, SpeciesDef> = SPECIES.reduce((acc, species) => {
  acc[species.id] = species;
  return acc;
}, {} as Record<string, SpeciesDef>);
