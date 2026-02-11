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

  // Earth types (9-12)
  { id: 9, name: 'Terrox', element: 'earth', baseAttack: 35, baseDefense: 55, baseSpeed: 20, baseHp: 120, ability: 'Earthquake' },
  { id: 10, name: 'Bouldern', element: 'earth', baseAttack: 40, baseDefense: 50, baseSpeed: 25, baseHp: 115, ability: 'Fortify' },
  { id: 11, name: 'Crysthorn', element: 'earth', baseAttack: 48, baseDefense: 45, baseSpeed: 22, baseHp: 105, ability: 'Earthquake' },
  { id: 12, name: 'Mossback', element: 'earth', baseAttack: 32, baseDefense: 60, baseSpeed: 18, baseHp: 125, ability: 'Fortify' },

  // Air types (13-16)
  { id: 13, name: 'Gustal', element: 'air', baseAttack: 42, baseDefense: 28, baseSpeed: 55, baseHp: 90, ability: 'Cyclone' },
  { id: 14, name: 'Zephyrix', element: 'air', baseAttack: 38, baseDefense: 30, baseSpeed: 60, baseHp: 85, ability: 'Haste' },
  { id: 15, name: 'Aurorix', element: 'air', baseAttack: 45, baseDefense: 25, baseSpeed: 50, baseHp: 88, ability: 'Cyclone' },
  { id: 16, name: 'Cloudwisp', element: 'air', baseAttack: 35, baseDefense: 35, baseSpeed: 48, baseHp: 95, ability: 'Haste' },

  // Dark types (17-18)
  { id: 17, name: 'Shadowmere', element: 'dark', baseAttack: 50, baseDefense: 30, baseSpeed: 42, baseHp: 95, ability: 'Void Strike' },
  { id: 18, name: 'Nocturne', element: 'dark', baseAttack: 45, baseDefense: 35, baseSpeed: 38, baseHp: 100, ability: 'Curse' },

  // Light types (19-20)
  { id: 19, name: 'Solaris', element: 'light', baseAttack: 42, baseDefense: 40, baseSpeed: 35, baseHp: 105, ability: 'Radiance' },
  { id: 20, name: 'Luminara', element: 'light', baseAttack: 38, baseDefense: 45, baseSpeed: 32, baseHp: 110, ability: 'Purify' },
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
