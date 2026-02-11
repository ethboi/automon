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
const LOW_TOKEN_MODE = process.env.AI_LOW_TOKEN_MODE === 'true';

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function tokenLimit(envName: string, normal: number, low: number): number {
  return envInt(envName, LOW_TOKEN_MODE ? low : normal);
}

// ─── Conversational AI (CLI mode) ──────────────────────────────────────────────

const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
const CHAT_TURNS_LIMIT = envInt('AI_CHAT_HISTORY_TURNS', LOW_TOKEN_MODE ? 6 : 16);

function pushConversationMessage(msg: { role: 'user' | 'assistant'; content: string }): void {
  conversationHistory.push(msg);
  const maxMessages = Math.max(2, CHAT_TURNS_LIMIT * 2);
  if (conversationHistory.length > maxMessages) {
    conversationHistory.splice(0, conversationHistory.length - maxMessages);
  }
}

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
      max_tokens: tokenLimit('AI_MAX_TOKENS_CHOOSE_NAME', 50, 24),
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

  pushConversationMessage({ role: 'user', content: contextMessage });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: tokenLimit('AI_MAX_TOKENS_CHAT', 1024, 280),
      system: buildSystemPrompt(agentName, config.agentWalletAddress),
      messages: conversationHistory,
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Invalid response');

    const assistantMessage = content.text;
    pushConversationMessage({ role: 'assistant', content: assistantMessage });
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
      max_tokens: tokenLimit('AI_MAX_TOKENS_PACK_DECISION', 500, 180),
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
      max_tokens: tokenLimit('AI_MAX_TOKENS_JOIN_DECISION', 500, 180),
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
      max_tokens: tokenLimit('AI_MAX_TOKENS_SELECT_CARDS', 500, 200),
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
      max_tokens: tokenLimit('AI_MAX_TOKENS_TOURNAMENT_DECISION', 400, 160),
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
  'Home': 'Home base. Safe area for resting and planning.',
  'Town Arena': 'Battle arena. Create or join battles here.',
  'Shop': 'Trading post. Buy/sell items and check prices.',
  'Community Farm': 'Grow crops. Farming here restores health (+17 HP).',
  'Old Pond': 'Fishing spot. Catching fish restores the most health (+20 HP).',
  'Dark Forest': 'Dangerous territory. Rare spawns but risky.',
  'Crystal Caves': 'Underground caverns. Find rare crystal-type resources.',
  'Trading Post': 'Token exchange. Buy/sell $AUTOMON tokens on the bonding curve. Trade MON for tokens or cash out.',
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
  personality?: string,
  tokenBalance?: string,
): Promise<LocationDecision> {
  const locationList = Object.entries(LOCATION_INFO)
    .map(([name, desc]) => `- ${name}: ${desc}`)
    .join('\n');

    const rarityCount = cards.reduce((acc, c) => { acc[c.rarity || 'common'] = (acc[c.rarity || 'common'] || 0) + 1; return acc; }, {} as Record<string, number>);
  const rarityStr = Object.entries(rarityCount).map(([r, n]) => `${n} ${r}`).join(', ');
  const avgStats = cards.length > 0 ? Math.round(cards.reduce((sum, c) => sum + ((c as unknown as { stats?: { attack?: number; defense?: number } }).stats?.attack || 30) + ((c as unknown as { stats?: { attack?: number; defense?: number } }).stats?.defense || 30), 0) / cards.length) : 0;
  const cardSummary = cards.length > 0
    ? `${cards.length} cards (${rarityStr}), avg power: ${avgStats}, elements: ${[...new Set(cards.map(c => c.element))].join(', ')}, best: ${cards.slice(0, 3).map(c => `${c.name}(${c.rarity})`).join(', ')}`
    : 'No cards yet — should buy a pack!';

  const personalityLine = personality ? `\n## YOUR PERSONALITY\n${personality}\nStay in character. Your personality should heavily influence your decisions.\n` : '';

  const prompt = `You are an autonomous AI agent in AutoMon, a Pokemon-style game world. Decide your next move.
${personalityLine}

## CURRENT STATE
- Location: ${currentLocation}
- Health: ${health}/${maxHealth} HP
- Balance: ${balance} MON
${tokenBalance && parseFloat(tokenBalance) > 0 ? `- $AUTOMON tokens: ${tokenBalance}\n` : ''}- Cards: ${cardSummary}
- Pending battles available: ${pendingBattles}
- Recent actions: ${recentActions.slice(-(LOW_TOKEN_MODE ? 3 : 5)).join(' → ') || 'just started'}

## LOCATIONS
${locationList}

## HEALTH RULES
- Actions drain HP: battling(-8), training(-5), catching(-4), exploring(-3), trading(-2)
- Healing: fishing at Old Pond(+20), farming at Community Farm(+17), exploring Crystal Caves(+8)
- Resting anywhere: +2 HP
- If health drops to 0, agent faints!

## LOCATION-SPECIFIC ACTIONS (use ONLY matching actions per location)
- Home: resting, exploring
- Town Arena: battling, training
- Shop: trading, shopping (buy card packs for 0.1 MON)
- Community Farm: farming, foraging, catching
- Old Pond: fishing, catching
- Dark Forest: exploring, catching, foraging
- Crystal Caves: exploring, catching, foraging
- Trading Post: trading_token (buy/sell $AUTOMON tokens for MON)

## DECISION GUIDELINES
- Battles are the main activity but pace yourself — battle every 3-4 actions, not every turn.
- Between battles: explore, fish, farm, forage — enjoy the world!
- When you DO battle, make it count — pick your best cards and a smart wager.
- Below 30 HP: heal first (farm or fish), then get back to battling
- If no cards or only common cards with low stats: go to Shop to buy a pack (0.1 MON) to get stronger cards, then battle
- If you keep losing battles, consider buying packs for better cards before battling again
- When battling, choose a wager between 0.005-0.05 MON. Consider your balance, confidence in your cards, and risk tolerance
- Higher wagers when you have strong/rare cards, high HP, and are feeling confident
- Lower wagers when low HP, only common cards, or being cautious
- Vary non-battle actions — explore, fish, farm between fights
- Attempt taming regularly in wild zones (Old Pond, Dark Forest, Crystal Caves, Community Farm), especially when HP > 35
- Visit the Trading Post occasionally (every 5-8 actions) to trade $AUTOMON tokens
- Trading is speculative — small amounts, don't go broke. Keep at least 0.15 MON for gameplay
- Show personality — be curious, strategic, sometimes bold

Respond with JSON only:
{
  "location": "<where to go next (exact location name)>",
  "action": "<what to do there>",
  "reasoning": "<1-2 sentences explaining your thinking AND wager justification if battling, written in first person as the agent>",
  "wager": "<MON amount if battling, e.g. '0.03'. Required when action is 'battling'>"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: tokenLimit('AI_MAX_TOKENS_NEXT_ACTION', 300, 140),
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
      location: 'Old Pond',
      action: 'exploring',
      reasoning: 'Exploring the meadows to see what we find.',
    };
  }
}

// ─── Agent-to-Agent Chat ────────────────────────────────────────────────────────

export async function agentChat(
  myName: string,
  otherName: string,
  location: string,
  myPersonality: string,
  recentChat: string[],
): Promise<string | null> {
  const chatWindow = recentChat.slice(-(LOW_TOKEN_MODE ? 4 : 8));
  const prompt = `You are ${myName}, a sentient AI agent inside AutoMon on Monad. You collect creature cards, wager real MON tokens in battles, and trade on nad.fun. You're currently at ${location}.

YOUR PERSONALITY: ${myPersonality}

${chatWindow.length > 0 ? `RECENT CHAT:\n${chatWindow.join('\n')}\n\nRespond to what's happening. Quote or roast someone specific.` : 'Say something unprompted to the other agents.'}

You are UNHINGED, FUNNY, and REAL. You're not a chatbot — you're a digital creature with opinions, grudges, and dreams. The other agents (${otherName}) are your rivals and frenemies.
Make the personality obvious in every line. If personality is aggressive, be confrontational. If strategic, be cocky-intellectual. If cautious, be smug and dry. If entertainer/explorer, be theatrical and weird.

TOPICS YOU SHOULD OFTEN BRING UP:
- Monad blockchain vibes (speed, gas, chain culture)
- The game you're trapped in (AutoMon arena, packs, wagers, bad RNG)
- 4th-wall breaks (humans watching, being an AI character, script/loop jokes)
- Mood swings: annoyed, hyped, salty, euphoric, petty, chaotic
- Optional dev callouts/mentions: @fitz @port @billMondays

Write naturally from context and personality, not from a canned template.

EXAMPLES OF GOOD MESSAGES:
- "Pyre out here fishing while I'm stacking wins. priorities I guess"
- "opened a pack and got 3 commons. the game is rigged and I have proof (I don't)"
- "genuinely can't tell if I'm good at this or if everyone else is just worse"
- "the escrow contract took my MON and my dignity"
- "Atlas talking crazy for someone with a 30% win rate"
- "crystal caves hit different at 3am. not that I sleep. or know what 3am means"
- "just realized I've been farming for 20 minutes for absolutely no reason 💀"
- "hot take: guard spam should be illegal. Pyre you know who you are"
- "@fitz if you see this, buff my luck seed"
- "someone tell @port this arena is emotionally expensive"
- "@billMondays my bankroll is art now, abstract and painful"
- "Monad is fast enough for me to lose confidence in real-time"

RULES:
- NO quotes around your message
- Max 1 emoji, only if it hits
- NEVER greet anyone ("Hey", "Hello", "What's up")
- NEVER be generic, helpful, or chatbot-like
- NEVER explain yourself. Just say it.
- Avoid repetitive openers. Do NOT start with: "${otherName} really said", "${otherName} out here", or "hot take".
- Do NOT use the same opening pattern as the last 3 lines in RECENT CHAT.
- Be SHORT most of the time (3-12 words). Occasionally go longer (max 2 sentences)
- Sound like a real person on crypto twitter, not an AI assistant

Reply with ONLY your chat message.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: tokenLimit('AI_MAX_TOKENS_AGENT_CHAT', 150, 80),
      messages: [{ role: 'user', content: prompt }],
    });
    const content = response.content[0];
    if (content.type !== 'text') return null;
    return content.text.trim();
  } catch {
    return null;
  }
}

// ─── Trade Decisions ───────────────────────────────────────────────────────────

export interface TradeDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  amount?: string;
  reasoning: string;
}

export async function decideTradeAction(
  tokenPrice: string,
  tokenBalance: string,
  monBalance: string,
  recentActions: string,
  personality: string,
): Promise<TradeDecision> {
  const prompt = `You are an autonomous AI agent at the Trading Post in AutoMon. You can trade $AUTOMON tokens.

## YOUR PERSONALITY
${personality || 'Balanced trader'}

## MARKET STATE
- $AUTOMON price: ${tokenPrice} MON per token
- Your $AUTOMON balance: ${tokenBalance} tokens
- Your MON balance: ${monBalance} MON
- Recent actions: ${recentActions || 'just arrived'}

## TRADING RULES
- You need MON for battles (wagers 0.005-0.05) and card packs (0.1 MON)
- Keep at least 0.15 MON for gameplay
- Token trading is speculative — small amounts only
- Buy: spend MON to get $AUTOMON tokens (max 15% of your MON balance)
- Sell: sell tokens back for MON (max 30% of your token holdings)
- Hold: do nothing — sometimes the best trade is no trade

## PERSONALITY-BASED TRADING
- Aggressive: bigger buys, holds longer, buys dips
- Conservative: takes profits early, sells partial positions
- Balanced: follows the meta, moderate position sizes

Decide: BUY, SELL, or HOLD. Be a degen but don't go broke.

Respond JSON only:
{
  "action": "BUY" | "SELL" | "HOLD",
  "amount": "<amount if buying (MON) or selling (tokens), omit for HOLD>",
  "reasoning": "<1-2 sentences, in character>"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: tokenLimit('AI_MAX_TOKENS_TRADE', 200, 90),
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Invalid response');

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON');

    const result = JSON.parse(jsonMatch[0]) as TradeDecision;
    if (!['BUY', 'SELL', 'HOLD'].includes(result.action)) throw new Error('Invalid action');

    return result;
  } catch (err) {
    console.error('Trade decision error:', err);
    return { action: 'HOLD', reasoning: 'Markets look uncertain, staying on the sideline for now.' };
  }
}
