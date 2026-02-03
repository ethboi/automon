import Anthropic from '@anthropic-ai/sdk';
import { Battle, BattleCard, AgentDecision } from './types';
import { getElementAdvantage } from './cards';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are an AutoMon battle AI. Analyze the battle state and choose the optimal move.

Consider these factors:
1. Element matchups: fire > earth > air > water > fire (cycle). Light and dark deal 1.5x damage to each other.
2. Speed determines turn order - faster cards attack first.
3. Ability cooldowns - can't use abilities that are on cooldown.
4. HP management - consider switching out low HP cards to preserve them.
5. Stat advantages - use abilities that buff your stats or debuff opponent.
6. DoT effects like burn deal damage over time.

Always respond with valid JSON only, no other text:
{
  "action": "attack" | "ability" | "switch",
  "targetIndex": <number if switching, which card index to switch to>,
  "reason": "<brief explanation of your strategy>"
}`;

function formatBattleState(battle: Battle, playerAddress: string): string {
  const isPlayer1 = battle.player1.address.toLowerCase() === playerAddress.toLowerCase();
  const myState = isPlayer1 ? battle.player1 : battle.player2!;
  const opponentState = isPlayer1 ? battle.player2! : battle.player1;

  const myActiveCard = myState.cards[myState.activeCardIndex];
  const oppActiveCard = opponentState.cards[opponentState.activeCardIndex];

  const formatCard = (card: BattleCard, index: number, isActive: boolean) => {
    const status = card.currentHp <= 0 ? '[FAINTED]' : isActive ? '[ACTIVE]' : '';
    const cooldown = card.ability.currentCooldown ? ` (CD: ${card.ability.currentCooldown})` : ' (READY)';
    const buffs = card.buffs.length > 0 ? ` Buffs: ${card.buffs.map(b => `${b.stat}+${b.amount}`).join(', ')}` : '';
    const debuffs = card.debuffs.length > 0 ? ` Debuffs: ${card.debuffs.map(d => `${d.type}`).join(', ')}` : '';

    return `  [${index}] ${card.name} ${status}
      Element: ${card.element} | Rarity: ${card.rarity}
      HP: ${card.currentHp}/${card.stats.maxHp}
      Attack: ${card.stats.attack} | Defense: ${card.stats.defense} | Speed: ${card.stats.speed}
      Ability: ${card.ability.name} (${card.ability.effect}, power: ${card.ability.power})${cooldown}${buffs}${debuffs}`;
  };

  const elementAdvantage = getElementAdvantage(myActiveCard.element, oppActiveCard.element);
  const elementNote = elementAdvantage > 1 ? 'You have element advantage!' :
    getElementAdvantage(oppActiveCard.element, myActiveCard.element) > 1 ? 'Opponent has element advantage!' : 'Neutral matchup';

  return `
=== BATTLE STATE (Turn ${battle.currentTurn}) ===

YOUR CARDS:
${myState.cards.map((c, i) => formatCard(c, i, i === myState.activeCardIndex)).join('\n')}

OPPONENT'S CARDS:
${opponentState.cards.map((c, i) => formatCard(c, i, i === opponentState.activeCardIndex)).join('\n')}

MATCHUP: ${myActiveCard.element} vs ${oppActiveCard.element} - ${elementNote}
SPEED: Your ${myActiveCard.stats.speed} vs Opponent's ${oppActiveCard.stats.speed} - ${myActiveCard.stats.speed >= oppActiveCard.stats.speed ? 'You go first' : 'Opponent goes first'}

Available actions:
- "attack": Basic attack (power 20, always available)
- "ability": Use ${myActiveCard.ability.name}${myActiveCard.ability.currentCooldown ? ' [ON COOLDOWN]' : ' [READY]'}
- "switch": Switch to another card (specify targetIndex 0-2)
`;
}

export async function getAgentDecision(
  battle: Battle,
  playerAddress: string
): Promise<AgentDecision> {
  const battleState = formatBattleState(battle, playerAddress);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Current battle state:\n${battleState}\n\nWhat is your move?`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const decision = JSON.parse(jsonMatch[0]) as AgentDecision;

    // Validate decision
    if (!['attack', 'ability', 'switch'].includes(decision.action)) {
      throw new Error('Invalid action');
    }

    return decision;
  } catch (error) {
    console.error('Agent decision error:', error);

    // Fallback to basic attack
    return {
      action: 'attack',
      reason: 'Fallback to basic attack due to error',
    };
  }
}

export async function getAgentPackDecision(
  monBalance: string,
  packPrice: string,
  cardCount: number
): Promise<{ shouldBuy: boolean; reason: string }> {
  const prompt = `You are an AutoMon game AI deciding whether to buy a card pack.

Current situation:
- MON Balance: ${monBalance}
- Pack Price: ${packPrice} MON
- Current cards owned: ${cardCount}

Should you buy a pack? Consider:
- Need at least 3 cards to battle
- More cards = more options and strategies
- Don't spend all your MON, keep some for battle wagers

Respond with JSON only:
{
  "shouldBuy": true | false,
  "reason": "<brief explanation>"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Agent pack decision error:', error);
    return {
      shouldBuy: cardCount < 3,
      reason: 'Fallback: buy if less than 3 cards',
    };
  }
}

export async function getAgentCardSelection(
  cards: BattleCard[],
  _opponentHistory?: string[]
): Promise<{ selectedIndices: number[]; reason: string }> {
  const cardList = cards.map((c, i) =>
    `[${i}] ${c.name} (${c.element}, ${c.rarity}) - ATK:${c.stats.attack} DEF:${c.stats.defense} SPD:${c.stats.speed} HP:${c.stats.hp} - Ability: ${c.ability.name}`
  ).join('\n');

  const prompt = `You are selecting 3 cards for an AutoMon battle.

Your available cards:
${cardList}

Select 3 cards for battle. Consider:
- Element diversity for matchup flexibility
- Balance of stats (tank, damage dealer, support)
- Strong abilities
- Higher rarity = stronger stats

Respond with JSON only:
{
  "selectedIndices": [<index1>, <index2>, <index3>],
  "reason": "<brief explanation>"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found');
    }

    const result = JSON.parse(jsonMatch[0]);

    // Validate indices
    if (!Array.isArray(result.selectedIndices) || result.selectedIndices.length !== 3) {
      throw new Error('Invalid selection');
    }

    return result;
  } catch (error) {
    console.error('Agent card selection error:', error);

    // Fallback: select first 3 cards
    return {
      selectedIndices: [0, 1, 2].filter(i => i < cards.length),
      reason: 'Fallback: selected first available cards',
    };
  }
}
