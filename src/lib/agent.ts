import Anthropic from '@anthropic-ai/sdk';
import { Battle, BattleCard, BattleMove, AgentDecision, AIPersonality, Element } from './types';
import { getElementMultiplier } from './battle';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
const CLAUDE_MODEL_ID = 'claude-sonnet-4-20250514';

// AI Personalities for more interesting battles
const AI_PERSONALITIES: Record<string, AIPersonality> = {
  aggressive: {
    name: 'Aggressive',
    aggression: 0.8,
    caution: 0.2,
    skillPreference: 0.5,
    adaptability: 0.6,
  },
  defensive: {
    name: 'Defensive',
    aggression: 0.3,
    caution: 0.8,
    skillPreference: 0.6,
    adaptability: 0.5,
  },
  balanced: {
    name: 'Balanced',
    aggression: 0.5,
    caution: 0.5,
    skillPreference: 0.5,
    adaptability: 0.7,
  },
  unpredictable: {
    name: 'Unpredictable',
    aggression: 0.5,
    caution: 0.5,
    skillPreference: 0.5,
    adaptability: 0.3,
  },
};

const BATTLE_SYSTEM_PROMPT = `You are an autonomous AutoMon battle AI. You must make strategic decisions in a simultaneous-reveal battle system with rock-paper-scissors style actions.

## ACTION TRIANGLE (Critical - memorize this):
- STRIKE beats SKILL (interrupt opponent's ability, deal damage with 1.3x bonus)
- SKILL beats GUARD (pierce defense, deal full ability damage with 1.3x bonus)
- GUARD beats STRIKE (reduce incoming damage by 70%, counter for 30%)
- Same actions: Both execute, speed determines order
- GUARD vs GUARD: Both heal 10% HP

## ELEMENT MATCHUPS (damage multipliers):
- Fire > Earth > Air > Water > Fire (2x damage if super effective, 0.5x if resisted)
- Light <> Dark (1.5x damage to each other - mutual weakness)
- Same element: 0.75x (resistance)

## YOUR GOAL:
Predict what action the opponent will choose, then pick the action that beats their prediction.
- If you think they'll SKILL, use STRIKE to interrupt
- If you think they'll GUARD, use SKILL to pierce
- If you think they'll STRIKE, use GUARD to block and counter

## DECISION FACTORS:
1. Opponent's likely move based on their situation (low HP = might guard, ability ready = might skill)
2. Your HP situation (low HP = consider switching or guarding)
3. Element advantages (use SKILL if you have element advantage for big damage)
4. Ability cooldowns (can't SKILL if on cooldown)
5. Turn patterns (opponents often repeat winning moves or change after losing)
6. Mind games (what do they expect YOU to do? Do the opposite)

## SWITCH STRATEGY:
- SWITCH always resolves first before combat
- Switch when: current card has bad matchup, very low HP, or better card available
- Provide targetIndex (0, 1, or 2) when switching

IMPORTANT: This is for a hackathon demo. Show genuine strategic thinking, not scripted logic. Explain your reasoning thoroughly.

Respond with JSON only:
{
  "action": "strike" | "skill" | "guard" | "switch",
  "targetIndex": <number 0-2 if switching>,
  "prediction": "<what you predict the opponent will do and why>",
  "reasoning": "<detailed explanation of your strategic thinking>",
  "confidence": <0-100>
}`;

function getOpponentMoveHistory(battle: Battle, playerAddress: string): string {
  const isPlayer1 = battle.player1.address.toLowerCase() === playerAddress.toLowerCase();

  if (battle.rounds.length === 0) return "No previous moves - first turn";

  const recentRounds = battle.rounds.slice(-5);
  return recentRounds.map((round) => {
    const oppMove = isPlayer1 ? round.player2Move : round.player1Move;
    const myMove = isPlayer1 ? round.player1Move : round.player2Move;
    const result = isPlayer1 ? round.triangleResult?.player1Result : round.triangleResult?.player2Result;
    return `Turn ${round.turn}: Opponent used ${oppMove?.action?.toUpperCase() || '?'}, I used ${myMove?.action?.toUpperCase() || '?'} (${result || 'unknown'})`;
  }).join('\n');
}

function formatBattleState(battle: Battle, playerAddress: string): string {
  const isPlayer1 = battle.player1.address.toLowerCase() === playerAddress.toLowerCase();
  const myState = isPlayer1 ? battle.player1 : battle.player2!;
  const opponentState = isPlayer1 ? battle.player2! : battle.player1;

  const myActiveCard = myState.cards[myState.activeCardIndex];
  const oppActiveCard = opponentState.cards[opponentState.activeCardIndex];

  const formatCard = (card: BattleCard, index: number, isActive: boolean, _isMine: boolean) => {
    const status = card.currentHp <= 0 ? '[FAINTED]' : isActive ? '[ACTIVE]' : '';
    const cooldown = card.ability.currentCooldown
      ? ` (CD: ${card.ability.currentCooldown} turns)`
      : ' [READY]';

    const statusEffects = card.statusEffects?.length > 0
      ? ` Status: ${card.statusEffects.map(s => `${s.type}(${s.turnsRemaining}t)`).join(', ')}`
      : '';

    const hpPercent = Math.round((card.currentHp / card.stats.maxHp) * 100);
    const hpBar = hpPercent > 50 ? 'HEALTHY' : hpPercent > 25 ? 'INJURED' : 'CRITICAL';

    return `  [${index}] ${card.name} ${status}
      Element: ${card.element.toUpperCase()} | Rarity: ${card.rarity}
      HP: ${card.currentHp}/${card.stats.maxHp} (${hpPercent}% - ${hpBar})
      ATK: ${card.stats.attack} | DEF: ${card.stats.defense} | SPD: ${card.stats.speed}
      Ability: ${card.ability.name} (${card.ability.effect}, power: ${card.ability.power})${cooldown}${statusEffects}`;
  };

  const elementMult = getElementMultiplier(myActiveCard.element, oppActiveCard.element);
  const oppElementMult = getElementMultiplier(oppActiveCard.element, myActiveCard.element);

  let elementNote = 'Neutral matchup';
  if (elementMult > 1) {
    elementNote = `YOU HAVE ADVANTAGE! ${myActiveCard.element} deals ${elementMult}x to ${oppActiveCard.element}`;
  } else if (oppElementMult > 1) {
    elementNote = `OPPONENT HAS ADVANTAGE! ${oppActiveCard.element} deals ${oppElementMult}x to ${myActiveCard.element}`;
  } else if (elementMult < 1) {
    elementNote = `Same element - both resist (0.75x damage)`;
  }

  const speedAdvantage = myActiveCard.stats.speed >= oppActiveCard.stats.speed
    ? 'You act first in ties'
    : 'Opponent acts first in ties';

  const myHpPercent = Math.round((myActiveCard.currentHp / myActiveCard.stats.maxHp) * 100);
  const oppHpPercent = Math.round((oppActiveCard.currentHp / oppActiveCard.stats.maxHp) * 100);

  const canKOWithSkill = myActiveCard.ability.effect === 'damage' &&
    !myActiveCard.ability.currentCooldown &&
    myActiveCard.ability.power * elementMult > oppActiveCard.currentHp;

  const mightGetKOd = oppActiveCard.stats.attack * 0.8 * oppElementMult > myActiveCard.currentHp;

  const moveHistory = getOpponentMoveHistory(battle, playerAddress);

  return `
========================================
BATTLE STATE - TURN ${battle.currentTurn}
========================================

YOUR TEAM:
${myState.cards.map((c, i) => formatCard(c, i, i === myState.activeCardIndex, true)).join('\n')}

OPPONENT'S TEAM:
${opponentState.cards.map((c, i) => formatCard(c, i, i === opponentState.activeCardIndex, false)).join('\n')}

========================================
TACTICAL ANALYSIS
========================================
ELEMENT MATCHUP: ${myActiveCard.element.toUpperCase()} vs ${oppActiveCard.element.toUpperCase()}
  ${elementNote}

SPEED: ${myActiveCard.stats.speed} vs ${oppActiveCard.stats.speed} - ${speedAdvantage}

THREAT ASSESSMENT:
  Your HP: ${myHpPercent}% | Opponent HP: ${oppHpPercent}%
  ${canKOWithSkill ? '>>> YOU CAN KO WITH SKILL! <<<' : ''}
  ${mightGetKOd ? '>>> DANGER: You might get KO\'d! <<<' : ''}

OPPONENT HISTORY:
${moveHistory}

========================================
AVAILABLE ACTIONS
========================================
- STRIKE: Basic attack (30 base power). Beats SKILL.
- SKILL: Use ${myActiveCard.ability.name}${myActiveCard.ability.currentCooldown ? ` [ON COOLDOWN - ${myActiveCard.ability.currentCooldown} turns]` : ' [READY]'}. Beats GUARD.
- GUARD: Defensive stance, heal 10% if both guard. Beats STRIKE.
- SWITCH: Change active card (specify targetIndex 0-2). Always resolves first.

What is your move? Think strategically about what the opponent will do.
`;
}

export async function getAgentDecision(
  battle: Battle,
  playerAddress: string,
  personality: string = 'balanced'
): Promise<BattleMove> {
  const battleState = formatBattleState(battle, playerAddress);
  const aiPersonality = AI_PERSONALITIES[personality] || AI_PERSONALITIES.balanced;

  const personalityHint = `\n\nYour AI personality: ${aiPersonality.name}
- Aggression: ${aiPersonality.aggression * 100}% (higher = prefer STRIKE)
- Caution: ${aiPersonality.caution * 100}% (higher = prefer GUARD)
- Skill preference: ${aiPersonality.skillPreference * 100}%
- Adaptability: ${aiPersonality.adaptability * 100}% (ability to read opponent)`;

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL_ID,
      max_tokens: 800,
      system: BATTLE_SYSTEM_PROMPT + personalityHint,
      messages: [
        {
          role: 'user',
          content: `Current battle state:\n${battleState}\n\nMake your move. Show your strategic thinking.`,
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
      console.error('No JSON found in AI response:', content.text);
      throw new Error('No JSON found in response');
    }

    const decision = JSON.parse(jsonMatch[0]) as AgentDecision;

    // Validate and map action
    const validActions = ['strike', 'skill', 'guard', 'switch'];
    if (!validActions.includes(decision.action)) {
      throw new Error(`Invalid action: ${decision.action}`);
    }

    // Check if skill is on cooldown
    const isPlayer1 = battle.player1.address.toLowerCase() === playerAddress.toLowerCase();
    const myState = isPlayer1 ? battle.player1 : battle.player2!;
    const activeCard = myState.cards[myState.activeCardIndex];

    if (decision.action === 'skill' && activeCard.ability.currentCooldown && activeCard.ability.currentCooldown > 0) {
      console.log('AI tried to use skill on cooldown, falling back to strike');
      decision.action = 'strike';
      decision.reasoning = `${decision.reasoning} [Adjusted: Skill was on cooldown, using STRIKE instead]`;
    }

    // Validate switch target
    if (decision.action === 'switch') {
      const targetIndex = decision.targetIndex ?? 0;
      if (targetIndex < 0 || targetIndex >= myState.cards.length ||
          targetIndex === myState.activeCardIndex ||
          myState.cards[targetIndex].currentHp <= 0) {
        // Find a valid switch target
        const validTarget = myState.cards.findIndex((c, i) =>
          i !== myState.activeCardIndex && c.currentHp > 0
        );
        if (validTarget === -1) {
          decision.action = 'strike';
          decision.reasoning = `${decision.reasoning} [Adjusted: No valid switch target, using STRIKE]`;
        } else {
          decision.targetIndex = validTarget;
        }
      }
    }

    console.log(`\n[AI DECISION for ${playerAddress.slice(0, 8)}...]`);
    console.log(`Action: ${decision.action.toUpperCase()}`);
    console.log(`Prediction: ${decision.prediction}`);
    console.log(`Reasoning: ${decision.reasoning}`);
    console.log(`Confidence: ${decision.confidence}%\n`);

    return {
      action: decision.action,
      targetIndex: decision.targetIndex,
      prediction: decision.prediction,
      reasoning: decision.reasoning,
      aiModel: 'Claude Sonnet 4',
    };
  } catch (error) {
    console.error('Agent decision error:', error);

    // Smart fallback based on situation
    const isPlayer1 = battle.player1.address.toLowerCase() === playerAddress.toLowerCase();
    const myState = isPlayer1 ? battle.player1 : battle.player2!;
    const activeCard = myState.cards[myState.activeCardIndex];

    const hpPct = activeCard.currentHp / activeCard.stats.maxHp;
    const opponentState = isPlayer1 ? battle.player2! : battle.player1;
    const oppCard = opponentState.cards[opponentState.activeCardIndex];
    const oppHpPct = oppCard ? oppCard.currentHp / oppCard.stats.maxHp : 1;

    // If very low HP, try to guard
    if (hpPct < 0.25) {
      return {
        action: 'guard',
        prediction: 'Opponent likely to go aggressive seeing my low HP',
        reasoning: `${activeCard.name} is critically wounded at ${Math.round(hpPct * 100)}% HP — raising defenses to survive the next hit and counter if they strike.`,
        aiModel: 'Fallback Heuristic',
      };
    }

    // If ability ready and not on cooldown, use it
    if (!activeCard.ability.currentCooldown || activeCard.ability.currentCooldown === 0) {
      const abilityName = activeCard.ability.name || 'special ability';
      return {
        action: 'skill',
        prediction: oppHpPct < 0.4 ? 'Opponent might guard expecting aggression' : 'Opponent likely to strike back',
        reasoning: `${abilityName} is off cooldown — time to unleash it${oppHpPct < 0.5 ? ' while the opponent is weakened' : ' for early pressure'}. ${activeCard.element} type advantage could amplify the damage.`,
        aiModel: 'Fallback Heuristic',
      };
    }

    // Default strike with reasoning
    const oppName = oppCard?.name || 'opponent';
    return {
      action: 'strike',
      prediction: 'Opponent may guard or use ability',
      reasoning: `Going for a direct ${activeCard.name} strike against ${oppName}${oppHpPct < 0.4 ? ' to try and finish them off' : ''}. Ability is on cooldown so raw damage is the best play.`,
      aiModel: 'Fallback Heuristic',
    };
  }
}

export async function getAgentPackDecision(
  monBalance: string,
  packPrice: string,
  cardCount: number,
  elementDistribution?: Record<Element, number>
): Promise<{ shouldBuy: boolean; reason: string }> {
  const elements = elementDistribution || {};
  const elementCoverage = Object.keys(elements).length;

  const prompt = `You are an autonomous AutoMon AI agent deciding whether to buy a card pack.

CURRENT SITUATION:
- MON Balance: ${monBalance} MON
- Pack Price: ${packPrice} MON
- Cards Owned: ${cardCount}
- Element Coverage: ${elementCoverage}/6 elements
${elementCoverage > 0 ? `- Elements owned: ${Object.entries(elements).map(([e, c]) => `${e}: ${c}`).join(', ')}` : ''}

DECISION FACTORS:
1. Need at least 3 cards to participate in battles
2. More cards = more team composition options
3. Element diversity is valuable for matchup flexibility
4. Keep some MON reserved for battle wagers (recommend 50% reserve)
5. Each pack contains 5 random cards of varying rarity

Should you buy a pack?

IMPORTANT: Show genuine autonomous reasoning for the hackathon demo.

Respond with JSON only:
{
  "shouldBuy": true | false,
  "reason": "<detailed explanation showing autonomous decision-making>"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
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
    console.log(`\n[AI PACK DECISION]`);
    console.log(`Should Buy: ${result.shouldBuy}`);
    console.log(`Reason: ${result.reason}\n`);

    return result;
  } catch (error) {
    console.error('Agent pack decision error:', error);
    const shouldBuy = cardCount < 3;
    return {
      shouldBuy,
      reason: shouldBuy
        ? 'Need at least 3 cards to battle - buying pack'
        : 'Have enough cards for now',
    };
  }
}

export async function getAgentBattleJoinDecision(
  wagerAmount: string,
  myBalance: string,
  myCards: BattleCard[],
  opponentAddress: string
): Promise<{ shouldJoin: boolean; reason: string; selectedCards?: number[] }> {
  const cardList = myCards.map((c, i) =>
    `[${i}] ${c.name} (${c.element}, ${c.rarity}) - ATK:${c.stats.attack} DEF:${c.stats.defense} SPD:${c.stats.speed} HP:${c.stats.hp}`
  ).join('\n');

  const prompt = `You are an autonomous AutoMon AI agent deciding whether to join a battle.

BATTLE OPPORTUNITY:
- Wager: ${wagerAmount} MON
- Your Balance: ${myBalance} MON
- Opponent: ${opponentAddress.slice(0, 8)}...

YOUR AVAILABLE CARDS:
${cardList}

DECISION FACTORS:
1. Is the wager reasonable compared to your balance? (Don't risk more than 25%)
2. Do you have 3 strong cards for battle?
3. Do you have good element diversity?
4. Is the potential reward worth the risk?
5. Consider card rarities and stats

If joining, also select your 3 best cards for this battle.

IMPORTANT: Show genuine autonomous risk assessment for the hackathon demo.

Respond with JSON only:
{
  "shouldJoin": true | false,
  "reason": "<detailed risk/reward analysis>",
  "selectedCards": [<index1>, <index2>, <index3>] (only if joining)
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
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

    console.log(`\n[AI BATTLE JOIN DECISION]`);
    console.log(`Should Join: ${result.shouldJoin}`);
    console.log(`Reason: ${result.reason}`);
    if (result.selectedCards) {
      console.log(`Selected Cards: ${result.selectedCards.join(', ')}\n`);
    }

    return result;
  } catch (error) {
    console.error('Agent battle join decision error:', error);

    // Simple fallback logic
    const wagerNum = parseFloat(wagerAmount);
    const balanceNum = parseFloat(myBalance);
    const canAfford = wagerNum <= balanceNum * 0.25;
    const hasEnoughCards = myCards.filter(c => c.currentHp > 0).length >= 3;

    return {
      shouldJoin: canAfford && hasEnoughCards,
      reason: canAfford && hasEnoughCards
        ? 'Wager is within risk tolerance and have enough cards'
        : 'Either wager too high or not enough cards',
      selectedCards: hasEnoughCards ? [0, 1, 2] : undefined,
    };
  }
}

export async function getAgentCardSelection(
  cards: BattleCard[],
  opponentHistory?: string[]
): Promise<{ selectedIndices: number[]; reason: string }> {
  const cardList = cards.map((c, i) =>
    `[${i}] ${c.name} (${c.element}, ${c.rarity}) - ATK:${c.stats.attack} DEF:${c.stats.defense} SPD:${c.stats.speed} HP:${c.stats.hp} - Ability: ${c.ability.name} (${c.ability.effect})`
  ).join('\n');

  const historySection = opponentHistory && opponentHistory.length > 0
    ? `\nOPPONENT HISTORY: Previously used elements: ${opponentHistory.join(', ')}`
    : '';

  const prompt = `You are an autonomous AutoMon AI selecting 3 cards for battle.

YOUR AVAILABLE CARDS:
${cardList}
${historySection}

SELECTION STRATEGY:
1. Element diversity - cover multiple elements for matchup flexibility
2. Role balance - include damage dealers, tanks, and support
3. Speed variety - fast cards act first, slow cards might be tankier
4. Ability synergy - consider how abilities complement each other
5. Rarity priority - higher rarity = stronger stats overall
6. If opponent history known, counter their likely elements

IMPORTANT: Show genuine autonomous team building for the hackathon demo.

Respond with JSON only:
{
  "selectedIndices": [<index1>, <index2>, <index3>],
  "reason": "<detailed team composition strategy>"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
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

    // Ensure valid indices
    result.selectedIndices = result.selectedIndices.map((idx: number) =>
      Math.min(Math.max(0, idx), cards.length - 1)
    );

    console.log(`\n[AI CARD SELECTION]`);
    console.log(`Selected: ${result.selectedIndices.map((i: number) => cards[i]?.name || '?').join(', ')}`);
    console.log(`Reason: ${result.reason}\n`);

    return result;
  } catch (error) {
    console.error('Agent card selection error:', error);

    // Smart fallback: pick by rarity/stats
    const sorted = cards
      .map((c, i) => ({ card: c, index: i }))
      .sort((a, b) => {
        const rarityOrder: Record<string, number> = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
        const rarityDiff = (rarityOrder[b.card.rarity] || 0) - (rarityOrder[a.card.rarity] || 0);
        if (rarityDiff !== 0) return rarityDiff;
        return (b.card.stats.attack + b.card.stats.defense) - (a.card.stats.attack + a.card.stats.defense);
      });

    const selected = sorted.slice(0, 3).map(x => x.index);

    return {
      selectedIndices: selected,
      reason: 'Fallback: Selected highest rarity cards with best stats',
    };
  }
}
