import { Card, Element, Rarity, Ability, CardStats } from './types';
import { v4 as uuidv4 } from 'uuid';

const PREFIXES: Record<Element, string[]> = {
  fire: ['Flame', 'Blaze', 'Ember', 'Inferno', 'Pyro', 'Scorch', 'Magma', 'Char'],
  water: ['Aqua', 'Hydro', 'Tide', 'Wave', 'Splash', 'Torrent', 'Reef', 'Coral'],
  earth: ['Terra', 'Rock', 'Stone', 'Geo', 'Boulder', 'Granite', 'Clay', 'Quake'],
  air: ['Zephyr', 'Gust', 'Breeze', 'Storm', 'Aero', 'Cyclone', 'Wisp', 'Gale'],
  dark: ['Shadow', 'Void', 'Umbra', 'Nox', 'Shade', 'Dusk', 'Obsidian', 'Phantom'],
  light: ['Lux', 'Radiant', 'Solar', 'Gleam', 'Prism', 'Aurora', 'Dawn', 'Halo'],
};

const SUFFIXES = [
  'claw', 'fang', 'wing', 'tail', 'heart', 'horn', 'scale', 'maw',
  'spine', 'paw', 'fin', 'talon', 'snout', 'shell', 'fury', 'spirit',
];

const RARITY_WEIGHTS: { rarity: Rarity; weight: number }[] = [
  { rarity: 'common', weight: 60 },
  { rarity: 'uncommon', weight: 25 },
  { rarity: 'rare', weight: 10 },
  { rarity: 'epic', weight: 4 },
  { rarity: 'legendary', weight: 1 },
];

const STAT_RANGES: Record<Rarity, { min: number; max: number }> = {
  common: { min: 10, max: 20 },
  uncommon: { min: 18, max: 30 },
  rare: { min: 28, max: 42 },
  epic: { min: 40, max: 55 },
  legendary: { min: 52, max: 70 },
};

const HP_MULTIPLIER: Record<Rarity, number> = {
  common: 5,
  uncommon: 6,
  rare: 7,
  epic: 8,
  legendary: 10,
};

const ABILITIES: Record<Element, Ability[]> = {
  fire: [
    { name: 'Inferno', effect: 'damage', power: 40, cooldown: 3, description: 'Deals heavy fire damage' },
    { name: 'Burn', effect: 'dot', power: 10, cooldown: 4, description: 'Burns target for 3 turns' },
  ],
  water: [
    { name: 'Tsunami', effect: 'damage', power: 35, cooldown: 3, description: 'Crashes a wave of water' },
    { name: 'Heal', effect: 'heal', power: 30, cooldown: 4, description: 'Restores HP' },
  ],
  earth: [
    { name: 'Earthquake', effect: 'damage', power: 38, cooldown: 3, description: 'Shakes the ground violently' },
    { name: 'Fortify', effect: 'buff', power: 20, cooldown: 4, description: 'Increases defense' },
  ],
  air: [
    { name: 'Cyclone', effect: 'damage', power: 32, cooldown: 2, description: 'Summons a devastating cyclone' },
    { name: 'Haste', effect: 'buff', power: 15, cooldown: 3, description: 'Increases speed' },
  ],
  dark: [
    { name: 'Void Strike', effect: 'damage', power: 45, cooldown: 4, description: 'Strikes from the void' },
    { name: 'Curse', effect: 'debuff', power: 15, cooldown: 4, description: 'Curses target, reducing stats' },
  ],
  light: [
    { name: 'Radiance', effect: 'damage', power: 36, cooldown: 3, description: 'Blasts with pure light' },
    { name: 'Purify', effect: 'heal', power: 20, cooldown: 3, description: 'Removes debuffs and heals' },
  ],
};

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollRarity(): Rarity {
  const roll = Math.random() * 100;
  let cumulative = 0;

  for (const { rarity, weight } of RARITY_WEIGHTS) {
    cumulative += weight;
    if (roll < cumulative) {
      return rarity;
    }
  }

  return 'common';
}

function generateName(element: Element): string {
  const prefix = randomElement(PREFIXES[element]);
  const suffix = randomElement(SUFFIXES);
  return `${prefix}${suffix}`;
}

function generateStats(rarity: Rarity): CardStats {
  const range = STAT_RANGES[rarity];
  const hpMultiplier = HP_MULTIPLIER[rarity];

  const baseHp = randomInRange(range.min, range.max) * hpMultiplier;

  return {
    attack: randomInRange(range.min, range.max),
    defense: randomInRange(range.min, range.max),
    speed: randomInRange(range.min, range.max),
    hp: baseHp,
    maxHp: baseHp,
  };
}

function generateAbility(element: Element, rarity: Rarity): Ability {
  const elementAbilities = ABILITIES[element];
  const ability = { ...randomElement(elementAbilities) };

  // Scale ability power with rarity
  const rarityMultipliers: Record<Rarity, number> = {
    common: 1,
    uncommon: 1.15,
    rare: 1.3,
    epic: 1.5,
    legendary: 1.8,
  };

  ability.power = Math.floor(ability.power * rarityMultipliers[rarity]);
  ability.currentCooldown = 0;

  return ability;
}

export function generateCard(owner: string, packId: string): Card {
  const element = randomElement<Element>(['fire', 'water', 'earth', 'air', 'dark', 'light']);
  const rarity = rollRarity();

  return {
    id: uuidv4(),
    owner,
    name: generateName(element),
    element,
    rarity,
    stats: generateStats(rarity),
    ability: generateAbility(element, rarity),
    level: 1,
    xp: 0,
    packId,
    createdAt: new Date(),
  };
}

export function generatePack(owner: string, packId: string): Card[] {
  return Array.from({ length: 5 }, () => generateCard(owner, packId));
}

export function getElementAdvantage(attacker: Element, defender: Element): number {
  const advantages: Record<Element, Element> = {
    fire: 'earth',
    earth: 'air',
    air: 'water',
    water: 'fire',
    dark: 'light',
    light: 'dark',
  };

  if (advantages[attacker] === defender) {
    return 1.5;
  }

  // Light and dark deal extra to each other
  if ((attacker === 'light' && defender === 'dark') || (attacker === 'dark' && defender === 'light')) {
    return 1.5;
  }

  return 1;
}

export function getRarityColor(rarity: Rarity): string {
  const colors: Record<Rarity, string> = {
    common: 'text-gray-400',
    uncommon: 'text-green-400',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-yellow-400',
  };
  return colors[rarity];
}

export function getElementColor(element: Element): string {
  const colors: Record<Element, string> = {
    fire: 'from-red-500 to-orange-500',
    water: 'from-blue-500 to-cyan-500',
    earth: 'from-amber-600 to-yellow-700',
    air: 'from-gray-300 to-blue-200',
    dark: 'from-purple-900 to-gray-900',
    light: 'from-yellow-300 to-white',
  };
  return colors[element];
}
