import { Card, Element, Rarity, Ability, CardStats } from './types';
import { AUTOMONS, RARITY_MULTIPLIERS, AutoMonType } from './automons';
import { v4 as uuidv4 } from 'uuid';

const RARITY_WEIGHTS: { rarity: Rarity; weight: number }[] = [
  { rarity: 'common', weight: 60 },
  { rarity: 'uncommon', weight: 25 },
  { rarity: 'rare', weight: 10 },
  { rarity: 'epic', weight: 4 },
  { rarity: 'legendary', weight: 1 },
];

// Ability definitions by name
const ABILITY_DEFINITIONS: Record<string, Omit<Ability, 'currentCooldown'>> = {
  Inferno: { name: 'Inferno', effect: 'damage', power: 40, cooldown: 3, description: 'Deals heavy fire damage' },
  Burn: { name: 'Burn', effect: 'dot', power: 10, cooldown: 4, description: 'Burns target for 3 turns' },
  Tsunami: { name: 'Tsunami', effect: 'damage', power: 35, cooldown: 3, description: 'Crashes a wave of water' },
  Heal: { name: 'Heal', effect: 'heal', power: 30, cooldown: 4, description: 'Restores HP' },
  Earthquake: { name: 'Earthquake', effect: 'damage', power: 38, cooldown: 3, description: 'Shakes the ground violently' },
  Fortify: { name: 'Fortify', effect: 'buff', power: 20, cooldown: 4, description: 'Increases defense' },
  Cyclone: { name: 'Cyclone', effect: 'damage', power: 32, cooldown: 2, description: 'Summons a devastating cyclone' },
  Haste: { name: 'Haste', effect: 'buff', power: 15, cooldown: 3, description: 'Increases speed' },
  'Void Strike': { name: 'Void Strike', effect: 'damage', power: 45, cooldown: 4, description: 'Strikes from the void' },
  Curse: { name: 'Curse', effect: 'debuff', power: 15, cooldown: 4, description: 'Curses target, reducing stats' },
  Radiance: { name: 'Radiance', effect: 'damage', power: 36, cooldown: 3, description: 'Blasts with pure light' },
  Purify: { name: 'Purify', effect: 'heal', power: 20, cooldown: 3, description: 'Removes debuffs and heals' },
};

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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

function getAbilityForAutoMon(automon: AutoMonType, rarity: Rarity): Ability {
  const baseAbility = ABILITY_DEFINITIONS[automon.ability];
  if (!baseAbility) {
    // Fallback to generic damage ability
    return {
      name: automon.ability,
      effect: 'damage',
      power: 30,
      cooldown: 3,
      description: `${automon.name}'s special ability`,
      currentCooldown: 0,
    };
  }

  const multiplier = RARITY_MULTIPLIERS[rarity];
  return {
    ...baseAbility,
    power: Math.floor(baseAbility.power * multiplier),
    currentCooldown: 0,
  };
}

function generateStatsFromAutoMon(automon: AutoMonType, rarity: Rarity): CardStats {
  const multiplier = RARITY_MULTIPLIERS[rarity];

  const hp = Math.floor(automon.baseHp * multiplier);

  return {
    attack: Math.floor(automon.baseAttack * multiplier),
    defense: Math.floor(automon.baseDefense * multiplier),
    speed: Math.floor(automon.baseSpeed * multiplier),
    hp,
    maxHp: hp,
  };
}

/**
 * Generate a card from an AutoMon type with a random rarity
 */
export function generateCardFromAutoMon(
  owner: string,
  packId: string,
  automonId?: number,
  tokenId?: number,
  rarity?: Rarity
): Card {
  // Pick a random AutoMon if not specified
  const automon = automonId
    ? AUTOMONS.find(a => a.id === automonId) || randomElement(AUTOMONS)
    : randomElement(AUTOMONS);

  const cardRarity = rarity || rollRarity();

  return {
    id: uuidv4(),
    tokenId,
    automonId: automon.id,
    owner,
    name: automon.name,
    element: automon.element,
    rarity: cardRarity,
    stats: generateStatsFromAutoMon(automon, cardRarity),
    ability: getAbilityForAutoMon(automon, cardRarity),
    level: 1,
    xp: 0,
    packId,
    createdAt: new Date(),
  };
}

/**
 * Generate a card using the old random name system (for backwards compatibility)
 * @deprecated Use generateCardFromAutoMon instead
 */
export function generateCard(owner: string, packId: string): Card {
  return generateCardFromAutoMon(owner, packId);
}

/**
 * Generate a pack of 3 cards (to match NFT contract)
 */
export function generatePack(owner: string, packId: string): Card[] {
  return Array.from({ length: 3 }, () => generateCardFromAutoMon(owner, packId));
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

/**
 * Convert on-chain rarity index to Rarity type
 */
export function rarityFromIndex(index: number): Rarity {
  const rarities: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  return rarities[index] || 'common';
}

/**
 * Get image URL for an AutoMon
 */
export function getAutoMonImageUrl(automonId: number): string {
  return `/images/automons/${automonId}.svg`;
}
