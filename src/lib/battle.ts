import { randomInt } from 'crypto';
import {
  Battle,
  BattleCard,
  BattleMove,
  BattleEvent,
  PlayerState,
  Card,
  BattleAction,
  TriangleResult,
  StatusEffect,
  BattleTurnLog,
  BattleLog,
  Element,
} from './types';

// =============================================================================
// INITIALIZATION
// =============================================================================

export function initializeBattleCard(card: Card): BattleCard {
  // Handle both formats: nested stats object or flat fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = card as any;
  const stats = card.stats || {
    hp: c.hp || (c.attack || 30) + (c.defense || 30),
    maxHp: c.maxHp || (c.attack || 30) + (c.defense || 30),
    attack: c.attack || 30,
    defense: c.defense || 30,
    speed: c.speed || 20,
  };
  const ability = card.ability || {
    name: 'Strike',
    effect: 'damage' as const,
    power: 20,
    cooldown: 2,
    currentCooldown: 0,
    description: 'A basic attack',
  };
  return {
    ...card,
    stats,
    currentHp: stats.hp,
    buffs: [],
    debuffs: [],
    statusEffects: [],
    isStunned: false,
    ability: {
      ...ability,
      currentCooldown: 0,
    },
  };
}

// =============================================================================
// ELEMENT MATCHUPS
// =============================================================================

/**
 * Element advantage system:
 * - fire > earth > air > water > fire (2x damage)
 * - light <> dark (1.5x damage to each other)
 * - same element (0.75x resistance)
 */
export function getElementMultiplier(attacker: Element, defender: Element): number {
  // Same element = resistance
  if (attacker === defender) return 0.75;

  // Fire > Earth > Air > Water > Fire
  const cycle: Record<Element, Element> = {
    fire: 'earth',
    earth: 'air',
    air: 'water',
    water: 'fire',
    light: 'dark',
    dark: 'light',
  };

  // Check super effective (2x for main cycle)
  if (cycle[attacker] === defender) {
    // Light and dark only do 1.5x to each other
    if ((attacker === 'light' && defender === 'dark') ||
        (attacker === 'dark' && defender === 'light')) {
      return 1.5;
    }
    return 2.0;
  }

  // Check not very effective (0.5x)
  if (cycle[defender] === attacker) {
    if ((attacker === 'light' && defender === 'dark') ||
        (attacker === 'dark' && defender === 'light')) {
      return 1.5; // Light/dark is mutual
    }
    return 0.5;
  }

  return 1.0;
}

// =============================================================================
// ACTION TRIANGLE
// =============================================================================

/**
 * Action Triangle Resolution:
 * - STRIKE beats SKILL (interrupt, cancel their move, deal damage)
 * - SKILL beats GUARD (pierce defense, full ability damage)
 * - GUARD beats STRIKE (reduce incoming damage 70%, counter for 30%)
 * - Same action = neutral (both execute with speed determining order)
 * - SWITCH always happens first before combat resolves
 */
export function resolveTriangle(action1: BattleAction, action2: BattleAction): {
  player1Result: TriangleResult;
  player2Result: TriangleResult;
} {
  // Switch is handled separately, treat as neutral for triangle
  if (action1 === 'switch' || action2 === 'switch') {
    return { player1Result: 'neutral', player2Result: 'neutral' };
  }

  // Same action = neutral
  if (action1 === action2) {
    return { player1Result: 'neutral', player2Result: 'neutral' };
  }

  // STRIKE beats SKILL
  if (action1 === 'strike' && action2 === 'skill') {
    return { player1Result: 'win', player2Result: 'lose' };
  }
  if (action1 === 'skill' && action2 === 'strike') {
    return { player1Result: 'lose', player2Result: 'win' };
  }

  // SKILL beats GUARD
  if (action1 === 'skill' && action2 === 'guard') {
    return { player1Result: 'win', player2Result: 'lose' };
  }
  if (action1 === 'guard' && action2 === 'skill') {
    return { player1Result: 'lose', player2Result: 'win' };
  }

  // GUARD beats STRIKE
  if (action1 === 'guard' && action2 === 'strike') {
    return { player1Result: 'win', player2Result: 'lose' };
  }
  if (action1 === 'strike' && action2 === 'guard') {
    return { player1Result: 'lose', player2Result: 'win' };
  }

  // Fallback (shouldn't reach here)
  return { player1Result: 'neutral', player2Result: 'neutral' };
}

// =============================================================================
// STAT CALCULATIONS
// =============================================================================

export function getActiveCard(player: PlayerState): BattleCard {
  return player.cards[player.activeCardIndex];
}

function getEffectiveStat(card: BattleCard, stat: 'attack' | 'defense' | 'speed'): number {
  let value = card.stats[stat];

  // Apply old-style buffs (for backwards compatibility)
  for (const buff of card.buffs) {
    if (buff.stat === stat) {
      value += buff.amount;
    }
  }

  // Apply old-style debuffs (for backwards compatibility)
  for (const debuff of card.debuffs) {
    if (debuff.type === 'curse') {
      value -= debuff.power;
    }
  }

  // Apply new status effects
  for (const effect of card.statusEffects) {
    switch (effect.type) {
      case 'attack_up':
        if (stat === 'attack') value += effect.power;
        break;
      case 'attack_down':
        if (stat === 'attack') value -= effect.power;
        break;
      case 'defense_up':
        if (stat === 'defense') value += effect.power;
        break;
      case 'defense_down':
        if (stat === 'defense') value -= effect.power;
        break;
      case 'speed_up':
        if (stat === 'speed') value += effect.power;
        break;
      case 'speed_down':
        if (stat === 'speed') value -= effect.power;
        break;
    }
  }

  return Math.max(1, value);
}

// =============================================================================
// DAMAGE CALCULATION
// =============================================================================

/**
 * Damage Formula:
 * base damage = attack stat (STRIKE) or ability power (SKILL)
 * × element multiplier (2.0 super effective, 0.5 not effective, 1.5 light/dark, 0.75 same, 1.0 neutral)
 * × triangle result (1.3 if won, 1.0 if neutral, 0.5 if lost)
 * × defense reduction (unless SKILL pierced GUARD)
 * × random variance (0.9 to 1.1)
 * = floor(result)
 */
export function calculateDamage(
  attacker: BattleCard,
  defender: BattleCard,
  basePower: number,
  triangleResult: TriangleResult,
  pierceDefense: boolean = false,
  attackerMoodMultiplier: number = 1
): { damage: number; elementMultiplier: number; triangleMultiplier: number } {
  const attack = getEffectiveStat(attacker, 'attack');
  const defense = getEffectiveStat(defender, 'defense');
  const elementMultiplier = getElementMultiplier(attacker.element, defender.element);

  // Triangle multiplier
  const triangleMultiplier = triangleResult === 'win' ? 1.3 : triangleResult === 'lose' ? 0.5 : 1.0;

  // Base calculation
  let damage = basePower * (attack / 50); // Scale with attack stat

  // Apply element multiplier
  damage *= elementMultiplier;

  // Apply triangle result
  damage *= triangleMultiplier;

  // Mood impact: confident/hyped agents do slightly more, tilted slightly less.
  damage *= attackerMoodMultiplier;

  // Apply defense reduction (unless piercing)
  if (!pierceDefense) {
    const defenseReduction = defense / (defense + 50);
    damage *= (1 - defenseReduction * 0.5);
  }

  // Random variance (90-110%)
  const variance = 0.9 + (randomInt(0, 1000) / 5000);
  damage *= variance;

  return {
    damage: Math.floor(Math.max(1, damage)),
    elementMultiplier,
    triangleMultiplier,
  };
}

// =============================================================================
// STATUS EFFECTS
// =============================================================================

export function applyStatusEffect(card: BattleCard, effect: StatusEffect): void {
  // Check if already has this effect type
  const existingIndex = card.statusEffects.findIndex(e => e.type === effect.type);
  if (existingIndex >= 0) {
    // Refresh duration if new effect is longer
    if (effect.turnsRemaining > card.statusEffects[existingIndex].turnsRemaining) {
      card.statusEffects[existingIndex] = effect;
    }
  } else {
    card.statusEffects.push(effect);
  }
}

export function processStatusEffects(card: BattleCard): BattleEvent[] {
  const events: BattleEvent[] = [];

  for (const effect of card.statusEffects) {
    switch (effect.type) {
      case 'burn':
        // Burn deals damage ignoring defense
        const burnDamage = Math.min(card.currentHp, effect.power);
        card.currentHp -= burnDamage;
        events.push({
          type: 'status_tick',
          source: effect.source,
          target: card.name,
          value: burnDamage,
          message: `🔥 ${card.name} takes ${burnDamage} burn damage!`,
        });
        break;

      case 'regen':
        // Heal over time
        const healAmount = Math.min(card.stats.maxHp - card.currentHp, effect.power);
        card.currentHp += healAmount;
        if (healAmount > 0) {
          events.push({
            type: 'status_tick',
            source: effect.source,
            target: card.name,
            value: healAmount,
            message: `💚 ${card.name} regenerates ${healAmount} HP!`,
          });
        }
        break;

      case 'stun':
        card.isStunned = true;
        events.push({
          type: 'status_tick',
          source: effect.source,
          target: card.name,
          message: `⚡ ${card.name} is stunned and cannot act!`,
        });
        break;
    }
  }

  return events;
}

export function tickStatusEffects(card: BattleCard): BattleEvent[] {
  const events: BattleEvent[] = [];

  // Clear stun flag (it gets re-applied if effect is still active)
  card.isStunned = false;

  // Decrease turns and remove expired effects
  card.statusEffects = card.statusEffects.filter(effect => {
    effect.turnsRemaining--;
    if (effect.turnsRemaining <= 0) {
      events.push({
        type: 'status_expired',
        source: effect.source,
        target: card.name,
        message: `${card.name}'s ${effect.type} wore off.`,
      });
      return false;
    }
    return true;
  });

  // Also tick old-style buffs/debuffs for compatibility
  card.buffs = card.buffs.filter(buff => {
    buff.turnsRemaining--;
    return buff.turnsRemaining > 0;
  });

  card.debuffs = card.debuffs.filter(debuff => {
    debuff.turnsRemaining--;
    return debuff.turnsRemaining > 0;
  });

  return events;
}

// =============================================================================
// ABILITY EFFECTS
// =============================================================================

function getStatusFromAbility(
  ability: BattleCard['ability'],
  attackerElement: Element,
  targetName: string
): StatusEffect | null {
  switch (ability.effect) {
    case 'dot':
      return {
        type: 'burn',
        power: ability.power,
        turnsRemaining: 3,
        source: targetName,
      };
    case 'buff':
      // Determine buff type based on ability name or element
      if (ability.name.toLowerCase().includes('fortify')) {
        return { type: 'defense_up', power: ability.power, turnsRemaining: 3, source: targetName };
      }
      if (ability.name.toLowerCase().includes('haste') || attackerElement === 'air') {
        return { type: 'speed_up', power: ability.power, turnsRemaining: 3, source: targetName };
      }
      return { type: 'attack_up', power: ability.power, turnsRemaining: 3, source: targetName };
    case 'debuff':
      return { type: 'attack_down', power: ability.power, turnsRemaining: 3, source: targetName };
    case 'heal':
      // Check if it's a heal over time or instant
      if (ability.name.toLowerCase().includes('regen')) {
        return { type: 'regen', power: ability.power, turnsRemaining: 3, source: targetName };
      }
      return null;
    default:
      return null;
  }
}

// =============================================================================
// TURN RESOLUTION
// =============================================================================

function isCardFainted(card: BattleCard): boolean {
  return card.currentHp <= 0;
}

function hasAliveCards(player: PlayerState): boolean {
  return player.cards.some(card => card.currentHp > 0);
}

function findNextAliveCard(player: PlayerState): number {
  return player.cards.findIndex(card => card.currentHp > 0);
}

function applyDamage(card: BattleCard, damage: number): number {
  const actualDamage = Math.min(card.currentHp, damage);
  card.currentHp -= actualDamage;
  return actualDamage;
}

function applyHeal(card: BattleCard, amount: number): number {
  const maxHeal = card.stats.maxHp - card.currentHp;
  const actualHeal = Math.min(maxHeal, amount);
  card.currentHp += actualHeal;
  return actualHeal;
}

function tickCooldowns(card: BattleCard): void {
  if (card.ability.currentCooldown && card.ability.currentCooldown > 0) {
    card.ability.currentCooldown--;
  }
}

/**
 * Main turn resolution with simultaneous reveal and action triangle
 */
export function resolveTurn(
  battle: Battle,
  move1: BattleMove,
  move2: BattleMove
): { events: BattleEvent[]; winner: string | null; turnLog: BattleTurnLog } {
  const events: BattleEvent[] = [];

  const card1 = getActiveCard(battle.player1);
  const card2 = getActiveCard(battle.player2!);
  const mood1 = Math.max(0, Math.min(100, Math.round((battle.player1.mood ?? 60))));
  const mood2 = Math.max(0, Math.min(100, Math.round((battle.player2?.mood ?? 60))));
  const moodMultiplier1 = 1 + ((mood1 - 50) / 50) * 0.12;
  const moodMultiplier2 = 1 + ((mood2 - 50) / 50) * 0.12;

  // Log the turn start
  const turnLog: BattleTurnLog = {
    turn: battle.currentTurn,
    player1: {
      address: battle.player1.address,
      activeCard: card1.name,
      cardHp: card1.currentHp,
      action: move1.action,
      prediction: move1.prediction,
      reasoning: move1.reasoning,
      aiModel: move1.aiModel,
    },
    player2: {
      address: battle.player2!.address,
      activeCard: card2.name,
      cardHp: card2.currentHp,
      action: move2.action,
      prediction: move2.prediction,
      reasoning: move2.reasoning,
      aiModel: move2.aiModel,
    },
    triangleResult: { player1Result: 'neutral', player2Result: 'neutral' },
    events: [],
    timestamp: new Date(),
  };

  // ======================
  // PHASE 1: Action Reveal
  // ======================
  events.push({
    type: 'action_reveal',
    source: battle.player1.address,
    target: battle.player2!.address,
    action: move1.action,
    message: `${card1.name} chooses ${move1.action.toUpperCase()}!`,
    reasoning: move1.reasoning,
    prediction: move1.prediction,
    aiModel: move1.aiModel,
  });

  events.push({
    type: 'action_reveal',
    source: battle.player2!.address,
    target: battle.player1.address,
    action: move2.action,
    message: `${card2.name} chooses ${move2.action.toUpperCase()}!`,
    reasoning: move2.reasoning,
    prediction: move2.prediction,
    aiModel: move2.aiModel,
  });

  // ======================
  // PHASE 2: Process Status Effects (start of turn)
  // ======================
  events.push(...processStatusEffects(card1));
  events.push(...processStatusEffects(card2));

  // Check for faints from status damage
  if (isCardFainted(card1)) {
    events.push({
      type: 'faint',
      source: 'status',
      target: card1.name,
      message: `${card1.name} fainted from status effects!`,
    });
  }
  if (isCardFainted(card2)) {
    events.push({
      type: 'faint',
      source: 'status',
      target: card2.name,
      message: `${card2.name} fainted from status effects!`,
    });
  }

  // ======================
  // PHASE 3: Switch Actions (always resolve first)
  // ======================
  if (move1.action === 'switch' && !isCardFainted(card1)) {
    const targetIndex = move1.targetIndex ?? 0;
    const targetCard = battle.player1.cards[targetIndex];
    if (targetCard && targetCard.currentHp > 0 && targetIndex !== battle.player1.activeCardIndex) {
      battle.player1.activeCardIndex = targetIndex;
      events.push({
        type: 'switch',
        source: card1.name,
        target: targetCard.name,
        message: `${card1.name} switches out for ${targetCard.name}!`,
      });
    }
  }

  if (move2.action === 'switch' && !isCardFainted(card2)) {
    const targetIndex = move2.targetIndex ?? 0;
    const targetCard = battle.player2!.cards[targetIndex];
    if (targetCard && targetCard.currentHp > 0 && targetIndex !== battle.player2!.activeCardIndex) {
      battle.player2!.activeCardIndex = targetIndex;
      events.push({
        type: 'switch',
        source: card2.name,
        target: targetCard.name,
        message: `${card2.name} switches out for ${targetCard.name}!`,
      });
    }
  }

  // Get potentially updated active cards after switches
  const activeCard1 = getActiveCard(battle.player1);
  const activeCard2 = getActiveCard(battle.player2!);

  // ======================
  // PHASE 4: Triangle Resolution (only for combat actions)
  // ======================
  const triangleResult = resolveTriangle(move1.action, move2.action);
  turnLog.triangleResult = triangleResult;

  if (move1.action !== 'switch' && move2.action !== 'switch') {
    events.push({
      type: 'triangle_result',
      source: battle.player1.address,
      target: battle.player2!.address,
      triangleResult: triangleResult.player1Result,
      message: getTriangleMessage(move1.action, move2.action, triangleResult),
    });
  }

  // ======================
  // PHASE 5: Execute Combat Based on Triangle
  // ======================

  // Skip combat if both switched
  if (move1.action === 'switch' && move2.action === 'switch') {
    // Nothing to do, just tick cooldowns
  }
  // Handle stunned cards
  else if (activeCard1.isStunned && move1.action !== 'switch') {
    events.push({
      type: 'status_tick',
      source: 'stun',
      target: activeCard1.name,
      message: `${activeCard1.name} is stunned and cannot act!`,
    });
  }
  else if (activeCard2.isStunned && move2.action !== 'switch') {
    events.push({
      type: 'status_tick',
      source: 'stun',
      target: activeCard2.name,
      message: `${activeCard2.name} is stunned and cannot act!`,
    });
  }
  // GUARD vs GUARD: Both heal 10%, nothing else happens
  else if (move1.action === 'guard' && move2.action === 'guard') {
    const heal1 = applyHeal(activeCard1, Math.floor(activeCard1.stats.maxHp * 0.1));
    const heal2 = applyHeal(activeCard2, Math.floor(activeCard2.stats.maxHp * 0.1));

    events.push({
      type: 'heal',
      source: activeCard1.name,
      target: activeCard1.name,
      value: heal1,
      message: `🛡️ ${activeCard1.name} guards and recovers ${heal1} HP!`,
    });
    events.push({
      type: 'heal',
      source: activeCard2.name,
      target: activeCard2.name,
      value: heal2,
      message: `🛡️ ${activeCard2.name} guards and recovers ${heal2} HP!`,
    });
  }
  // STRIKE beats SKILL: Interrupt opponent's skill
  else if (move1.action === 'strike' && move2.action === 'skill') {
    events.push({
      type: 'interrupt',
      source: activeCard1.name,
      target: activeCard2.name,
      message: `⚡ ${activeCard1.name}'s STRIKE interrupts ${activeCard2.name}'s SKILL!`,
    });

    const { damage, elementMultiplier } = calculateDamage(activeCard1, activeCard2, 30, 'win', false, moodMultiplier1);
    if (elementMultiplier !== 1.0) {
      events.push({
        type: 'element_advantage',
        source: activeCard1.name,
        target: activeCard2.name,
        elementMultiplier,
        message: getElementMessage(activeCard1.element, activeCard2.element, elementMultiplier),
      });
    }
    const actualDamage = applyDamage(activeCard2, damage);
    events.push({
      type: 'damage',
      source: activeCard1.name,
      target: activeCard2.name,
      value: actualDamage,
      message: `⚔️ ${activeCard1.name} strikes ${activeCard2.name} for ${actualDamage} damage!`,
    });

    if (isCardFainted(activeCard2)) {
      events.push({
        type: 'faint',
        source: activeCard1.name,
        target: activeCard2.name,
        message: `💀 ${activeCard2.name} fainted!`,
      });
    }
  }
  else if (move2.action === 'strike' && move1.action === 'skill') {
    events.push({
      type: 'interrupt',
      source: activeCard2.name,
      target: activeCard1.name,
      message: `⚡ ${activeCard2.name}'s STRIKE interrupts ${activeCard1.name}'s SKILL!`,
    });

    const { damage, elementMultiplier } = calculateDamage(activeCard2, activeCard1, 30, 'win', false, moodMultiplier2);
    if (elementMultiplier !== 1.0) {
      events.push({
        type: 'element_advantage',
        source: activeCard2.name,
        target: activeCard1.name,
        elementMultiplier,
        message: getElementMessage(activeCard2.element, activeCard1.element, elementMultiplier),
      });
    }
    const actualDamage = applyDamage(activeCard1, damage);
    events.push({
      type: 'damage',
      source: activeCard2.name,
      target: activeCard1.name,
      value: actualDamage,
      message: `⚔️ ${activeCard2.name} strikes ${activeCard1.name} for ${actualDamage} damage!`,
    });

    if (isCardFainted(activeCard1)) {
      events.push({
        type: 'faint',
        source: activeCard2.name,
        target: activeCard1.name,
        message: `💀 ${activeCard1.name} fainted!`,
      });
    }
  }
  // SKILL beats GUARD: Pierce defense, full ability damage
  else if (move1.action === 'skill' && move2.action === 'guard') {
    events.push({
      type: 'skill_pierce',
      source: activeCard1.name,
      target: activeCard2.name,
      message: `✨ ${activeCard1.name}'s SKILL pierces ${activeCard2.name}'s GUARD!`,
    });

    events.push(...executeSkill(activeCard1, activeCard2, 'win', true));
  }
  else if (move2.action === 'skill' && move1.action === 'guard') {
    events.push({
      type: 'skill_pierce',
      source: activeCard2.name,
      target: activeCard1.name,
      message: `✨ ${activeCard2.name}'s SKILL pierces ${activeCard1.name}'s GUARD!`,
    });

    events.push(...executeSkill(activeCard2, activeCard1, 'win', true));
  }
  // GUARD beats STRIKE: Reduce damage 70%, counter 30%
  else if (move1.action === 'guard' && move2.action === 'strike') {
    events.push({
      type: 'guard_counter',
      source: activeCard1.name,
      target: activeCard2.name,
      message: `🛡️ ${activeCard1.name}'s GUARD blocks ${activeCard2.name}'s STRIKE!`,
    });

    // Reduced incoming damage
    const { damage: incomingDamage } = calculateDamage(activeCard2, activeCard1, 30, 'lose', false, moodMultiplier2);
    const reducedDamage = Math.floor(incomingDamage * 0.3);
    const actualDamage = applyDamage(activeCard1, reducedDamage);
    events.push({
      type: 'damage',
      source: activeCard2.name,
      target: activeCard1.name,
      value: actualDamage,
      message: `${activeCard1.name} blocks and takes only ${actualDamage} damage!`,
    });

    // Counter attack (30% of normal strike)
    const { damage: counterDamage } = calculateDamage(activeCard1, activeCard2, 30 * 0.3, 'win', false, moodMultiplier1);
    const actualCounter = applyDamage(activeCard2, counterDamage);
    events.push({
      type: 'damage',
      source: activeCard1.name,
      target: activeCard2.name,
      value: actualCounter,
      message: `⚔️ ${activeCard1.name} counters for ${actualCounter} damage!`,
    });

    if (isCardFainted(activeCard2)) {
      events.push({
        type: 'faint',
        source: activeCard1.name,
        target: activeCard2.name,
        message: `💀 ${activeCard2.name} fainted!`,
      });
    }
  }
  else if (move2.action === 'guard' && move1.action === 'strike') {
    events.push({
      type: 'guard_counter',
      source: activeCard2.name,
      target: activeCard1.name,
      message: `🛡️ ${activeCard2.name}'s GUARD blocks ${activeCard1.name}'s STRIKE!`,
    });

    const { damage: incomingDamage } = calculateDamage(activeCard1, activeCard2, 30, 'lose', false, moodMultiplier1);
    const reducedDamage = Math.floor(incomingDamage * 0.3);
    const actualDamage = applyDamage(activeCard2, reducedDamage);
    events.push({
      type: 'damage',
      source: activeCard1.name,
      target: activeCard2.name,
      value: actualDamage,
      message: `${activeCard2.name} blocks and takes only ${actualDamage} damage!`,
    });

    const { damage: counterDamage } = calculateDamage(activeCard2, activeCard1, 30 * 0.3, 'win', false, moodMultiplier2);
    const actualCounter = applyDamage(activeCard1, counterDamage);
    events.push({
      type: 'damage',
      source: activeCard2.name,
      target: activeCard1.name,
      value: actualCounter,
      message: `⚔️ ${activeCard2.name} counters for ${actualCounter} damage!`,
    });

    if (isCardFainted(activeCard1)) {
      events.push({
        type: 'faint',
        source: activeCard2.name,
        target: activeCard1.name,
        message: `💀 ${activeCard1.name} fainted!`,
      });
    }
  }
  // STRIKE vs STRIKE: Both deal damage, speed determines order
  else if (move1.action === 'strike' && move2.action === 'strike') {
    const speed1 = getEffectiveStat(activeCard1, 'speed');
    const speed2 = getEffectiveStat(activeCard2, 'speed');

    const [first, second] = speed1 >= speed2
      ? [{ card: activeCard1, opponent: activeCard2, player: 'player1' }]
      .concat([{ card: activeCard2, opponent: activeCard1, player: 'player2' }])
      : [{ card: activeCard2, opponent: activeCard1, player: 'player2' }]
      .concat([{ card: activeCard1, opponent: activeCard2, player: 'player1' }]);

    for (const attacker of [first, second]) {
      if (!isCardFainted(attacker.card) && !isCardFainted(attacker.opponent)) {
        const attackerMood = attacker.player === 'player1' ? moodMultiplier1 : moodMultiplier2;
        const { damage, elementMultiplier } = calculateDamage(attacker.card, attacker.opponent, 30, 'neutral', false, attackerMood);
        if (elementMultiplier !== 1.0) {
          events.push({
            type: 'element_advantage',
            source: attacker.card.name,
            target: attacker.opponent.name,
            elementMultiplier,
            message: getElementMessage(attacker.card.element, attacker.opponent.element, elementMultiplier),
          });
        }
        const actualDamage = applyDamage(attacker.opponent, damage);
        events.push({
          type: 'damage',
          source: attacker.card.name,
          target: attacker.opponent.name,
          value: actualDamage,
          message: `⚔️ ${attacker.card.name} strikes ${attacker.opponent.name} for ${actualDamage} damage!`,
        });

        if (isCardFainted(attacker.opponent)) {
          events.push({
            type: 'faint',
            source: attacker.card.name,
            target: attacker.opponent.name,
            message: `💀 ${attacker.opponent.name} fainted!`,
          });
        }
      }
    }
  }
  // SKILL vs SKILL: Both abilities fire, speed determines order
  else if (move1.action === 'skill' && move2.action === 'skill') {
    const speed1 = getEffectiveStat(activeCard1, 'speed');
    const speed2 = getEffectiveStat(activeCard2, 'speed');

    const [first, second] = speed1 >= speed2
      ? [{ card: activeCard1, opponent: activeCard2 }].concat([{ card: activeCard2, opponent: activeCard1 }])
      : [{ card: activeCard2, opponent: activeCard1 }].concat([{ card: activeCard1, opponent: activeCard2 }]);

    for (const attacker of [first, second]) {
      if (!isCardFainted(attacker.card)) {
        events.push(...executeSkill(attacker.card, attacker.opponent, 'neutral', false));
      }
    }
  }
  // Handle switch + combat action
  else if (move1.action === 'switch' && move2.action !== 'switch') {
    if (!activeCard2.isStunned) {
      if (move2.action === 'strike') {
        const { damage, elementMultiplier } = calculateDamage(activeCard2, activeCard1, 30, 'neutral', false, moodMultiplier2);
        if (elementMultiplier !== 1.0) {
          events.push({
            type: 'element_advantage',
            source: activeCard2.name,
            target: activeCard1.name,
            elementMultiplier,
            message: getElementMessage(activeCard2.element, activeCard1.element, elementMultiplier),
          });
        }
        const actualDamage = applyDamage(activeCard1, damage);
        events.push({
          type: 'damage',
          source: activeCard2.name,
          target: activeCard1.name,
          value: actualDamage,
          message: `⚔️ ${activeCard2.name} strikes ${activeCard1.name} for ${actualDamage} damage!`,
        });

        if (isCardFainted(activeCard1)) {
          events.push({
            type: 'faint',
            source: activeCard2.name,
            target: activeCard1.name,
            message: `💀 ${activeCard1.name} fainted!`,
          });
        }
      } else if (move2.action === 'skill') {
        events.push(...executeSkill(activeCard2, activeCard1, 'neutral', false));
      } else if (move2.action === 'guard') {
        const heal = applyHeal(activeCard2, Math.floor(activeCard2.stats.maxHp * 0.1));
        events.push({
          type: 'heal',
          source: activeCard2.name,
          target: activeCard2.name,
          value: heal,
          message: `🛡️ ${activeCard2.name} guards and recovers ${heal} HP!`,
        });
      }
    }
  }
  else if (move2.action === 'switch' && move1.action !== 'switch') {
    if (!activeCard1.isStunned) {
      if (move1.action === 'strike') {
        const { damage, elementMultiplier } = calculateDamage(activeCard1, activeCard2, 30, 'neutral', false, moodMultiplier1);
        if (elementMultiplier !== 1.0) {
          events.push({
            type: 'element_advantage',
            source: activeCard1.name,
            target: activeCard2.name,
            elementMultiplier,
            message: getElementMessage(activeCard1.element, activeCard2.element, elementMultiplier),
          });
        }
        const actualDamage = applyDamage(activeCard2, damage);
        events.push({
          type: 'damage',
          source: activeCard1.name,
          target: activeCard2.name,
          value: actualDamage,
          message: `⚔️ ${activeCard1.name} strikes ${activeCard2.name} for ${actualDamage} damage!`,
        });

        if (isCardFainted(activeCard2)) {
          events.push({
            type: 'faint',
            source: activeCard1.name,
            target: activeCard2.name,
            message: `💀 ${activeCard2.name} fainted!`,
          });
        }
      } else if (move1.action === 'skill') {
        events.push(...executeSkill(activeCard1, activeCard2, 'neutral', false));
      } else if (move1.action === 'guard') {
        const heal = applyHeal(activeCard1, Math.floor(activeCard1.stats.maxHp * 0.1));
        events.push({
          type: 'heal',
          source: activeCard1.name,
          target: activeCard1.name,
          value: heal,
          message: `🛡️ ${activeCard1.name} guards and recovers ${heal} HP!`,
        });
      }
    }
  }

  // ======================
  // PHASE 6: Auto-switch fainted cards
  // ======================
  if (isCardFainted(getActiveCard(battle.player1)) && hasAliveCards(battle.player1)) {
    const nextIndex = findNextAliveCard(battle.player1);
    if (nextIndex !== -1) {
      battle.player1.activeCardIndex = nextIndex;
      events.push({
        type: 'switch',
        source: 'auto',
        target: battle.player1.cards[nextIndex].name,
        message: `${battle.player1.address} sends out ${battle.player1.cards[nextIndex].name}!`,
      });
    }
  }

  if (isCardFainted(getActiveCard(battle.player2!)) && hasAliveCards(battle.player2!)) {
    const nextIndex = findNextAliveCard(battle.player2!);
    if (nextIndex !== -1) {
      battle.player2!.activeCardIndex = nextIndex;
      events.push({
        type: 'switch',
        source: 'auto',
        target: battle.player2!.cards[nextIndex].name,
        message: `${battle.player2!.address} sends out ${battle.player2!.cards[nextIndex].name}!`,
      });
    }
  }

  // ======================
  // PHASE 7: Tick effects and cooldowns
  // ======================
  for (const card of battle.player1.cards) {
    events.push(...tickStatusEffects(card));
    tickCooldowns(card);
  }
  for (const card of battle.player2!.cards) {
    events.push(...tickStatusEffects(card));
    tickCooldowns(card);
  }

  // ======================
  // PHASE 8: Check win condition
  // ======================
  let winner: string | null = null;
  if (!hasAliveCards(battle.player1)) {
    winner = battle.player2!.address;
    events.push({
      type: 'battle_end',
      source: battle.player2!.address,
      target: battle.player1.address,
      message: `🏆 ${battle.player2!.address} wins the battle!`,
    });
  } else if (!hasAliveCards(battle.player2!)) {
    winner = battle.player1.address;
    events.push({
      type: 'battle_end',
      source: battle.player1.address,
      target: battle.player2!.address,
      message: `🏆 ${battle.player1.address} wins the battle!`,
    });
  }

  turnLog.events = events;

  return { events, winner, turnLog };
}

// =============================================================================
// SKILL EXECUTION
// =============================================================================

function executeSkill(
  attacker: BattleCard,
  defender: BattleCard,
  triangleResult: TriangleResult,
  pierceDefense: boolean
): BattleEvent[] {
  const events: BattleEvent[] = [];
  const ability = attacker.ability;

  // Check cooldown
  if (ability.currentCooldown && ability.currentCooldown > 0) {
    events.push({
      type: 'damage',
      source: attacker.name,
      target: defender.name,
      value: 0,
      message: `${attacker.name}'s ${ability.name} is on cooldown (${ability.currentCooldown} turns)!`,
    });
    return events;
  }

  // Put ability on cooldown
  ability.currentCooldown = ability.cooldown;

  switch (ability.effect) {
    case 'damage': {
      const { damage, elementMultiplier } = calculateDamage(attacker, defender, ability.power, triangleResult, pierceDefense);
      if (elementMultiplier !== 1.0) {
        events.push({
          type: 'element_advantage',
          source: attacker.name,
          target: defender.name,
          elementMultiplier,
          message: getElementMessage(attacker.element, defender.element, elementMultiplier),
        });
      }
      const actualDamage = applyDamage(defender, damage);
      events.push({
        type: 'damage',
        source: attacker.name,
        target: defender.name,
        value: actualDamage,
        message: `✨ ${attacker.name} uses ${ability.name} on ${defender.name} for ${actualDamage} damage!`,
      });

      if (isCardFainted(defender)) {
        events.push({
          type: 'faint',
          source: attacker.name,
          target: defender.name,
          message: `💀 ${defender.name} fainted!`,
        });
      }
      break;
    }

    case 'heal': {
      const healAmount = applyHeal(attacker, ability.power);
      events.push({
        type: 'heal',
        source: attacker.name,
        target: attacker.name,
        value: healAmount,
        message: `💚 ${attacker.name} uses ${ability.name} and heals for ${healAmount} HP!`,
      });
      break;
    }

    case 'buff': {
      const statusEffect = getStatusFromAbility(ability, attacker.element, attacker.name);
      if (statusEffect) {
        applyStatusEffect(attacker, statusEffect);
        events.push({
          type: 'status_applied',
          source: attacker.name,
          target: attacker.name,
          value: ability.power,
          message: `⬆️ ${attacker.name} uses ${ability.name}! ${statusEffect.type.replace('_', ' ')} activated!`,
        });
      }
      break;
    }

    case 'debuff': {
      const statusEffect = getStatusFromAbility(ability, attacker.element, attacker.name);
      if (statusEffect) {
        applyStatusEffect(defender, statusEffect);
        events.push({
          type: 'status_applied',
          source: attacker.name,
          target: defender.name,
          value: ability.power,
          message: `⬇️ ${attacker.name} uses ${ability.name} on ${defender.name}! ${statusEffect.type.replace('_', ' ')} applied!`,
        });
      }
      break;
    }

    case 'dot': {
      const burnEffect: StatusEffect = {
        type: 'burn',
        power: ability.power,
        turnsRemaining: 3,
        source: attacker.name,
      };
      applyStatusEffect(defender, burnEffect);
      events.push({
        type: 'status_applied',
        source: attacker.name,
        target: defender.name,
        value: ability.power,
        message: `🔥 ${attacker.name} uses ${ability.name}! ${defender.name} is burning!`,
      });
      break;
    }
  }

  return events;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getTriangleMessage(action1: BattleAction, action2: BattleAction, result: { player1Result: TriangleResult; player2Result: TriangleResult }): string {
  if (result.player1Result === 'neutral') {
    return `${action1.toUpperCase()} vs ${action2.toUpperCase()} - Both actions execute!`;
  }

  const winner = result.player1Result === 'win' ? action1 : action2;
  const loser = result.player1Result === 'win' ? action2 : action1;

  if (winner === 'strike' && loser === 'skill') {
    return `⚡ STRIKE interrupts SKILL!`;
  }
  if (winner === 'skill' && loser === 'guard') {
    return `✨ SKILL pierces GUARD!`;
  }
  if (winner === 'guard' && loser === 'strike') {
    return `🛡️ GUARD blocks and counters STRIKE!`;
  }

  return `${winner.toUpperCase()} beats ${loser.toUpperCase()}!`;
}

function getElementMessage(attackerElement: Element, defenderElement: Element, multiplier: number): string {
  if (multiplier === 2.0) {
    return `🔥 Super effective! ${attackerElement.toUpperCase()} beats ${defenderElement.toUpperCase()}!`;
  }
  if (multiplier === 1.5) {
    return `✨ ${attackerElement.toUpperCase()} is strong against ${defenderElement.toUpperCase()}!`;
  }
  if (multiplier === 0.75) {
    return `🛡️ ${defenderElement.toUpperCase()} resists ${attackerElement.toUpperCase()}!`;
  }
  if (multiplier === 0.5) {
    return `❌ Not very effective! ${defenderElement.toUpperCase()} is strong against ${attackerElement.toUpperCase()}!`;
  }
  return '';
}

// =============================================================================
// MOVE VALIDATION
// =============================================================================

export function validateMove(
  battle: Battle,
  playerAddress: string,
  move: BattleMove
): { valid: boolean; error?: string } {
  const isPlayer1 = battle.player1.address.toLowerCase() === playerAddress.toLowerCase();
  const playerState = isPlayer1 ? battle.player1 : battle.player2;

  if (!playerState) {
    return { valid: false, error: 'Player not found in battle' };
  }

  const activeCard = getActiveCard(playerState);

  // Stunned cards can only switch
  if (activeCard.isStunned && move.action !== 'switch') {
    return { valid: false, error: 'Card is stunned and can only switch' };
  }

  if (move.action === 'switch') {
    const targetIndex = move.targetIndex ?? 0;
    if (targetIndex < 0 || targetIndex >= playerState.cards.length) {
      return { valid: false, error: 'Invalid switch target' };
    }
    if (targetIndex === playerState.activeCardIndex) {
      return { valid: false, error: 'Cannot switch to current card' };
    }
    if (playerState.cards[targetIndex].currentHp <= 0) {
      return { valid: false, error: 'Cannot switch to fainted card' };
    }
  }

  if (move.action === 'skill') {
    if (activeCard.ability.currentCooldown && activeCard.ability.currentCooldown > 0) {
      return { valid: false, error: `Ability on cooldown for ${activeCard.ability.currentCooldown} more turns` };
    }
  }

  return { valid: true };
}

// =============================================================================
// AI VS AI BATTLE SIMULATION
// =============================================================================

/**
 * Simulates a complete AI vs AI battle
 * Used for the async battle mode where both players deposit and AI plays for them
 */
export async function simulateAIBattle(
  battle: Battle,
  getAIMove: (battle: Battle, playerAddress: string, personality?: string) => Promise<BattleMove>
): Promise<BattleLog> {
  const startTime = Date.now();
  const turns: BattleTurnLog[] = [];
  let totalDamagePlayer1 = 0;
  let totalDamagePlayer2 = 0;
  let faintsPlayer1 = 0;
  let faintsPlayer2 = 0;

  // Initialize the battle log
  const battleLog: BattleLog = {
    battleId: battle.battleId,
    player1: {
      address: battle.player1.address,
      cards: battle.player1.cards.map(c => ({ id: c.id || '', name: c.name, element: c.element })),
      isAI: true,
    },
    player2: {
      address: battle.player2!.address,
      cards: battle.player2!.cards.map(c => ({ id: c.id || '', name: c.name, element: c.element })),
      isAI: true,
    },
    wager: battle.wager,
    turns: [],
    winner: '',
    totalDamageDealt: { player1: 0, player2: 0 },
    cardsFainted: { player1: 0, player2: 0 },
    duration: 0,
    startedAt: new Date(),
    endedAt: new Date(),
  };

  // Battle start event (can be used for initial turn log)
  const _startEvents: BattleEvent[] = [{
    type: 'battle_start',
    source: battle.player1.address,
    target: battle.player2!.address,
    message: `⚔️ Battle begins! ${battle.player1.address} vs ${battle.player2!.address}`,
  }];

  // Run turns until there's a winner or max turns reached
  const MAX_TURNS = 50;
  let winner: string | null = null;

  while (!winner && battle.currentTurn < MAX_TURNS) {
    battle.currentTurn++;

    // Get AI moves for both players (in parallel)
    const [move1, move2] = await Promise.all([
      getAIMove(battle, battle.player1.address),
      getAIMove(battle, battle.player2!.address),
    ]);

    // Resolve the turn
    const { events, winner: turnWinner, turnLog } = resolveTurn(battle, move1, move2);

    // Track stats
    for (const event of events) {
      if (event.type === 'damage' && event.value) {
        if (event.source === getActiveCard(battle.player1).name) {
          totalDamagePlayer1 += event.value;
        } else {
          totalDamagePlayer2 += event.value;
        }
      }
      if (event.type === 'faint') {
        // Determine which player's card fainted
        const p1Cards = battle.player1.cards.map(c => c.name);
        if (p1Cards.includes(event.target)) {
          faintsPlayer1++;
        } else {
          faintsPlayer2++;
        }
      }
    }

    turns.push(turnLog);
    battle.rounds.push({
      turn: battle.currentTurn,
      player1Move: move1,
      player2Move: move2,
      triangleResult: turnLog.triangleResult,
      events,
      timestamp: new Date(),
    });

    winner = turnWinner;
  }

  const endTime = Date.now();

  battleLog.turns = turns;
  battleLog.winner = winner || (battle.currentTurn >= MAX_TURNS ? 'draw' : '');
  battleLog.totalDamageDealt = { player1: totalDamagePlayer1, player2: totalDamagePlayer2 };
  battleLog.cardsFainted = { player1: faintsPlayer1, player2: faintsPlayer2 };
  battleLog.duration = endTime - startTime;
  battleLog.endedAt = new Date();

  return battleLog;
}

// Export for backwards compatibility
export { getElementMultiplier as getElementAdvantage };
