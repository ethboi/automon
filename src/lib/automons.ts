import { Element } from './types';

export interface AutoMonType {
  id: number;
  name: string;
  element: Element;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  baseHp: number;
  ability: string;
}

export const AUTOMONS: AutoMonType[] = [
  // Fire types (1-4)
  { id: 1, name: 'Blazeon', element: 'fire', baseAttack: 45, baseDefense: 30, baseSpeed: 40, baseHp: 100, ability: 'Inferno' },
  { id: 2, name: 'Emberwing', element: 'fire', baseAttack: 38, baseDefense: 35, baseSpeed: 45, baseHp: 95, ability: 'Burn' },
  { id: 3, name: 'Magmor', element: 'fire', baseAttack: 50, baseDefense: 40, baseSpeed: 25, baseHp: 110, ability: 'Inferno' },
  { id: 4, name: 'Cindercat', element: 'fire', baseAttack: 35, baseDefense: 25, baseSpeed: 55, baseHp: 85, ability: 'Burn' },

  // Water types (5-8)
  { id: 5, name: 'Aquaris', element: 'water', baseAttack: 40, baseDefense: 40, baseSpeed: 35, baseHp: 105, ability: 'Tsunami' },
  { id: 6, name: 'Tidalon', element: 'water', baseAttack: 45, baseDefense: 35, baseSpeed: 38, baseHp: 100, ability: 'Heal' },
  { id: 7, name: 'Coralix', element: 'water', baseAttack: 30, baseDefense: 50, baseSpeed: 30, baseHp: 115, ability: 'Tsunami' },
  { id: 8, name: 'Frostfin', element: 'water', baseAttack: 42, baseDefense: 32, baseSpeed: 45, baseHp: 90, ability: 'Heal' },

  // Earth types (9-11)
  { id: 9, name: 'Terrox', element: 'earth', baseAttack: 35, baseDefense: 55, baseSpeed: 20, baseHp: 120, ability: 'Earthquake' },
  { id: 10, name: 'Bouldern', element: 'earth', baseAttack: 40, baseDefense: 50, baseSpeed: 25, baseHp: 115, ability: 'Fortify' },
  { id: 11, name: 'Crysthorn', element: 'earth', baseAttack: 48, baseDefense: 45, baseSpeed: 22, baseHp: 105, ability: 'Earthquake' },

  // Air types (12-14)
  { id: 12, name: 'Zephyrix', element: 'air', baseAttack: 38, baseDefense: 28, baseSpeed: 55, baseHp: 90, ability: 'Cyclone' },
  { id: 13, name: 'Stormwing', element: 'air', baseAttack: 45, baseDefense: 25, baseSpeed: 50, baseHp: 85, ability: 'Haste' },
  { id: 14, name: 'Gustal', element: 'air', baseAttack: 35, baseDefense: 32, baseSpeed: 52, baseHp: 95, ability: 'Cyclone' },

  // Dark types (15-17)
  { id: 15, name: 'Shadowmere', element: 'dark', baseAttack: 48, baseDefense: 30, baseSpeed: 42, baseHp: 95, ability: 'Void Strike' },
  { id: 16, name: 'Voidling', element: 'dark', baseAttack: 42, baseDefense: 35, baseSpeed: 40, baseHp: 100, ability: 'Curse' },
  { id: 17, name: 'Noxfang', element: 'dark', baseAttack: 52, baseDefense: 28, baseSpeed: 38, baseHp: 90, ability: 'Void Strike' },

  // Light types (18-20)
  { id: 18, name: 'Luxara', element: 'light', baseAttack: 40, baseDefense: 42, baseSpeed: 38, baseHp: 105, ability: 'Radiance' },
  { id: 19, name: 'Solaris', element: 'light', baseAttack: 45, baseDefense: 38, baseSpeed: 35, baseHp: 100, ability: 'Purify' },
  { id: 20, name: 'Aurorix', element: 'light', baseAttack: 38, baseDefense: 45, baseSpeed: 32, baseHp: 110, ability: 'Radiance' },
];

export const RARITY_MULTIPLIERS = {
  common: 1.0,
  uncommon: 1.2,
  rare: 1.5,
  epic: 1.8,
  legendary: 2.2,
} as const;

export const RARITY_WEIGHTS = [
  { rarity: 'common', weight: 60 },
  { rarity: 'uncommon', weight: 25 },
  { rarity: 'rare', weight: 10 },
  { rarity: 'epic', weight: 4 },
  { rarity: 'legendary', weight: 1 },
] as const;

export function getAutoMonById(id: number): AutoMonType | undefined {
  return AUTOMONS.find(a => a.id === id);
}

export function getAutoMonsByElement(element: Element): AutoMonType[] {
  return AUTOMONS.filter(a => a.element === element);
}
