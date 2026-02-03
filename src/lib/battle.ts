import { Battle, BattleCard, BattleMove, BattleEvent, PlayerState, Card } from './types';
import { getElementAdvantage } from './cards';

export function initializeBattleCard(card: Card): BattleCard {
  return {
    ...card,
    currentHp: card.stats.hp,
    buffs: [],
    debuffs: [],
    ability: {
      ...card.ability,
      currentCooldown: 0,
    },
  };
}

function getActiveCard(player: PlayerState): BattleCard {
  return player.cards[player.activeCardIndex];
}

function getEffectiveStat(card: BattleCard, stat: 'attack' | 'defense' | 'speed'): number {
  let value = card.stats[stat];

  for (const buff of card.buffs) {
    if (buff.stat === stat) {
      value += buff.amount;
    }
  }

  for (const debuff of card.debuffs) {
    if (debuff.type === 'curse') {
      value -= debuff.power;
    }
  }

  return Math.max(1, value);
}

function calculateDamage(
  attacker: BattleCard,
  defender: BattleCard,
  basePower: number,
  _isAbility: boolean = false
): number {
  const attack = getEffectiveStat(attacker, 'attack');
  const defense = getEffectiveStat(defender, 'defense');
  const elementMultiplier = getElementAdvantage(attacker.element, defender.element);

  // Basic damage formula
  const baseDamage = ((attack * basePower) / defense) * elementMultiplier;

  // Add some randomness (90-110%)
  const variance = 0.9 + Math.random() * 0.2;

  return Math.floor(baseDamage * variance);
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

function applyBuff(card: BattleCard, stat: 'attack' | 'defense' | 'speed', amount: number): void {
  card.buffs.push({
    stat,
    amount,
    turnsRemaining: 3,
  });
}

function applyDebuff(card: BattleCard, type: 'curse' | 'burn', power: number): void {
  card.debuffs.push({
    type,
    power,
    turnsRemaining: 3,
  });
}

function processDoT(card: BattleCard): BattleEvent[] {
  const events: BattleEvent[] = [];

  for (const debuff of card.debuffs) {
    if (debuff.type === 'burn') {
      const damage = applyDamage(card, debuff.power);
      events.push({
        type: 'dot',
        source: 'burn',
        target: card.name,
        value: damage,
        message: `${card.name} takes ${damage} burn damage!`,
      });
    }
  }

  return events;
}

function tickBuffsAndDebuffs(card: BattleCard): void {
  card.buffs = card.buffs.filter(buff => {
    buff.turnsRemaining--;
    return buff.turnsRemaining > 0;
  });

  card.debuffs = card.debuffs.filter(debuff => {
    debuff.turnsRemaining--;
    return debuff.turnsRemaining > 0;
  });
}

function tickCooldowns(card: BattleCard): void {
  if (card.ability.currentCooldown && card.ability.currentCooldown > 0) {
    card.ability.currentCooldown--;
  }
}

function isCardFainted(card: BattleCard): boolean {
  return card.currentHp <= 0;
}

function hasAliveCards(player: PlayerState): boolean {
  return player.cards.some(card => card.currentHp > 0);
}

function findNextAliveCard(player: PlayerState): number {
  return player.cards.findIndex(card => card.currentHp > 0);
}

interface MoveExecution {
  player: 'player1' | 'player2';
  move: BattleMove;
  card: BattleCard;
  playerState: PlayerState;
}

function executeMove(
  executor: MoveExecution,
  opponent: MoveExecution,
  _battle: Battle
): BattleEvent[] {
  const events: BattleEvent[] = [];
  const { move, card, playerState } = executor;
  const opponentCard = opponent.card;

  switch (move.action) {
    case 'attack': {
      const basePower = 20; // Basic attack power
      const damage = calculateDamage(card, opponentCard, basePower);
      const actualDamage = applyDamage(opponentCard, damage);

      events.push({
        type: 'damage',
        source: card.name,
        target: opponentCard.name,
        value: actualDamage,
        message: `${card.name} attacks ${opponentCard.name} for ${actualDamage} damage!`,
      });

      if (isCardFainted(opponentCard)) {
        events.push({
          type: 'faint',
          source: card.name,
          target: opponentCard.name,
          message: `${opponentCard.name} fainted!`,
        });
      }
      break;
    }

    case 'ability': {
      if (card.ability.currentCooldown && card.ability.currentCooldown > 0) {
        events.push({
          type: 'damage',
          source: card.name,
          target: opponentCard.name,
          value: 0,
          message: `${card.name}'s ${card.ability.name} is on cooldown!`,
        });
        break;
      }

      const ability = card.ability;
      ability.currentCooldown = ability.cooldown;

      switch (ability.effect) {
        case 'damage': {
          const damage = calculateDamage(card, opponentCard, ability.power, true);
          const actualDamage = applyDamage(opponentCard, damage);

          events.push({
            type: 'damage',
            source: card.name,
            target: opponentCard.name,
            value: actualDamage,
            message: `${card.name} uses ${ability.name} on ${opponentCard.name} for ${actualDamage} damage!`,
          });

          if (isCardFainted(opponentCard)) {
            events.push({
              type: 'faint',
              source: card.name,
              target: opponentCard.name,
              message: `${opponentCard.name} fainted!`,
            });
          }
          break;
        }

        case 'heal': {
          const healAmount = applyHeal(card, ability.power);
          events.push({
            type: 'heal',
            source: card.name,
            target: card.name,
            value: healAmount,
            message: `${card.name} uses ${ability.name} and heals for ${healAmount} HP!`,
          });
          break;
        }

        case 'buff': {
          const stat = ability.name === 'Fortify' ? 'defense' : 'speed';
          applyBuff(card, stat, ability.power);
          events.push({
            type: 'buff',
            source: card.name,
            target: card.name,
            value: ability.power,
            message: `${card.name} uses ${ability.name}! ${stat} increased by ${ability.power}!`,
          });
          break;
        }

        case 'debuff': {
          applyDebuff(opponentCard, 'curse', ability.power);
          events.push({
            type: 'debuff',
            source: card.name,
            target: opponentCard.name,
            value: ability.power,
            message: `${card.name} uses ${ability.name} on ${opponentCard.name}! Stats reduced!`,
          });
          break;
        }

        case 'dot': {
          applyDebuff(opponentCard, 'burn', ability.power);
          events.push({
            type: 'debuff',
            source: card.name,
            target: opponentCard.name,
            value: ability.power,
            message: `${card.name} uses ${ability.name}! ${opponentCard.name} is burning!`,
          });
          break;
        }
      }
      break;
    }

    case 'switch': {
      const targetIndex = move.targetIndex ?? 0;
      const targetCard = playerState.cards[targetIndex];

      if (targetCard && targetCard.currentHp > 0) {
        playerState.activeCardIndex = targetIndex;
        events.push({
          type: 'switch',
          source: card.name,
          target: targetCard.name,
          message: `${card.name} switches out for ${targetCard.name}!`,
        });
      }
      break;
    }
  }

  return events;
}

export function resolveTurn(
  battle: Battle,
  move1: BattleMove,
  move2: BattleMove
): { events: BattleEvent[]; winner: string | null } {
  const events: BattleEvent[] = [];

  const card1 = getActiveCard(battle.player1);
  const card2 = getActiveCard(battle.player2!);

  const speed1 = getEffectiveStat(card1, 'speed');
  const speed2 = getEffectiveStat(card2, 'speed');

  // Determine order by speed (with tie-breaker)
  const [first, second] = speed1 >= speed2
    ? [
        { player: 'player1' as const, move: move1, card: card1, playerState: battle.player1 },
        { player: 'player2' as const, move: move2, card: card2, playerState: battle.player2! },
      ]
    : [
        { player: 'player2' as const, move: move2, card: card2, playerState: battle.player2! },
        { player: 'player1' as const, move: move1, card: card1, playerState: battle.player1 },
      ];

  // Process DoT at start of turn
  events.push(...processDoT(card1));
  events.push(...processDoT(card2));

  // Check for faints from DoT
  if (isCardFainted(card1)) {
    events.push({
      type: 'faint',
      source: 'burn',
      target: card1.name,
      message: `${card1.name} fainted from burn damage!`,
    });
  }
  if (isCardFainted(card2)) {
    events.push({
      type: 'faint',
      source: 'burn',
      target: card2.name,
      message: `${card2.name} fainted from burn damage!`,
    });
  }

  // Execute first move if card is alive
  if (!isCardFainted(first.card)) {
    const firstEvents = executeMove(first, second, battle);
    events.push(...firstEvents);
  }

  // Execute second move if card is alive
  if (!isCardFainted(second.card)) {
    // Re-check first player's active card (might have switched)
    const updatedFirst = {
      ...first,
      card: getActiveCard(first.playerState),
    };
    const secondEvents = executeMove(second, updatedFirst, battle);
    events.push(...secondEvents);
  }

  // Auto-switch fainted cards
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

  // Tick buffs, debuffs, and cooldowns
  for (const card of battle.player1.cards) {
    tickBuffsAndDebuffs(card);
    tickCooldowns(card);
  }
  for (const card of battle.player2!.cards) {
    tickBuffsAndDebuffs(card);
    tickCooldowns(card);
  }

  // Check win condition
  let winner: string | null = null;
  if (!hasAliveCards(battle.player1)) {
    winner = battle.player2!.address;
  } else if (!hasAliveCards(battle.player2!)) {
    winner = battle.player1.address;
  }

  return { events, winner };
}

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

  if (move.action === 'ability') {
    if (activeCard.ability.currentCooldown && activeCard.ability.currentCooldown > 0) {
      return { valid: false, error: `Ability on cooldown for ${activeCard.ability.currentCooldown} more turns` };
    }
  }

  return { valid: true };
}
