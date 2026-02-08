import { AbilityDef } from "../types/game";

export const ABILITIES: AbilityDef[] = [
  { id: "ember_burst", name: "Ember Burst", element: "fire", power: 18, staminaCost: 10, unlockLevel: 1 },
  { id: "flare_lash", name: "Flare Lash", element: "fire", power: 28, staminaCost: 18, unlockLevel: 8 },
  { id: "tidal_jab", name: "Tidal Jab", element: "water", power: 17, staminaCost: 9, unlockLevel: 1 },
  { id: "wave_crush", name: "Wave Crush", element: "water", power: 29, staminaCost: 18, unlockLevel: 9 },
  { id: "stone_knuckle", name: "Stone Knuckle", element: "earth", power: 20, staminaCost: 11, unlockLevel: 1 },
  { id: "fault_spike", name: "Fault Spike", element: "earth", power: 31, staminaCost: 20, unlockLevel: 10 },
  { id: "gale_slice", name: "Gale Slice", element: "air", power: 16, staminaCost: 8, unlockLevel: 1 },
  { id: "cyclone_drive", name: "Cyclone Drive", element: "air", power: 27, staminaCost: 17, unlockLevel: 8 },
  { id: "volt_peck", name: "Volt Peck", element: "electric", power: 19, staminaCost: 10, unlockLevel: 1 },
  { id: "thunder_roll", name: "Thunder Roll", element: "electric", power: 30, staminaCost: 19, unlockLevel: 9 },
  { id: "shade_bite", name: "Shade Bite", element: "shadow", power: 21, staminaCost: 12, unlockLevel: 1 },
  { id: "night_maw", name: "Night Maw", element: "shadow", power: 33, staminaCost: 20, unlockLevel: 11 },
  { id: "lumen_strike", name: "Lumen Strike", element: "light", power: 21, staminaCost: 12, unlockLevel: 1 },
  { id: "solar_surge", name: "Solar Surge", element: "light", power: 32, staminaCost: 20, unlockLevel: 11 },
];

export const ABILITY_BY_ID: Record<string, AbilityDef> = ABILITIES.reduce((acc, ability) => {
  acc[ability.id] = ability;
  return acc;
}, {} as Record<string, AbilityDef>);
