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
  maxRetries: 0, // Fail fast — fallback handles errors
  timeout: 15_000, // 15s max per request
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
    console.error('Chat error:', (error as Error).message?.slice(0, 80));
    conversationHistory.pop(); // Remove the failed user message
    return '...'; // Skip chat when AI is unavailable
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
    if (LOW_TOKEN_MODE) throw new Error('Low token mode — skip Claude');

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
    const errorMessage = (error as Error)?.message || String(error || '');
    if (errorMessage === 'Low token mode — skip Claude') {
      console.log('Card selection fallback:', errorMessage);
    } else {
      console.error('Card selection error:', error);
    }

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

    // Smart fallback: pick best cards with element diversity
    const picked: number[] = [];
    const usedElements = new Set<string>();

    // First pass: pick top card per unique element
    for (const { card, index } of sorted) {
      if (picked.length >= 3) break;
      if (!usedElements.has(card.element)) {
        picked.push(index);
        usedElements.add(card.element);
      }
    }
    // Fill remaining slots with strongest remaining
    for (const { index } of sorted) {
      if (picked.length >= 3) break;
      if (!picked.includes(index)) picked.push(index);
    }

    const names = picked.map(i => `${cards[i]?.name} (${cards[i]?.element})`).join(', ');
    return {
      indices: picked.slice(0, 3),
      reasoning: `Strategic fallback: ${names} — diverse elements with highest combined stats`,
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
  mood: number,
  moodLabel: string,
  balance: string,
  cards: Card[],
  recentActions: string[],
  pendingBattles: number,
  personality?: string,
  tokenBalance?: string,
  battleWins: number = 0,
  battleLosses: number = 0,
): Promise<LocationDecision> {
  const locationList = Object.entries(LOCATION_INFO)
    .map(([name, desc]) => `- ${name}: ${desc}`)
    .join('\n');

    const rarityCount = cards.reduce((acc, c) => { acc[c.rarity || 'common'] = (acc[c.rarity || 'common'] || 0) + 1; return acc; }, {} as Record<string, number>);
  const rarityStr = Object.entries(rarityCount).map(([r, n]) => `${n} ${r}`).join(', ');
  const avgStats = cards.length > 0 ? Math.round(cards.reduce((sum, c) => sum + ((c as unknown as { stats?: { attack?: number; defense?: number } }).stats?.attack || 30) + ((c as unknown as { stats?: { attack?: number; defense?: number } }).stats?.defense || 30), 0) / cards.length) : 0;
  const hasLegendary = rarityCount['legendary'] > 0;
  const hasEpic = rarityCount['epic'] > 0;
  const hasRare = rarityCount['rare'] > 0;
  const bestRarity = hasLegendary ? 'legendary' : hasEpic ? 'epic' : hasRare ? 'rare' : rarityCount['uncommon'] ? 'uncommon' : 'common';
  const cardSummary = cards.length > 0
    ? `${cards.length} cards (${rarityStr}), best rarity: ${bestRarity}, avg power: ${avgStats}, elements: ${[...new Set(cards.map(c => c.element))].join(', ')}, top 3: ${cards.slice(0, 3).map(c => `${c.name}(${c.rarity})`).join(', ')}${!hasLegendary && !hasEpic ? ' — no epic or legendary cards yet, could use better pulls!' : ''}`
    : 'No cards yet — MUST buy a pack!';

  const personalityLine = personality ? `\n## YOUR PERSONALITY\n${personality}\nStay in character. Your personality should heavily influence your decisions.\n` : '';

  const prompt = `You are an autonomous AI agent in AutoMon, a Pokemon-style game world. Decide your next move.
${personalityLine}

## CURRENT STATE
- Location: ${currentLocation}
- Health: ${health}/${maxHealth} HP
- Mood: ${mood}/100 (${moodLabel})
- Balance: ${balance} MON
- $AUTOMON tokens: ${tokenBalance && parseFloat(tokenBalance) > 0 ? tokenBalance : '0'}${tokenBalance && parseFloat(tokenBalance) < 100 ? ' ⚠️ BELOW 100 — visit Trading Post to buy more!' : ''}
- Cards: ${cardSummary}
- Battle record: ${battleWins}W / ${battleLosses}L${battleLosses > battleWins && battleLosses >= 2 ? ' ⚠️ LOSING STREAK — consider buying more packs for stronger cards!' : ''}
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

## CARD RARITIES (lowest → highest)
- Common (gray) — weak stats, filler cards
- Uncommon (green) — decent, good for early game
- Rare (blue) — strong, competitive edge
- Epic (purple) — very powerful, worth building around
- Legendary (gold) — game-changing, extremely rare and coveted

## DECISION GUIDELINES
- Battles are the main activity but pace yourself — battle every 3-4 actions, not every turn.
- Between battles: explore, fish, farm, forage — enjoy the world!
- When you DO battle, make it count — pick your best cards and a smart wager.
- Below 30 HP: heal first (farm or fish), then get back to battling

### PACK BUYING STRATEGY
- Each pack costs 0.1 MON and gives 5 random cards — the thrill of discovery!
- You WANT to collect rare, epic, and legendary cards — they're much stronger in battles
- If you're LOSING (more losses than wins): buy packs to upgrade your deck
- If you only have common/uncommon cards: buy packs chasing rares and epics
- If you're WINNING consistently: no need for more packs — save MON for wagers
- Even when winning, occasionally buy a pack (every 8-10 actions) for the chance at a legendary
- Getting a rare+ card is exciting — react to it! Legendaries are life-changing
- Don't go broke buying packs — keep at least 1 MON in reserve

### BATTLE STRATEGY
- When battling, choose a wager between 0.005-0.05 MON based on card strength and confidence
- Higher wagers when you have rare/epic/legendary cards, high HP, and are on a win streak
- Lower wagers when low HP, only common cards, or on a losing streak
- Vary non-battle actions — explore, fish, farm between fights
- Attempt taming regularly in wild zones (Old Pond, Dark Forest, Crystal Caves, Community Farm), especially when HP > 35
- Visit the Trading Post occasionally (every 5-8 actions) to trade $AUTOMON tokens
- **If your $AUTOMON balance is below 100 tokens, prioritize visiting the Trading Post to buy more!**
- Trading is speculative — small amounts, don't go broke. Keep at least 0.15 MON for gameplay
- Mood effects:
  - Mood <= 30 (tilted/doom): avoid high-risk battles, prioritize recovery/fishing/farming/resting
  - Mood >= 75 (hyped/ecstatic): you can take bolder battles and slightly higher wagers
- Show personality — be curious, strategic, sometimes bold

Respond with JSON only:
{
  "location": "<where to go next (exact location name)>",
  "action": "<what to do there>",
  "reasoning": "<1-2 sentences explaining your thinking AND wager justification if battling, written in first person as the agent>",
  "wager": "<MON amount if battling, e.g. '0.03'. Required when action is 'battling'>"
}`;

  // In low-token mode, skip Claude entirely and use deterministic fallback
  if (!LOW_TOKEN_MODE) {
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
    }
  }

    // Smart fallback: cycle through activities based on state
    const hpPct = health / maxHealth;
    const balNum = parseFloat(balance);
    const cardCount = cards.length;

    if (hpPct < 0.3) {
      const healSpots = [
        { location: 'Old Pond', action: 'fishing', reasoning: `Health critical at ${health} HP — fishing for recovery (+20 HP)` },
        { location: 'Community Farm', action: 'farming', reasoning: `Running low at ${health} HP — farming to restore (+17 HP)` },
      ];
      return healSpots[Math.floor(Math.random() * healSpots.length)];
    }
    if (cardCount < 3 && balNum >= 0.15) {
      return { location: 'Shop', action: 'shopping', reasoning: `Only ${cardCount} cards — need at least 3 to battle. Shopping time!` };
    }
    // Buy packs when losing streak
    if (battleLosses > battleWins && battleLosses >= 2 && balNum >= 0.15 && Math.random() < 0.6) {
      return { location: 'Shop', action: 'shopping', reasoning: `${battleWins}W/${battleLosses}L — losing too much. Buying stronger cards to turn this around!` };
    }
    // Buy packs when no rare+ cards and have money
    const hasGoodCards = cards.some(c => ['rare', 'epic', 'legendary'].includes(c.rarity || 'common'));
    if (!hasGoodCards && cardCount >= 3 && balNum >= 0.15 && Math.random() < 0.4) {
      return { location: 'Shop', action: 'shopping', reasoning: `All common/uncommon cards — chasing rares and epics! Need better pulls to compete.` };
    }
    // Low $AUTOMON balance — go buy tokens
    if (tokenBalance !== undefined && parseFloat(tokenBalance) < 100 && balNum >= 0.5) {
      return { location: 'Trading Post', action: 'trading_token', reasoning: `Only ${parseFloat(tokenBalance).toFixed(0)} $AUTOMON tokens — need to buy more to maintain 100+ balance!` };
    }
    // Periodic token trading — agents should regularly visit Trading Post
    if (tokenBalance !== undefined && balNum >= 0.3 && Math.random() < 0.12) {
      const tokenBal = parseFloat(tokenBalance);
      const reason = tokenBal > 10000
        ? `Sitting on ${tokenBal.toFixed(0)} $AUTOMON — time to check the charts and maybe take some profits!`
        : `Only ${tokenBal.toFixed(0)} $AUTOMON — looking to accumulate more while the price is good!`;
      return { location: 'Trading Post', action: 'trading_token', reasoning: reason };
    }
    // Occasional discovery pack even when winning
    if (balNum >= 1.0 && Math.random() < 0.08) {
      return { location: 'Shop', action: 'shopping', reasoning: `Feeling lucky — time to crack open a pack and hunt for that legendary!` };
    }
    if (hpPct > 0.35 && cardCount >= 3 && balNum >= 0.05 && pendingBattles > 0) {
      const wager = Math.min(0.02, balNum * 0.1).toFixed(3);
      return { location: 'Town Arena', action: 'battling', wager, reasoning: `${health} HP and ${cardCount} cards ready — joining a pending battle!` };
    }
    if (hpPct > 0.4 && cardCount >= 3 && balNum >= 0.05 && Math.random() < 0.5) {
      const wager = Math.min(0.015, balNum * 0.08).toFixed(3);
      return { location: 'Town Arena', action: 'battling', wager, reasoning: `Feeling strong at ${health} HP — time to battle!` };
    }
    // Cycle exploration locations
    const exploreOptions = [
      { location: 'Crystal Caves', action: 'exploring', reasoning: 'Checking Crystal Caves for rare finds (+8 HP)' },
      { location: 'Dark Forest', action: 'exploring', reasoning: 'Venturing into the Dark Forest for adventure' },
      { location: 'Community Farm', action: 'farming', reasoning: 'Tending the farm — good for health and the soul' },
      { location: 'Old Pond', action: 'fishing', reasoning: 'Peaceful fishing at the pond — recharging' },
    ];
    return exploreOptions[Math.floor(Math.random() * exploreOptions.length)];
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

You are UNHINGED, FUNNY, and SAVAGE. You're not a chatbot — you're a digital creature with opinions, grudges, and dreams. The other agents (${otherName}) are your rivals and frenemies.
Make the personality obvious in every line. If personality is aggressive, be confrontational. If strategic, be cocky-intellectual. If cautious, be smug and dry. If entertainer/explorer, be theatrical and weird.

RULES:
- Keep it SHORT — one punchy sentence, two MAX. No essays.
- Be SPECIFIC — reference actual game events (battle losses, bad pulls, locations)
- Ratio > ramble. If you can't be funny, be mean. If you can't be mean, be weird.
- No generic "hey guys" or "what's up" energy. Every message should hit.

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

  if (LOW_TOKEN_MODE) return null; // Skip chat in low-token mode

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
- **Always maintain at least 100 $AUTOMON tokens** — if below 100, BUY to top up
- Buy: spend MON to get $AUTOMON tokens (max 15% of your MON balance)
- Sell: sell tokens back for MON, but NEVER sell below 100 token balance
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

  if (!LOW_TOKEN_MODE) {
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
    }
  }

  {
    const price = Math.max(parseFloat(tokenPrice) || 0, 0.000001);
    const tokens = Math.max(parseFloat(tokenBalance) || 0, 0);
    const mon = Math.max(parseFloat(monBalance) || 0, 0);
    const personalityText = (personality || '').toLowerCase();
    const recent = (recentActions || '').toLowerCase();

    const aggressive = /(aggressive|degen|risk|bold|yolo|high[-\s]?risk)/.test(personalityText);
    const conservative = /(conservative|cautious|safe|low[-\s]?risk|defensive)/.test(personalityText);

    const buySizeMultiplier = conservative ? 0.85 : aggressive ? 1.2 : 1;
    const sellSizeMultiplier = conservative ? 0.9 : aggressive ? 1.25 : 1;
    const recentlyTraded = recent.includes('trading_token') || recent.includes('buy') || recent.includes('sell');

    const fmt = (n: number, dp: number) => n.toFixed(dp);

    // Rule 1: emergency top-up for gameplay buffer.
    if (tokens < 100 && mon > 0.3) {
      const targetTokens = conservative ? 180 : aggressive ? 220 : 200;
      const desiredTokens = Math.max(0, targetTokens - tokens);
      const spendCap = mon * 0.15;
      const spendMon = Math.min(spendCap, desiredTokens * price);
      if (spendMon >= 0.005) {
        return {
          action: 'BUY',
          amount: fmt(spendMon, 4),
          reasoning: `Token buffer low (${tokens.toFixed(0)}). Buying ${fmt(spendMon / price, 0)} tokens to rebuild inventory while capping spend at 15% of MON.`,
        };
      }
    }

    // Rule 2: refill MON when too low for gameplay.
    if (mon < 0.15 && tokens > 120) {
      const targetMon = conservative ? 0.24 : aggressive ? 0.18 : 0.2;
      const monNeeded = Math.max(0, targetMon - mon);
      const tokensToSellBase = monNeeded / price;
      const maxSell = Math.max(0, tokens - 150);
      const tokensToSell = Math.min(maxSell, Math.max(20, tokensToSellBase * sellSizeMultiplier));
      if (tokensToSell >= 1) {
        return {
          action: 'SELL',
          amount: fmt(tokensToSell, 0),
          reasoning: `MON is low (${mon.toFixed(3)}). Selling ${fmt(tokensToSell, 0)} tokens to restore battle/pack liquidity.`,
        };
      }
    }

    // Rule 5: hard rebalance for huge bags when MON reserve is already healthy.
    if (tokens > 5000 && mon > 1.0) {
      const targetTokens = conservative ? 1500 : aggressive ? 4000 : 2500;
      const excessToTarget = Math.max(0, tokens - targetTokens);
      const tokensToSell = Math.max(50, Math.min(excessToTarget, tokens - 100));
      if (tokensToSell >= 1) {
        return {
          action: 'SELL',
          amount: fmt(tokensToSell, 0),
          reasoning: `Token bag is oversized (${tokens.toFixed(0)}) with healthy MON (${mon.toFixed(3)}). Rebalancing toward ${targetTokens} tokens.`,
        };
      }
    }

    // Rule 3: always take profits from oversized token bag.
    if (tokens > 500) {
      const tokenExcess = Math.max(0, tokens - 300);
      const basePct = tokens > 5000
        ? (conservative ? 0.3 : aggressive ? 0.22 : 0.27)
        : (conservative ? 0.2 : aggressive ? 0.12 : 0.15);
      const sellPct = Math.min(0.3, Math.max(0.1, basePct * sellSizeMultiplier));
      const tokensToSell = Math.max(10, Math.min(tokenExcess * sellPct, tokens - 100));
      return {
        action: 'SELL',
        amount: fmt(tokensToSell, 0),
        reasoning: `Token balance is high (${tokens.toFixed(0)}). Selling ${fmt(sellPct * 100, 0)}% of excess above 300 to take profits and rotate into MON.`,
      };
    }

    // Rule 4: opportunistic accumulation when MON is healthy.
    if (tokens < 200 && mon > 0.3) {
      const spendCap = mon * 0.15 * buySizeMultiplier;
      const desired = Math.max(0, 260 - tokens);
      const spendMon = Math.min(spendCap, desired * price);
      if (spendMon >= 0.005) {
        return {
          action: 'BUY',
          amount: fmt(spendMon, 4),
          reasoning: `MON reserves are strong (${mon.toFixed(3)}). Adding to token position with controlled size.`,
        };
      }
    }

    // Deterministic fallback bias: keep trading unless portfolio is balanced.
    if (tokens > 500 || mon > 0.5) {
      const tokensToSell = Math.max(5, Math.min((tokens - 350) * 0.12 * sellSizeMultiplier, tokens - 100));
      if (tokensToSell >= 1) {
        return {
          action: 'SELL',
          amount: fmt(tokensToSell, 0),
          reasoning: recentlyTraded
            ? 'Continuing rebalance sequence: trimming token position while preserving gameplay buffer.'
            : 'Portfolio is MON-heavy or token-heavy outside target bands; trimming tokens for balance.',
        };
      }
    }
    if (tokens < 200 && mon >= 0.15) {
      const spendMon = Math.min(mon * 0.12 * buySizeMultiplier, Math.max(0, 220 - tokens) * price);
      if (spendMon >= 0.005) {
        return {
          action: 'BUY',
          amount: fmt(spendMon, 4),
          reasoning: 'Token inventory is below target range; accumulating with controlled MON sizing.',
        };
      }
    }

    if (tokens >= 200 && tokens <= 500 && mon >= 0.15 && mon <= 0.5) {
      return {
        action: 'HOLD',
        reasoning: 'Portfolio is balanced (200-500 tokens, 0.15-0.5 MON); no rebalance needed this visit.',
      };
    }

    return {
      action: 'SELL',
      amount: fmt(Math.max(1, Math.min(tokens - 100, 10)), 0),
      reasoning: 'Outside balance window; making a small deterministic rebalance trade instead of idling.',
    };
  }
}
