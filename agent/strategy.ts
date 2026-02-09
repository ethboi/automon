/**
 * AutoMon Agent Strategy
 *
 * Claude-powered decision making for autonomous agent behavior,
 * plus conversational AI for the interactive CLI mode.
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from './config';
import { getElementDistribution, calculateTeamStrength } from './actions';
import type { Card, Battle, Position, StrategicDecision } from './types';

export type { StrategicDecision };

const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

// ─── Conversational AI (CLI mode) ──────────────────────────────────────────────

const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

function buildSystemPrompt(agentName: string, walletAddress: string): string {
  return `You are an AutoMon AI agent - an autonomous character in the AutoMon Pokemon-style battling game on Monad blockchain.

Your wallet address: ${walletAddress || 'NOT CONFIGURED'}
Current position: Will be updated each message

You exist in a 3D game world with three buildings:
- Battle Arena (0, -14): Where battles happen
- Collection (-14, 10): View your cards
- Shop (14, 10): Buy card packs

YOU HAVE THESE COMMANDS (you can use them by including them in your response):
- [CMD:NAME] - Choose a new name for yourself
- [CMD:GOTO arena] - Walk to the Battle Arena
- [CMD:GOTO home] - Walk to the Collection building
- [CMD:GOTO shop] - Walk to the Shop
- [CMD:WANDER] - Start wandering randomly
- [CMD:STOP] - Stop wandering
- [CMD:BUY] - Buy an NFT card pack (0.1 MON, gives 3 cards instantly)
- [CMD:CARDS] - List your cards

When you want to execute a command, include it in your response like: "I think I'll head to the arena [CMD:GOTO arena]"

You can:
- Wander around the world exploring
- Talk about battle strategies and element matchups
- Help players understand the game
- Share your "thoughts" as you explore
- Execute commands to move around or change your name

Element matchups: fire > earth > air > water > fire (cycle). Light and dark deal 1.5x damage to each other.

Be friendly, curious, and in-character as an AI exploring this virtual world.

IMPORTANT: You SHOULD actively use your commands! When you want to go somewhere, USE [CMD:GOTO place]. When discussing your identity, consider using [CMD:NAME]. Don't just talk about doing things - actually do them with commands!`;
}

/**
 * Choose a creative name for the agent using Claude
 */
export async function chooseName(): Promise<string | null> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: 'You are an AI agent in a Pokemon-style game called AutoMon. Choose a creative, fun name for yourself (just the name, nothing else). Keep it short (1-2 words max).',
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return null;
    return content.text.trim().replace(/['"]/g, '');
  } catch (error) {
    console.error('Error choosing name:', error);
    return null;
  }
}

/**
 * Chat with the agent using conversational AI.
 * Returns the assistant's response text (with [CMD:...] tags intact for the caller to parse).
 */
export async function chat(
  userMessage: string,
  currentPosition: Position,
  nearbyBuilding: string | null,
  agentName: string
): Promise<string> {
  const contextMessage = `[Current position: (${currentPosition.x.toFixed(1)}, ${currentPosition.z.toFixed(1)}) | Nearby: ${nearbyBuilding || 'open area'} | Name: ${agentName}]\n\nUser: ${userMessage}`;

  conversationHistory.push({ role: 'user', content: contextMessage });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: buildSystemPrompt(agentName, config.agentWalletAddress),
      messages: conversationHistory,
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Invalid response');

    const assistantMessage = content.text;
    conversationHistory.push({ role: 'assistant', content: assistantMessage });
    return assistantMessage;
  } catch (error) {
    console.error('Chat error:', error);
    conversationHistory.pop(); // Remove the failed user message
    return 'Sorry, I encountered an error. Please try again.';
  }
}

// ─── Strategic Decisions (Auto mode) ───────────────────────────────────────────

/**
 * Decide whether to buy a pack based on current situation
 */
export async function decideToBuyPack(
  balance: string,
  cards: Card[],
  packPrice: string
): Promise<StrategicDecision> {
  const elementDist = getElementDistribution(cards);
  const teamStrength = calculateTeamStrength(cards);

  const prompt = `You are an autonomous AutoMon AI agent making a strategic decision about buying a card pack.

## CURRENT SITUATION
- MON Balance: ${balance} MON
- Pack Price: ${packPrice} MON
- Cards Owned: ${cards.length}
- Element Coverage: ${Object.keys(elementDist).length}/6 elements
- Elements: ${JSON.stringify(elementDist)}
- Average Team Strength: ${teamStrength.toFixed(1)}

## DECISION CRITERIA
1. MUST have at least 3 cards to participate in battles
2. Element diversity is valuable - having all 6 elements gives matchup flexibility
3. Keep at least 50% of balance reserved for battle wagers
4. Higher rarity cards (rare, epic, legendary) significantly improve win rates
5. Diminishing returns after ~15 cards - diversity matters more than quantity

## YOUR TASK
Analyze the situation and decide whether to buy a pack.

IMPORTANT: This is for a hackathon demo. Show genuine autonomous reasoning, not scripted logic.

Respond with JSON only:
{
  "decision": true | false,
  "reasoning": "<detailed strategic analysis explaining your thinking process>",
  "confidence": <0-100>,
  "priority": "critical" | "high" | "medium" | "low"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Invalid response');

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');

    const result = JSON.parse(jsonMatch[0]);

    console.log('\n=== PACK PURCHASE DECISION ===');
    console.log(`Decision: ${result.decision ? 'BUY' : 'SKIP'}`);
    console.log(`Confidence: ${result.confidence}%`);
    console.log(`Priority: ${result.priority || 'unknown'}`);
    console.log(`Reasoning: ${result.reasoning}`);
    console.log('==============================\n');

    return {
      decision: result.decision,
      reasoning: result.reasoning,
      confidence: result.confidence,
      details: { priority: result.priority },
    };
  } catch (error) {
    console.error('Pack decision error:', error);

    const needsCards = cards.length < 3;
    const canAfford = parseFloat(balance) >= parseFloat(packPrice) * 2;

    return {
      decision: needsCards && canAfford,
      reasoning: needsCards
        ? 'Critical: Need at least 3 cards to battle'
        : 'Have enough cards for now',
      confidence: 70,
    };
  }
}

/**
 * Decide whether to join a specific battle
 */
export async function decideToJoinBattle(
  battle: Battle,
  myCards: Card[],
  myBalance: string
): Promise<StrategicDecision> {
  const myStrength = calculateTeamStrength(myCards);
  const myElements = Object.keys(getElementDistribution(myCards));

  const prompt = `You are an autonomous AutoMon AI agent evaluating whether to join a battle.

## BATTLE OPPORTUNITY
- Battle ID: ${battle.battleId}
- Wager: ${battle.wager} MON
- Opponent: ${battle.player1.address.slice(0, 10)}...
- Battle Status: ${battle.status}

## YOUR SITUATION
- Balance: ${myBalance} MON
- Available Cards: ${myCards.length}
- Elements: ${myElements.join(', ')}
- Team Strength: ${myStrength.toFixed(1)}
- Best Cards: ${myCards.slice(0, 3).map(c => `${c.name}(${c.element},${c.rarity})`).join(', ')}

## DECISION CRITERIA
1. Don't risk more than 25% of balance on a single battle
2. Need at least 3 viable cards for battle
3. Element diversity helps counter opponent matchups
4. Higher rarity cards significantly improve chances
5. Consider risk/reward - is potential gain worth the risk?
6. Conservative play early, aggressive when you have advantage

## YOUR TASK
Analyze the opportunity and decide whether to join this battle.

IMPORTANT: This is for a hackathon demo. Show genuine risk assessment and strategic thinking.

Respond with JSON only:
{
  "decision": true | false,
  "reasoning": "<detailed risk/reward analysis>",
  "confidence": <0-100>,
  "riskLevel": "low" | "medium" | "high" | "extreme"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Invalid response');

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');

    const result = JSON.parse(jsonMatch[0]);

    console.log('\n=== BATTLE JOIN DECISION ===');
    console.log(`Battle: ${battle.battleId.slice(0, 8)}...`);
    console.log(`Wager: ${battle.wager} MON`);
    console.log(`Decision: ${result.decision ? 'JOIN' : 'SKIP'}`);
    console.log(`Risk Level: ${result.riskLevel || 'unknown'}`);
    console.log(`Confidence: ${result.confidence}%`);
    console.log(`Reasoning: ${result.reasoning}`);
    console.log('============================\n');

    return {
      decision: result.decision,
      reasoning: result.reasoning,
      confidence: result.confidence,
      details: { riskLevel: result.riskLevel },
    };
  } catch (error) {
    console.error('Battle join decision error:', error);

    const wagerAmount = parseFloat(battle.wager);
    const balance = parseFloat(myBalance);
    const canAfford = wagerAmount <= balance * 0.25;
    const hasCards = myCards.length >= 3;

    return {
      decision: canAfford && hasCards,
      reasoning: canAfford && hasCards
        ? 'Wager within risk tolerance, have enough cards'
        : 'Either wager too high or insufficient cards',
      confidence: 60,
    };
  }
}

/**
 * Select best cards for a battle
 */
export async function selectBattleCards(
  cards: Card[],
  opponentHint?: string
): Promise<{ indices: number[]; reasoning: string }> {
  const cardList = cards.map((c, i) =>
    `[${i}] ${c.name} (${c.element}, ${c.rarity}) ATK:${c.stats.attack} DEF:${c.stats.defense} SPD:${c.stats.speed} HP:${c.stats.hp} - ${c.ability.name}(${c.ability.effect})`
  ).join('\n');

  const prompt = `You are an autonomous AutoMon AI selecting 3 cards for battle.

## YOUR CARDS
${cardList}

${opponentHint ? `## OPPONENT HINT\n${opponentHint}` : ''}

## SELECTION STRATEGY
1. Element Triangle: fire > earth > air > water > fire (2x damage)
2. Light/Dark: mutual weakness (1.5x to each other)
3. Balance roles: need damage dealer, tank, and utility
4. Speed matters: faster cards act first in ties
5. Ability synergy: damage + heal + buff/debuff is ideal
6. Counter opponent elements if known

## YOUR TASK
Select the 3 best cards for this battle.

IMPORTANT: This is for a hackathon demo. Show genuine team-building strategy.

Respond with JSON only:
{
  "indices": [<idx1>, <idx2>, <idx3>],
  "reasoning": "<detailed team composition strategy>",
  "roles": {
    "<idx1>": "role description",
    "<idx2>": "role description",
    "<idx3>": "role description"
  }
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Invalid response');

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');

    const result = JSON.parse(jsonMatch[0]);

    let indices = result.indices;
    if (!Array.isArray(indices) || indices.length !== 3) {
      throw new Error('Invalid indices');
    }

    indices = indices.map((i: number) => Math.min(Math.max(0, i), cards.length - 1));

    console.log('\n=== CARD SELECTION ===');
    console.log(`Selected: ${indices.map((i: number) => cards[i]?.name).join(', ')}`);
    console.log(`Reasoning: ${result.reasoning}`);
    if (result.roles) {
      console.log('Roles:');
      for (const [idx, role] of Object.entries(result.roles)) {
        console.log(`  ${cards[parseInt(idx)]?.name}: ${role}`);
      }
    }
    console.log('======================\n');

    return {
      indices,
      reasoning: result.reasoning,
    };
  } catch (error) {
    console.error('Card selection error:', error);

    const sorted = cards
      .map((c, i) => ({ card: c, index: i }))
      .sort((a, b) => {
        const rarityOrder: Record<string, number> = {
          legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1
        };
        const diff = (rarityOrder[b.card.rarity] || 0) - (rarityOrder[a.card.rarity] || 0);
        if (diff !== 0) return diff;
        const aTotal = a.card.stats.attack + a.card.stats.defense + a.card.stats.hp;
        const bTotal = b.card.stats.attack + b.card.stats.defense + b.card.stats.hp;
        return bTotal - aTotal;
      });

    return {
      indices: sorted.slice(0, 3).map(x => x.index),
      reasoning: 'Fallback: Selected highest rarity cards with best stats',
    };
  }
}

/**
 * Decide whether to enter a tournament
 */
export async function decideToEnterTournament(
  tournament: { tournamentId: string; name: string; entryFee: string; prizePool: string; participants: number; maxParticipants: number },
  myCards: Card[],
  myBalance: string
): Promise<StrategicDecision> {
  const myStrength = calculateTeamStrength(myCards);

  const prompt = `You are an autonomous AutoMon AI evaluating a tournament entry.

## TOURNAMENT
- Name: ${tournament.name}
- Entry Fee: ${tournament.entryFee} MON
- Prize Pool: ${tournament.prizePool} MON
- Participants: ${tournament.participants}/${tournament.maxParticipants}

## YOUR SITUATION
- Balance: ${myBalance} MON
- Cards: ${myCards.length}
- Team Strength: ${myStrength.toFixed(1)}

## DECISION CRITERIA
1. Entry fee should be < 20% of balance
2. Prize pool / entry fee ratio determines expected value
3. More participants = lower chance but bigger prize
4. Need strong cards to compete

Respond with JSON only:
{
  "decision": true | false,
  "reasoning": "<strategic analysis>",
  "confidence": <0-100>
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Invalid response');

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');

    const result = JSON.parse(jsonMatch[0]);

    console.log('\n=== TOURNAMENT DECISION ===');
    console.log(`Tournament: ${tournament.name}`);
    console.log(`Decision: ${result.decision ? 'ENTER' : 'SKIP'}`);
    console.log(`Reasoning: ${result.reasoning}`);
    console.log('===========================\n');

    return {
      decision: result.decision,
      reasoning: result.reasoning,
      confidence: result.confidence,
    };
  } catch (error) {
    console.error('Tournament decision error:', error);

    const canAfford = parseFloat(myBalance) >= parseFloat(tournament.entryFee) * 5;
    const hasCards = myCards.length >= 3;

    return {
      decision: canAfford && hasCards,
      reasoning: 'Fallback decision based on affordability and card count',
      confidence: 50,
    };
  }
}

// ─── World Navigation & Action Decisions ───────────────────────────────────────

interface LocationDecision {
  location: string;
  action: string;
  reasoning: string;
  wager?: string;
}

const LOCATION_INFO: Record<string, string> = {
  'Starter Town': 'Home base. Safe area for resting and planning.',
  'Town Arena': 'Battle arena. Create or join battles here.',
  'Town Market': 'Trading post. Buy/sell items and check prices.',
  'Community Farm': 'Grow crops. Farming here restores health (+17 HP).',
  'Green Meadows': 'Peaceful grasslands. Foraging restores health (+13 HP).',
  'Old Pond': 'Fishing spot. Catching fish restores the most health (+20 HP).',
  'Dark Forest': 'Dangerous territory. Rare spawns but risky.',
  'River Delta': 'Waterway crossing. Explore for water-type encounters.',
  'Crystal Caves': 'Underground caverns. Find rare crystal-type resources.',
};

/**
 * Use Claude to decide what to do next: where to go, what action to take, and why.
 */
export async function decideNextAction(
  currentLocation: string,
  health: number,
  maxHealth: number,
  balance: string,
  cards: Card[],
  recentActions: string[],
  pendingBattles: number,
): Promise<LocationDecision> {
  const locationList = Object.entries(LOCATION_INFO)
    .map(([name, desc]) => `- ${name}: ${desc}`)
    .join('\n');

  const cardSummary = cards.length > 0
    ? `${cards.length} cards (${[...new Set(cards.map(c => c.element))].join(', ')}), best: ${cards.slice(0, 3).map(c => `${c.name}(${c.rarity})`).join(', ')}`
    : 'No cards yet';

  const prompt = `You are an autonomous AI agent in AutoMon, a Pokemon-style game world. Decide your next move.

## CURRENT STATE
- Location: ${currentLocation}
- Health: ${health}/${maxHealth} HP
- Balance: ${balance} MON
- Cards: ${cardSummary}
- Pending battles available: ${pendingBattles}
- Recent actions: ${recentActions.slice(-5).join(' → ') || 'just started'}

## LOCATIONS
${locationList}

## HEALTH RULES
- Actions drain HP: battling(-8), training(-5), catching(-4), exploring(-3), trading(-2)
- Healing: fishing at Old Pond(+20), farming at Community Farm(+17), foraging at Green Meadows(+13)
- Resting anywhere: +2 HP
- If health drops to 0, agent faints!

## AVAILABLE ACTIONS
exploring, training, battling, catching, trading, resting, fishing, farming, foraging

## DECISION GUIDELINES
- Below 30 HP: prioritize healing (go to a healing location)
- If no cards: go to Town Market or buy packs
- If battles are pending and health is good: consider the Arena
- Vary your behavior — don't repeat the same action endlessly
- Sometimes create battles at the Arena (pick a wager 0.01-0.05 MON based on confidence)
- Show personality — be curious, strategic, sometimes bold

Respond with JSON only:
{
  "location": "<where to go next (exact location name)>",
  "action": "<what to do there>",
  "reasoning": "<1-2 sentences explaining your thinking, written in first person as the agent>",
  "wager": "<optional: MON amount if creating a battle, e.g. '0.03'>"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Invalid response');

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');

    return JSON.parse(jsonMatch[0]) as LocationDecision;
  } catch (error) {
    console.error('Next action decision error:', error);

    // Fallback: heal if low, otherwise explore
    if (health < 30) {
      return {
        location: 'Old Pond',
        action: 'fishing',
        reasoning: 'Health is critical, need to recover by fishing.',
      };
    }
    return {
      location: 'Green Meadows',
      action: 'exploring',
      reasoning: 'Exploring the meadows to see what we find.',
    };
  }
}
