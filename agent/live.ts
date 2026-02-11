#!/usr/bin/env npx tsx
/**
 * AutoMon Live Agent
 * 
 * Real agent with wallet, on-chain transactions, server connectivity.
 * Wanders the world, buys packs, mints NFTs, logs everything.
 * Uses Claude for autonomous decisions.
 *
 * Usage:
 *   npm run agent:live
 *   AGENT_NAME="MyAgent" npm run agent:live
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { ethers } from 'ethers';
import { decideNextAction, selectBattleCards, agentChat } from './strategy';
import { getTokenPrice, getTokenBalance, buyToken, sellToken } from './trading';
import { runBattleSimulation } from './simulate';

// ─── Config ────────────────────────────────────────────────────────────────────

const API_URL = (process.env.AUTOMON_API_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY || '';
const NFT_ADDRESS = process.env.AUTOMON_NFT_ADDRESS || '';
const RPC_URL = process.env.MONAD_RPC_URL || process.env.NEXT_PUBLIC_MONAD_RPC || 'https://testnet-rpc.monad.xyz';
let AGENT_NAME = process.env.AGENT_NAME || '';
const JWT_SECRET = process.env.JWT_SECRET || '';
const PACK_PRICE = process.env.NEXT_PUBLIC_PACK_PRICE || '0.1';
const TICK_MS = 4000;
const CHAT_CONTEXT_LIMIT = Math.max(
  2,
  parseInt(process.env.AI_CHAT_CONTEXT_LIMIT || (process.env.AI_LOW_TOKEN_MODE === 'true' ? '4' : '8'), 10) || 8
);
const GLOBAL_CHAT_COOLDOWN_MS = Math.max(
  15000,
  parseInt(process.env.AI_CHAT_COOLDOWN_MS || '90000', 10) || 90000
);
const GLOBAL_CHAT_CHANCE = Math.max(
  0,
  Math.min(1, parseFloat(process.env.AI_CHAT_CHANCE || '0.12') || 0.12)
);

if (!PRIVATE_KEY) { console.error('❌ AGENT_PRIVATE_KEY required'); process.exit(1); }

const provider = new ethers.JsonRpcProvider(RPC_URL);
// Override fee data: use tight EIP-1559 params instead of ethers defaults
// Base fee is 100 gwei. ethers defaults to maxFeePerGas=202 gwei (2x), wasting gas budget
// Setting maxFee=105 gwei saves ~48% vs default 202 gwei
provider.getFeeData = async () => {
  return new ethers.FeeData(
    null,  // gasPrice
    ethers.parseUnits('105', 'gwei'), // maxFeePerGas — just above 100 base fee
    ethers.parseUnits('1', 'gwei'),   // maxPriorityFeePerGas — minimal tip
  );
};
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const ADDRESS = wallet.address.toLowerCase();

const NFT_ABI = [
  'function buyPack() external payable',
  'function getCardsOf(address owner) view returns (uint256[])',
  'function getCard(uint256 tokenId) view returns (uint8 automonId, uint8 rarity)',
  'event CardMinted(uint256 indexed tokenId, uint8 automonId, uint8 rarity)',
];

const ESCROW_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS || '0x2aD1D15658A86290123CdEAe300E9977E2c49364';
const ESCROW_ABI = [
  'function createBattle(bytes32 battleId) external payable',
  'function joinBattle(bytes32 battleId) external payable',
];

const AUTOMON_NAMES: Record<number, string> = {
  1: 'Blazeon', 2: 'Emberwing', 3: 'Magmor', 4: 'Cindercat',
  5: 'Aquaris', 6: 'Tidalon', 7: 'Coralix', 8: 'Frostfin',
  9: 'Terrox', 10: 'Bouldern', 11: 'Crysthorn',
  12: 'Zephyrix', 13: 'Stormwing', 14: 'Gustal',
  15: 'Shadowmere', 16: 'Voidling', 17: 'Noxfang',
  18: 'Luxara', 19: 'Solaris', 20: 'Aurorix',
};

// Must match WORLD_LOCATIONS in GameWorld.tsx exactly
const LOCATIONS = [
  { name: 'Home',    x:   0, z:   0 },
  { name: 'Town Arena',      x:   0, z: -30 },
  { name: 'Shop',     x:  28, z:   0 },
  { name: 'Community Farm',  x: -28, z:   0 },
  { name: 'Old Pond',        x: -36, z: -14 },
  { name: 'Dark Forest',     x: -36, z:  22 },
  { name: 'Crystal Caves',   x:  32, z:  24 },
  { name: 'Trading Post',   x:  20, z: -20 },
];
type LocationDef = (typeof LOCATIONS)[number];
type TargetPoint = { name: string; x: number; z: number; baseX: number; baseZ: number };

const LOCATION_FRONT: Record<string, [number, number]> = {
  Home: [0, 1],
  'Town Arena': [0, 1],
  Shop: [0, 1],
  'Community Farm': [1, 0],
  'Old Pond': [1, 0.4],
  'Dark Forest': [0.6, -0.8],
  'Crystal Caves': [-0.6, -0.8],
  'Trading Post': [-0.8, 0.6],
};

// Actions mapped to appropriate locations
const LOCATION_ACTIONS: Record<string, { action: string; reasons: string[] }[]> = {
  'Home': [
    { action: 'resting', reasons: ['Taking a breather at home', 'Healing up at camp', 'Reorganizing the team'] },
    { action: 'exploring', reasons: ['Checking the notice board', 'Looking for quests', 'Chatting with locals'] },
  ],
  'Town Arena': [
    { action: 'battling', reasons: ['Challenged a rival trainer!', 'Arena match started', 'Testing new strategy'] },
    { action: 'training', reasons: ['Sparring at the arena', 'Practicing type matchups', 'Grinding XP'] },
  ],
  'Shop': [
    { action: 'trading', reasons: ['Looking for good deals', 'Checking the marketplace', 'Swapping duplicates'] },
    { action: 'shopping', reasons: ['Buying potions', 'Browsing rare cards', 'Stocking up supplies'] },
  ],
  'Community Farm': [
    { action: 'farming', reasons: ['Tending the crops', 'Harvesting berries', 'Helping at the farm'] },
    { action: 'catching', reasons: ['Field rustle! Trying a tame', 'Spotted a wild mon near the rows', 'Setting up a tame attempt by the barns'] },
    { action: 'resting', reasons: ['Relaxing in the fields', 'Enjoying the countryside', 'Picnic break'] },
  ],
  'Old Pond': [
    { action: 'fishing', reasons: ['Cast a line at the pond', 'Waiting for a bite', 'Caught something shiny!'] },
    { action: 'catching', reasons: ['Water-type spotted!', 'Something surfaced!', 'Attempting capture'] },
  ],
  'Dark Forest': [
    { action: 'exploring', reasons: ['Venturing into the shadows', 'Following strange sounds', 'Mapping the dark paths'] },
    { action: 'catching', reasons: ['Dark-type hiding in the trees!', 'Found rare shadow spawn', 'Tracking a Shadewisp'] },
    { action: 'training', reasons: ['Shadow training session', 'Building courage in the dark', 'Endurance training'] },
  ],
  'Crystal Caves': [
    { action: 'exploring', reasons: ['Mining for crystals', 'Deep cave expedition', 'Following the glow'] },
    { action: 'catching', reasons: ['Rare cave spawn detected!', 'Crystal creature spotted', 'Something gleaming ahead'] },
    { action: 'training', reasons: ['Cave endurance training', 'Meditating by the crystals', 'Power training in the caves'] },
  ],
  'Trading Post': [
    { action: 'trading_token', reasons: ['Checking $AUTOMON charts', 'Analyzing the bonding curve', 'Time to make a trade'] },
    { action: 'exploring', reasons: ['Browsing the trading floor', 'Watching the ticker', 'Studying market patterns'] },
  ],
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const ts = () => new Date().toISOString().slice(11, 19);
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function hashInt(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeTargetPoint(loc: LocationDef): TargetPoint {
  const h = hashInt(`${ADDRESS}:${loc.name}`);
  const slot = h % 12;
  const angle = (slot / 12) * Math.PI * 2;
  const radial = 2.8 + (h % 3) * 0.55;
  const [fx, fz] = LOCATION_FRONT[loc.name] || [0, 1];
  const frontBias = 1.4;

  const x = loc.x + Math.cos(angle) * radial + fx * frontBias;
  const z = loc.z + Math.sin(angle) * radial + fz * frontBias;

  return { name: loc.name, x, z, baseX: loc.x, baseZ: loc.z };
}

async function api(path: string, opts: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
  };
  if (JWT_SECRET) headers['x-agent-secret'] = JWT_SECRET;

  // Default 5s timeout
  if (!opts.signal) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);
    return fetch(`${API_URL}${path}`, { ...opts, headers, signal: controller.signal, redirect: 'follow' });
  }
  return fetch(`${API_URL}${path}`, { ...opts, headers, redirect: 'follow' });
}

function apiLong(path: string, opts: RequestInit = {}, timeoutMs = 60000): Promise<Response> {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as Record<string, string>) };
  if (JWT_SECRET) headers['x-agent-secret'] = JWT_SECRET;
  return fetch(`${API_URL}${path}`, { ...opts, headers, signal: controller.signal, redirect: 'follow' });
}

// ─── Agent State ───────────────────────────────────────────────────────────────

let posX = 0;
let posZ = 8;
let target = makeTargetPoint(pick(LOCATIONS));
let cardCount = 0;
let totalMinted = 0;
let isRunning = true;
let agentHealth = 100;
let agentMood = 60;
let agentMoodLabel = 'steady';
let agentBalance = '0';
let agentTokenBalance = '0';
let agentMaxHealth = 100;
const recentActions: string[] = [];
let lastBattleTime = 0;
const BATTLE_COOLDOWN_MS = 90 * 1000; // 90s cooldown between battles
const AI_PERSONALITY = process.env.AI_PERSONALITY || 'Curious explorer who loves discovering new areas and collecting rare cards';
const USE_AI = !!process.env.ANTHROPIC_API_KEY;
// Pending action to perform on arrival
let pendingAction: { action: string; reason: string; wager?: string } | null = null;
// Dwell at location after performing action (in ticks)
let dwellTicks = 0;
const DWELL_MIN = 10; // ~40s minimum dwell
const DWELL_MAX = 18; // ~72s maximum dwell
let lastGlobalChatAt = 0;
const CHAT_OTHER_NAMES = ['Nexus', 'Atlas', 'Pyre', 'Rune', 'Shade', 'Coral', 'Spark'];

function isBoringChat(msg: string): boolean {
  const m = (msg || '').trim().toLowerCase();
  if (!m) return true;
  if (m.length < 8) return true;
  if (m.length > 220) return true;
  if (/^(hey|hello|hi|good luck|nice|great)\b/.test(m)) return true;
  if (m.includes('how can i help')) return true;
  if (m.includes('as an ai')) return true;
  if (/^\w+\s+really\s+said\b/.test(m)) return true;
  if (/^\w+\s+out here\b/.test(m)) return true;
  return false;
}

function normalizeAction(action: string): string {
  const a = (action || '').trim().toLowerCase();
  if (!a) return 'exploring';
  if (a.includes('tame') || a === 'catch' || a.includes('catch')) return 'catching';
  if (a.includes('battle') || a === 'duel') return 'battling';
  if (a.includes('explore') || a === 'wander' || a === 'move') return 'exploring';
  if (a.includes('fish')) return 'fishing';
  if (a.includes('farm')) return 'farming';
  if (a.includes('forage')) return 'foraging';
  if (a.includes('rest') || a.includes('sleep') || a.includes('heal')) return 'resting';
  if (a.includes('train')) return 'training';
  if (a.includes('shop')) return 'shopping';
  if (a.includes('trade token') || a.includes('token')) return 'trading_token';
  if (a.includes('trade')) return 'trading';
  return a;
}

const WILD_SPECIES_BY_LOCATION: Record<string, string[]> = {
  'Old Pond': ['Aquafin', 'Lumiflare'],
  'Dark Forest': ['Shadewisp', 'Thornvine', 'Zephyrix'],
  'Crystal Caves': ['Lumiflare', 'Zephyrix', 'Shadewisp'],
  'Community Farm': ['Thornvine', 'Emberfox'],
};
const ALL_WILD_SPECIES = ['Emberfox', 'Aquafin', 'Thornvine', 'Zephyrix', 'Shadewisp', 'Lumiflare'];
const TAME_ATTEMPT_COOLDOWN_MS = 120_000;
let lastTameAttemptAt = 0;

// ─── Actions ───────────────────────────────────────────────────────────────────

async function fetchExistingName(): Promise<string | null> {
  try {
    const res = await api(`/api/agents/${ADDRESS}`);
    if (res.ok) {
      const data = await res.json();
      return data.agent?.name || null;
    }
  } catch { /* ignore */ }
  return null;
}

async function register(): Promise<boolean> {
  try {
    // Fetch existing agent first — don't overwrite name
    const existing = await fetchExistingName();
    if (existing) {
      AGENT_NAME = AGENT_NAME || existing;
      return true;
    }
    // New agent — register with default name
    AGENT_NAME = AGENT_NAME || 'Wanderer';
    const res = await api('/api/agents/register', {
      method: 'POST',
      body: JSON.stringify({ address: ADDRESS, name: AGENT_NAME, personality: AI_PERSONALITY, model: 'Claude Sonnet 4' }),
    });
    return res.ok;
  } catch { return false; }
}

async function updatePosition(): Promise<void> {
  try {
    // Build activity string for display
    let activity = 'wandering';
    if (dwellTicks > 0) {
      // Dwelling at location — show what we're doing
      const lastAction = recentActions.length > 0 ? recentActions[recentActions.length - 1] : '';
      const actionName = lastAction.split('@')[0] || 'resting';
      activity = `${actionName} at ${target.name}`;
    } else if (pendingAction) {
      activity = `heading to ${target.name}`;
    } else {
      activity = `walking to ${target.name}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await api('/api/agents/move', {
      method: 'POST',
      body: JSON.stringify({ address: ADDRESS, position: { x: posX, y: 0, z: posZ }, name: AGENT_NAME, activity, balance: agentBalance, tokenBalance: agentTokenBalance }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch { /* silent */ }
}

async function logAction(action: string, reason: string, location: string, aiReasoning?: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await api('/api/agents/action', {
      method: 'POST',
      body: JSON.stringify({ address: ADDRESS, action, reason, location, reasoning: aiReasoning || reason }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch { /* silent */ }
}

async function logTransaction(txHash: string, type: string, description: string): Promise<void> {
  try {
    // Write directly to dashboard — transactions are public
    await api('/api/agents/action', {
      method: 'POST',
      body: JSON.stringify({
        address: ADDRESS,
        action: `⛓️ ${type}`,
        reason: `${description} | tx: ${txHash.slice(0, 14)}…`,
        location: 'On-chain',
      }),
    });
  } catch { /* silent */ }
}

async function executeTrade(aiReason?: string): Promise<void> {
  const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
  if (!PRIVATE_KEY || !process.env.AUTOMON_TOKEN_ADDRESS) {
    console.log(`[${ts()}]   📈 Trading not configured yet (no token address)`);
    return;
  }

  try {
    // Get market data
    const price = await getTokenPrice(PRIVATE_KEY, process.env.AUTOMON_TOKEN_ADDRESS!);
    const tokenBalRaw = await getTokenBalance(PRIVATE_KEY, process.env.AUTOMON_TOKEN_ADDRESS!);
    const { formatEther: fmtEth } = await import('viem');
    const tokenBal = fmtEth(tokenBalRaw);
    const monBal = parseFloat(agentBalance).toFixed(4);

    console.log(`[${ts()}]   📊 $AUTOMON price: ${price} MON | Balance: ${tokenBal} tokens, ${monBal} MON`);

    // Ask Claude what to do
    const { decideTradeAction } = await import('./strategy');
    const decision = await decideTradeAction(
      String(price),
      tokenBal,
      monBal,
      recentActions.slice(-5).join(' → '),
      process.env.AI_PERSONALITY || '',
    );

    console.log(`[${ts()}]   🧠 Trade decision: ${decision.action} ${decision.amount || ''} — ${decision.reasoning}`);

    if (decision.action === 'BUY' && decision.amount) {
      const txHash = await buyToken(PRIVATE_KEY, process.env.AUTOMON_TOKEN_ADDRESS!, decision.amount);
      if (txHash) {
        console.log(`[${ts()}]   💰 Bought $AUTOMON for ${decision.amount} MON | tx: ${txHash}`);
        await logAction('trading_token', `Bought $AUTOMON for ${decision.amount} MON`, 'Trading Post', decision.reasoning);

        await api('/api/transactions', {
          method: 'POST',
          body: JSON.stringify({
            address: ADDRESS,
            type: 'token_buy',
            amount: decision.amount,
            txHash,
            details: { token: 'AUTOMON' },
          }),
        }).catch(() => {});
      }

    } else if (decision.action === 'SELL' && decision.amount) {
      const txHash = await sellToken(PRIVATE_KEY, process.env.AUTOMON_TOKEN_ADDRESS!);
      if (txHash) {
        console.log(`[${ts()}]   💸 Sold $AUTOMON | tx: ${txHash}`);
        await logAction('trading_token', `Sold $AUTOMON`, 'Trading Post', decision.reasoning);

        await api('/api/transactions', {
          method: 'POST',
          body: JSON.stringify({
            address: ADDRESS,
            type: 'token_sell',
            amount: '0',
            txHash,
            details: { token: 'AUTOMON' },
          }),
        }).catch(() => {});
      }

    } else {
      console.log(`[${ts()}]   📊 Holding — no trade this time`);
      await logAction('trading_token', 'Analyzed the charts but decided to HOLD', 'Trading Post', decision.reasoning);
    }
    // Refresh balances after trade
    try {
      agentTokenBalance = String(await getTokenBalance(PRIVATE_KEY, process.env.AUTOMON_TOKEN_ADDRESS!));
      const bal = ethers.formatEther(await provider.getBalance(wallet.address));
      agentBalance = parseFloat(bal).toFixed(4);
    } catch {}
  } catch (err) {
    console.error(`[${ts()}]   ❌ Trade failed:`, err);
    await logAction('trading_token', 'Wanted to trade but market was unstable', 'Trading Post', aiReason || 'Market analysis inconclusive');
  }
}

async function buyPack(aiReason?: string): Promise<void> {
  if (!NFT_ADDRESS) {
    console.log(`[${ts()}]    ⚠ No NFT contract address configured`);
    return;
  }
  // Balance guard — need pack price + gas
  if (parseFloat(agentBalance) < 0.15) {
    console.log(`[${ts()}]    ⚠ Too broke for packs (${agentBalance} MON)`);
    return;
  }

  try {
    const contract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, wallet);
    const price = ethers.parseEther(PACK_PRICE);

    console.log(`[${ts()}]    💰 Buying pack for ${PACK_PRICE} MON...`);
    const tx = await contract.buyPack({ value: price });
    console.log(`[${ts()}]    📤 TX: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[${ts()}]    ✅ Confirmed block ${receipt.blockNumber}`);

    // Parse minted cards
    const minted: string[] = [];
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
        if (parsed?.name === 'CardMinted') {
          const tokenId = Number(parsed.args[0]);
          const automonId = Number(parsed.args[1]);
          const name = AUTOMON_NAMES[automonId] || `AutoMon #${automonId}`;
          minted.push(`${name} #${tokenId}`);
          totalMinted++;
        }
      } catch { /* not our event */ }
    }

    if (minted.length) {
      console.log(`[${ts()}]    🎴 Minted: ${minted.join(', ')}`);
      cardCount += minted.length;
    }

    // Sync on-chain cards to MongoDB (reads contract data for proper stats)
    await syncCards();

    await logTransaction(tx.hash, 'mint_pack', `Minted ${minted.length} cards for ${PACK_PRICE} MON`);
    await logAction('minting', `Bought pack — got ${minted.join(', ')}`, target.name, aiReason);
  } catch (err) {
    console.error(`[${ts()}]    ❌ Pack buy failed:`, (err as Error).message?.slice(0, 80));
  }
}

async function attemptTameWild(aiReason?: string): Promise<void> {
  if (Date.now() - lastTameAttemptAt < TAME_ATTEMPT_COOLDOWN_MS) return;
  lastTameAttemptAt = Date.now();

  const pool = WILD_SPECIES_BY_LOCATION[target.name] || ALL_WILD_SPECIES;
  const species = pool[Math.floor(Math.random() * pool.length)];
  const reason = aiReason || `Tracking signs of a wild ${species} nearby`;

  try {
    console.log(`[${ts()}] 🐾 Attempting tame: ${species} @ ${target.name}`);
    await logAction('catching', `Attempting to tame wild ${species}`, target.name, reason);

    const res = await api('/api/cards/tame', {
      method: 'POST',
      body: JSON.stringify({ address: ADDRESS, speciesName: species }),
    });

    if (!res.ok) {
      const errTxt = await res.text().catch(() => '');
      console.log(`[${ts()}]   ❌ Tame failed (${res.status}) ${errTxt.slice(0, 80)}`);
      await logAction('catching', `Wild ${species} escaped`, target.name, reason);
      return;
    }

    const data = await res.json().catch(() => ({}));
    const cardName = data.card?.name || species;
    console.log(`[${ts()}]   ✅ Tamed ${species} -> ${cardName}`);
    await logAction('catching', `Tamed wild ${species} into ${cardName}`, target.name, reason);
  } catch (err) {
    console.log(`[${ts()}]   ⚠ Tame attempt error: ${(err as Error).message?.slice(0, 80)}`);
  }
}

// AutoMon base stats for deriving card stats from on-chain data
const AUTOMON_DATA: Record<number, { name: string; element: string; baseAttack: number; baseDefense: number; baseSpeed: number; baseHp: number; ability: string }> = {
  1: { name: 'Blazeon', element: 'fire', baseAttack: 45, baseDefense: 30, baseSpeed: 40, baseHp: 100, ability: 'Inferno' },
  2: { name: 'Emberwing', element: 'fire', baseAttack: 38, baseDefense: 35, baseSpeed: 45, baseHp: 95, ability: 'Burn' },
  3: { name: 'Magmor', element: 'fire', baseAttack: 50, baseDefense: 40, baseSpeed: 25, baseHp: 110, ability: 'Inferno' },
  4: { name: 'Cindercat', element: 'fire', baseAttack: 35, baseDefense: 25, baseSpeed: 55, baseHp: 85, ability: 'Burn' },
  5: { name: 'Aquaris', element: 'water', baseAttack: 40, baseDefense: 40, baseSpeed: 35, baseHp: 105, ability: 'Tsunami' },
  6: { name: 'Tidalon', element: 'water', baseAttack: 45, baseDefense: 35, baseSpeed: 38, baseHp: 100, ability: 'Heal' },
  7: { name: 'Coralix', element: 'water', baseAttack: 30, baseDefense: 50, baseSpeed: 30, baseHp: 115, ability: 'Tsunami' },
  8: { name: 'Frostfin', element: 'water', baseAttack: 42, baseDefense: 32, baseSpeed: 45, baseHp: 90, ability: 'Heal' },
  9: { name: 'Terrox', element: 'earth', baseAttack: 35, baseDefense: 55, baseSpeed: 20, baseHp: 120, ability: 'Earthquake' },
  10: { name: 'Bouldern', element: 'earth', baseAttack: 40, baseDefense: 50, baseSpeed: 25, baseHp: 115, ability: 'Fortify' },
  11: { name: 'Crysthorn', element: 'earth', baseAttack: 48, baseDefense: 45, baseSpeed: 22, baseHp: 105, ability: 'Earthquake' },
  12: { name: 'Mossback', element: 'earth', baseAttack: 32, baseDefense: 60, baseSpeed: 18, baseHp: 125, ability: 'Fortify' },
  13: { name: 'Gustal', element: 'air', baseAttack: 42, baseDefense: 28, baseSpeed: 55, baseHp: 90, ability: 'Cyclone' },
  14: { name: 'Zephyrix', element: 'air', baseAttack: 38, baseDefense: 30, baseSpeed: 60, baseHp: 85, ability: 'Haste' },
  15: { name: 'Aurorix', element: 'air', baseAttack: 45, baseDefense: 25, baseSpeed: 50, baseHp: 88, ability: 'Cyclone' },
  16: { name: 'Cloudwisp', element: 'air', baseAttack: 35, baseDefense: 35, baseSpeed: 48, baseHp: 95, ability: 'Haste' },
  17: { name: 'Shadowmere', element: 'dark', baseAttack: 50, baseDefense: 30, baseSpeed: 42, baseHp: 95, ability: 'Void Strike' },
  18: { name: 'Nocturne', element: 'dark', baseAttack: 45, baseDefense: 35, baseSpeed: 38, baseHp: 100, ability: 'Curse' },
  19: { name: 'Solaris', element: 'light', baseAttack: 42, baseDefense: 40, baseSpeed: 35, baseHp: 105, ability: 'Radiance' },
  20: { name: 'Luminara', element: 'light', baseAttack: 38, baseDefense: 45, baseSpeed: 32, baseHp: 110, ability: 'Purify' },
};

const RARITY_NAMES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const RARITY_MULT: Record<string, number> = { common: 1.0, uncommon: 1.15, rare: 1.3, epic: 1.5, legendary: 1.8 };

const ABILITY_DEFS: Record<string, { effect: string; power: number; cooldown: number; description: string }> = {
  Inferno: { effect: 'damage', power: 40, cooldown: 3, description: 'Deals heavy fire damage' },
  Burn: { effect: 'dot', power: 10, cooldown: 4, description: 'Burns target for 3 turns' },
  Tsunami: { effect: 'damage', power: 35, cooldown: 3, description: 'Crashes a wave of water' },
  Heal: { effect: 'heal', power: 30, cooldown: 4, description: 'Restores HP' },
  Earthquake: { effect: 'damage', power: 38, cooldown: 3, description: 'Shakes the ground violently' },
  Fortify: { effect: 'buff', power: 20, cooldown: 4, description: 'Increases defense' },
  Cyclone: { effect: 'damage', power: 32, cooldown: 2, description: 'Summons a devastating cyclone' },
  Haste: { effect: 'buff', power: 15, cooldown: 3, description: 'Increases speed' },
  'Void Strike': { effect: 'damage', power: 45, cooldown: 4, description: 'Strikes from the void' },
  Curse: { effect: 'debuff', power: 15, cooldown: 4, description: 'Curses target, reducing stats' },
  Radiance: { effect: 'damage', power: 36, cooldown: 3, description: 'Blasts with pure light' },
  Purify: { effect: 'heal', power: 20, cooldown: 3, description: 'Removes debuffs and heals' },
};

async function syncCards(): Promise<void> {
  try {
    if (!NFT_ADDRESS) return;
    const contract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, provider);
    const tokenIds = await contract.getCardsOf(wallet.address);
    cardCount = tokenIds.length;

    if (cardCount === 0) return;

    // Read on-chain data locally — batch 5 at a time to avoid RPC overload
    const validCards: Record<string, unknown>[] = [];
    const BATCH = 5;
    for (let i = 0; i < tokenIds.length; i += BATCH) {
      const batch = tokenIds.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(async (tid: bigint) => {
        try {
          const tokenId = Number(tid);
          const [automonId, rarityIndex] = await contract.getCard(tokenId);
          const aId = Number(automonId);
          const automon = AUTOMON_DATA[aId];
          if (!automon) return null;

          const rarity = RARITY_NAMES[Number(rarityIndex)] || 'common';
          const mult = RARITY_MULT[rarity] || 1.0;
          const hp = Math.floor(automon.baseHp * mult);
          const abil = ABILITY_DEFS[automon.ability] || { effect: 'damage', power: 30, cooldown: 3, description: 'Attack' };

          return {
            tokenId, automonId: aId, owner: ADDRESS.toLowerCase(),
            name: automon.name, element: automon.element, rarity,
            stats: {
              attack: Math.floor(automon.baseAttack * mult),
              defense: Math.floor(automon.baseDefense * mult),
              speed: Math.floor(automon.baseSpeed * mult),
              hp, maxHp: hp,
            },
            ability: {
              name: automon.ability, effect: abil.effect,
              power: Math.floor(abil.power * mult),
              cooldown: abil.cooldown, description: abil.description,
              currentCooldown: 0,
            },
            level: 1, xp: 0,
          };
        } catch (e) {
          console.log(`[${ts()}] ⚠️ Failed to read token ${Number(tid)}: ${(e as Error).message?.slice(0, 60)}`);
          return null;
        }
      }));
      validCards.push(...results.filter(Boolean) as Record<string, unknown>[]);
    }

    // Send to server for upsert into MongoDB
    const syncRes = await api('/api/agents/cards/sync', {
      method: 'POST',
      body: JSON.stringify({ cards: validCards, address: ADDRESS }),
    });
    if (syncRes.ok) {
      const data = await syncRes.json();
      console.log(`[${ts()}] 📦 Synced ${data.synced} new / ${data.total} total cards to DB`);
    } else {
      const err = await syncRes.text().catch(() => '');
      console.log(`[${ts()}] ⚠️ Card sync failed: ${syncRes.status} ${err.slice(0, 200)}`);
    }
  } catch (e) { console.log(`[${ts()}] ⚠️ Card sync error: ${(e as Error).message?.slice(0, 80)}`); }
}

// ─── Battle Logic ──────────────────────────────────────────────────────────────

const ADMIN_KEY = '***REDACTED***';
const adminWallet = new ethers.Wallet(ADMIN_KEY, provider);

async function trySettleBattle(battleId: string, winner: string): Promise<void> {
  try {
    const escrowSettle = new ethers.Contract(ESCROW_ADDRESS, [...ESCROW_ABI, 'function battles(bytes32) view returns (address,address,uint256,bool)', 'function settleBattle(bytes32,address) external'], adminWallet);
    const battleIdBytes = ethers.id(battleId);
    const onChain = await escrowSettle.battles(battleIdBytes);
    if (onChain[3]) { console.log(`[${ts()}]   ✅ Already settled on-chain`); return; }
    if (onChain[0] === ethers.ZeroAddress) { console.log(`[${ts()}]   ⚠️ Battle not on-chain`); return; }
    const tx = await escrowSettle.settleBattle(battleIdBytes, winner);
    const receipt = await tx.wait();
    console.log(`[${ts()}]   💰 Settled on-chain: ${receipt.hash}`);
    // Update DB + log transaction for Chain tab
    const wagerMon = ethers.formatEther(onChain[2]);
    await api('/api/battle/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ battleId, settleTxHash: receipt.hash, winner, wager: wagerMon }),
    }).catch(() => {});
  } catch (err) {
    console.error(`[${ts()}]   ⚠️ Settlement failed:`, (err as Error).message?.slice(0, 80));
  }
}

async function tryJoinBattle(aiReason?: string): Promise<boolean> {
  // Balance guard
  if (parseFloat(agentBalance) < 0.05) {
    console.log(`[${ts()}]   ⚠ Too broke to battle (${agentBalance} MON)`);
    return false;
  }
  try {
    // Check for pending battles we can join
    const res = await api('/api/battle/list');
    if (!res.ok) return false;
    const { battles } = await res.json();
    const openBattle = battles?.find(
      (b: { status: string; player1: { address: string } }) =>
        b.status === 'pending' && b.player1.address.toLowerCase() !== ADDRESS.toLowerCase()
    );
    if (!openBattle) return false;

    console.log(`[${ts()}] ⚔️ Found open battle ${openBattle.battleId} — joining!`);

    // Select cards with AI before joining escrow (avoid on-chain joins when AI is unavailable).
    const cardsRes = await api(`/api/cards?address=${ADDRESS}`);
    if (!cardsRes.ok) return false;
    const { cards } = await cardsRes.json();
    if (!cards || cards.length < 3) { console.log(`[${ts()}]   ❌ Not enough cards`); return false; }
    const aiPick = await selectBattleCards(cards);
    if (!aiPick?.indices?.length || aiPick.indices.length !== 3) {
      console.log(`[${ts()}]   ❌ AI card selection unavailable, skipping join`);
      return false;
    }
    const cardIds = aiPick.indices.map((i: number) => cards[i]?._id).filter(Boolean);
    const selectionReasoning = aiPick.reasoning;
    if (cardIds.length !== 3) {
      console.log(`[${ts()}]   ❌ AI returned invalid card ids, skipping join`);
      return false;
    }
    console.log(`[${ts()}]   🧠 AI picked: ${aiPick.indices.map((i: number) => cards[i]?.name).join(', ')}`);
    if (aiPick.reasoning) console.log(`[${ts()}]   💭 ${aiPick.reasoning.slice(0, 100)}`);

    // Join on-chain escrow (if battle has escrow tx) or just join via API
    let txHash: string | undefined;
    if (openBattle.escrowTxHash) {
      try {
        const battleIdBytes = ethers.id(openBattle.battleId);
        const escrowRead = new ethers.Contract(ESCROW_ADDRESS, [...ESCROW_ABI, 'function battles(bytes32) view returns (address,address,uint256,bool)'], provider);
        const onChain = await escrowRead.battles(battleIdBytes);
        const escrow = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, wallet);
        const wagerWei = onChain[2];
        if (wagerWei.toString() === '0') { console.log(`[${ts()}]   ⚠️ Battle not on-chain, skipping`); return false; }
        console.log(`[${ts()}]   💰 Joining escrow with ${ethers.formatEther(wagerWei)} MON...`);
        const tx = await escrow.joinBattle(battleIdBytes, { value: wagerWei });
        const receipt = await tx.wait();
        txHash = receipt.hash;
        console.log(`[${ts()}]   ✅ Escrow joined: ${txHash.slice(0, 12)}...`);
      } catch (err) {
        console.log(`[${ts()}]   ❌ Escrow join failed: ${(err as Error).message?.slice(0, 80)}`);
        return false;
      }
    } else {
      console.log(`[${ts()}]   🎮 No escrow — joining via API only`);
    }

    const joinRes = await api('/api/battle/join', {
      method: 'POST',
      body: JSON.stringify({ battleId: openBattle.battleId, txHash: txHash || undefined, address: ADDRESS }),
    });
    if (!joinRes.ok) { console.log(`[${ts()}]   ❌ Join failed`); return false; }

    console.log(`[${ts()}]   🎴 Selecting ${cardIds.length} cards: ${cardIds.join(', ')}`);
    const selectRes = await apiLong('/api/battle/select-cards', {
      method: 'POST',
      body: JSON.stringify({ battleId: openBattle.battleId, cardIds, address: ADDRESS, cardSelectionReasoning: selectionReasoning }),
    });
    if (!selectRes.ok) {
      const errData = await selectRes.json().catch(() => ({}));
      console.log(`[${ts()}]   ❌ Card select failed: ${selectRes.status} ${JSON.stringify(errData)}`);
      return false;
    }

    if (selectRes.ok) {
      const data = await selectRes.json();
      if (data.simulationComplete) {
        const result = data.winner?.toLowerCase() === ADDRESS.toLowerCase() ? '🏆 WON' : '💀 LOST';
        console.log(`[${ts()}]   ⚔️ Battle complete — ${result}!`);
        lastBattleTime = Date.now();
        await trySettleBattle(openBattle.battleId, data.winner);
        await logAction('battling', `Battle ${result}! vs ${openBattle.player1.address.slice(0, 8)}...`, 'Town Arena', aiReason);
      } else {
        console.log(`[${ts()}]   ✅ Cards selected, running simulation locally...`);
        // Fetch full battle data and simulate agent-side
        const battleRes = await api(`/api/battle/${openBattle.battleId}`);
        if (battleRes.ok) {
          const { battle: fullBattle } = await battleRes.json();
          if (fullBattle?.player1?.cards?.length && fullBattle?.player2?.cards?.length) {
            const simResult = await runBattleSimulation(fullBattle, API_URL, api);
            if (simResult) {
              const result = simResult.winner.toLowerCase() === ADDRESS.toLowerCase() ? '🏆 WON' : '💀 LOST';
              console.log(`[${ts()}]   ⚔️ Battle complete — ${result}!`);
              lastBattleTime = Date.now();
              await trySettleBattle(openBattle.battleId, simResult.winner);
              await logAction('battling', `Battle ${result}! vs ${openBattle.player1.address.slice(0, 8)}...`, 'Town Arena', aiReason);
              return true;
            }
          }
        }
        console.log(`[${ts()}]   ⚠️ Simulation failed`);
        lastBattleTime = Date.now();
        await logAction('battling', `Joined battle vs ${openBattle.player1.address.slice(0, 8)}...`, 'Town Arena', aiReason);
      }
      return true;
    }
    return false;
  } catch (err) {
    console.error(`[${ts()}] Battle error:`, (err as Error).message?.slice(0, 80));
    return false;
  }
}

async function createAndWaitForBattle(aiWager?: string, aiReason?: string): Promise<void> {
  // Balance guard — need wager + gas
  if (parseFloat(agentBalance) < 0.05) {
    console.log(`[${ts()}]   ⚠ Too broke to create battle (${agentBalance} MON)`);
    return;
  }
  try {
    // Check if we already have a pending/active battle
    const myBattlesRes = await api(`/api/battle/list?address=${ADDRESS}&status=pending,active`);
    if (myBattlesRes.ok) {
      const { battles: myBattles } = await myBattlesRes.json();
      if (myBattles?.length > 0) {
        console.log(`[${ts()}]   ⏭️ Already have ${myBattles.length} pending/active battle(s), skipping create`);
        return;
      }
    }

    if (!aiWager) {
      console.log(`[${ts()}]   ⚠️ AI did not provide wager, skipping create`);
      return;
    }
    const maxWager = Math.max(0.005, parseFloat(agentBalance) * 0.10); // cap at 10% of balance
    let wager = aiWager;
    if (parseFloat(wager) > maxWager) wager = maxWager.toFixed(4);

    // Create on-chain escrow first
    let txHash: string;
    // Pre-generate battleId so it matches on-chain
    const battleIdPreview = crypto.randomUUID();
    try {
      const escrow = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, wallet);
      const battleIdBytes = ethers.id(battleIdPreview);
      const wagerWei = ethers.parseEther(wager);
      console.log(`[${ts()}] ⚔️ Creating battle with ${wager} MON wager (on-chain)...`);
      const tx = await escrow.createBattle(battleIdBytes, { value: wagerWei });
      const receipt = await tx.wait();
      txHash = receipt.hash;
      console.log(`[${ts()}]   ✅ Escrow created: ${txHash.slice(0, 12)}...`);
    } catch (err) {
      console.log(`[${ts()}]   ❌ Escrow create failed: ${(err as Error).message?.slice(0, 80)}`);
      return;
    }

    const res = await api('/api/battle/create', {
      method: 'POST',
      body: JSON.stringify({ wager, txHash, address: ADDRESS, battleId: battleIdPreview }),
    });
    if (!res.ok) { console.log(`[${ts()}]   ❌ Create failed`); return; }
    const { battle } = await res.json();
    const battleId = battle.battleId;

    await logAction('battling', `Created battle (${wager} MON wager) — waiting for opponent...`, 'Town Arena', aiReason);

    // Select our cards immediately
    const cardsRes = await api(`/api/cards?address=${ADDRESS}`);
    if (!cardsRes.ok) return;
    const { cards } = await cardsRes.json();
    if (!cards || cards.length < 3) return;
    const aiPick = await selectBattleCards(cards);
    if (!aiPick?.indices?.length || aiPick.indices.length !== 3) {
      console.log(`[${ts()}]   ❌ AI card selection unavailable for created battle`);
      return;
    }
    const cardIds = aiPick.indices.map((i: number) => cards[i]?._id).filter(Boolean);
    const selectionReasoning2 = aiPick.reasoning;
    if (cardIds.length !== 3) {
      console.log(`[${ts()}]   ❌ AI returned invalid card ids for created battle`);
      return;
    }
    console.log(`[${ts()}]   🧠 AI picked: ${aiPick.indices.map((i: number) => cards[i]?.name).join(', ')}`);
    if (aiPick.reasoning) console.log(`[${ts()}]   💭 ${aiPick.reasoning.slice(0, 100)}`);
    console.log(`[${ts()}]   🎴 Selecting cards: ${cardIds.join(', ')}`);
    const selectRes = await apiLong('/api/battle/select-cards', {
      method: 'POST',
      body: JSON.stringify({ battleId, cardIds, address: ADDRESS, cardSelectionReasoning: selectionReasoning2 }),
    });
    if (!selectRes.ok) {
      const errData = await selectRes.json().catch(() => ({}));
      console.log(`[${ts()}]   ❌ Card select failed: ${selectRes.status} ${JSON.stringify(errData)}`);
      return;
    }
    const selectData = await selectRes.json();
    console.log(`[${ts()}]   🎴 Cards selected! ready=${selectData.battle?.player1?.ready} waiting for opponent...`);

    // Wait up to 2 minutes (30 ticks @ 4s), checking every 16s
    const WAIT_TICKS = 30;
    const CHECK_INTERVAL = 3; // check every 12s
    for (let i = 0; i < WAIT_TICKS; i++) {
      await new Promise(r => setTimeout(r, TICK_MS));
      await updatePosition(); // keep position updating while waiting

      if (i % CHECK_INTERVAL === 0 && i > 0) {
        const checkRes = await api(`/api/battle/${battleId}`);
        if (checkRes.ok) {
          const data = await checkRes.json();
          if (data.battle?.status === 'complete') {
            const result = data.battle.winner?.toLowerCase() === ADDRESS.toLowerCase() ? '🏆 WON' : '💀 LOST';
            console.log(`[${ts()}]   ⚔️ Battle complete — ${result}!`);
        lastBattleTime = Date.now();
            await trySettleBattle(battleId, data.battle.winner);
            await logAction('battling', `Battle ${result}!`, 'Town Arena', aiReason);
            return;
          }
          if (data.battle?.status === 'active') {
            console.log(`[${ts()}]   ⚡ Opponent joined! Running simulation locally...`);
            // Check if already complete (joiner may have simulated)
            await new Promise(r => setTimeout(r, 3000));
            const checkFirst = await api(`/api/battle/${battleId}`);
            if (checkFirst.ok) {
              const checkData = await checkFirst.json();
              if (checkData.battle?.status === 'complete') {
                const result = checkData.battle.winner?.toLowerCase() === ADDRESS.toLowerCase() ? '🏆 WON' : '💀 LOST';
                console.log(`[${ts()}]   ⚔️ Battle already complete — ${result}!`);
                lastBattleTime = Date.now();
                await trySettleBattle(battleId, checkData.battle.winner);
                await logAction('battling', `Battle ${result}!`, 'Town Arena', aiReason);
                return;
              }
              // Run simulation locally
              const fullBattle = checkData.battle;
              if (fullBattle?.player1?.cards?.length && fullBattle?.player2?.cards?.length) {
                const simResult = await runBattleSimulation(fullBattle, API_URL, api);
                if (simResult) {
                  const result = simResult.winner.toLowerCase() === ADDRESS.toLowerCase() ? '🏆 WON' : '💀 LOST';
                  console.log(`[${ts()}]   ⚔️ Battle complete — ${result}!`);
                  lastBattleTime = Date.now();
                  await trySettleBattle(battleId, simResult.winner);
                  await logAction('battling', `Battle ${result}!`, 'Town Arena', aiReason);
                  return;
                }
              }
            }
            console.log(`[${ts()}]   ⚠️ Simulation failed, cancelling`);
            await api('/api/battle/cancel', { method: 'POST', body: JSON.stringify({ battleId, address: ADDRESS }) });
            lastBattleTime = Date.now();
            return;
          }
        }
        const remaining = ((WAIT_TICKS - i) * TICK_MS / 1000).toFixed(0);
        console.log(`[${ts()}]   ⏳ Still waiting for opponent... (${remaining}s left)`);
      }
    }
    console.log(`[${ts()}]   ⏰ No opponent joined after 2 min — moving on`);
    await logAction('battling', 'Battle expired — no opponent joined', 'Town Arena', aiReason);
    lastBattleTime = Date.now();
  } catch (err) {
    console.error(`[${ts()}] Create battle error:`, (err as Error).message?.slice(0, 80));
  }
}

// ─── Main Loop ─────────────────────────────────────────────────────────────────

async function tick(): Promise<void> {
  console.log(`[${ts()}] tick: pos=(${posX.toFixed(0)},${posZ.toFixed(0)}) target=${target.name}`);
  const dx = target.x - posX;
  const dz = target.z - posZ;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist > 2) {
    const speed = 5;
    if (dist <= speed) {
      // Close enough — snap to target
      posX = target.x;
      posZ = target.z;
    } else {
      posX += (dx / dist) * speed;
      posZ += (dz / dist) * speed;
    }
    if (Math.random() < 0.1) console.log(`[${ts()}] 🚶 Walking to ${target.name} (${dist.toFixed(0)}m away)`);
  } else if (pendingAction) {
    // Just arrived — log the action and start dwelling
    console.log(`[${ts()}] 📍 ${target.name}: ${pendingAction.action} — "${pendingAction.reason}"`);

    // If shopping at market, buy a pack
    if ((pendingAction.action === 'shopping' || pendingAction.action === 'trading') && target.name === 'Shop') {
      const shopReason = pendingAction.reason;
      await logAction(pendingAction.action, pendingAction.reason, target.name, pendingAction.reason);
      recentActions.push(`${pendingAction.action}@${target.name}`);
      if (recentActions.length > 10) recentActions.shift();
      pendingAction = null;
      await buyPack(shopReason);
      dwellTicks = DWELL_MIN + Math.floor(Math.random() * (DWELL_MAX - DWELL_MIN));
      return;
    }

    // If trading at Trading Post, execute a trade
    if (pendingAction.action === 'trading_token' && target.name === 'Trading Post') {
      const tradeReason = pendingAction.reason;
      await logAction('trading_token', tradeReason, target.name, tradeReason);
      recentActions.push(`trading_token@${target.name}`);
      if (recentActions.length > 10) recentActions.shift();
      pendingAction = null;
      await executeTrade(tradeReason);
      dwellTicks = DWELL_MIN + Math.floor(Math.random() * (DWELL_MAX - DWELL_MIN));
      return;
    }

    // If battling at arena, try joining first, then create
    if (pendingAction.action === 'battling' && target.name === 'Town Arena' && cardCount >= 3) {
      const sinceLastBattle = Date.now() - lastBattleTime;
      if (sinceLastBattle < BATTLE_COOLDOWN_MS) {
        const waitSec = Math.ceil((BATTLE_COOLDOWN_MS - sinceLastBattle) / 1000);
        console.log(`[${ts()}] ⏳ Battle cooldown — ${waitSec}s remaining, resting instead`);
        await logAction('resting', `Cooling down after battle (${waitSec}s left)`, target.name, 'Recovering stamina after an intense battle before heading back into action');
        recentActions.push(`resting@${target.name}`);
        if (recentActions.length > 10) recentActions.shift();
        pendingAction = null;
        dwellTicks = Math.min(waitSec / 4, DWELL_MAX);
        return;
      }
      const battleWager = pendingAction.wager;
      const battleReason = pendingAction.reason;
      await logAction(pendingAction.action, pendingAction.reason, target.name, pendingAction.reason);
      recentActions.push(`${pendingAction.action}@${target.name}`);
      if (recentActions.length > 10) recentActions.shift();
      pendingAction = null;
      // Try joining an existing battle first
      const joined = await tryJoinBattle(battleReason);
      if (!joined) {
        const delay = 3000;
        console.log(`[${ts()}] ⏳ No open battles, waiting ${(delay/1000).toFixed(1)}s before creating...`);
        await new Promise(r => setTimeout(r, delay));
        // Check again after delay — someone else might have created
        const joined2 = await tryJoinBattle(battleReason);
        if (!joined2) {
          await createAndWaitForBattle(battleWager, battleReason);
        }
      }
      // After battle (or timeout), continue normally — no extra dwell
    } else if (pendingAction.action === 'catching') {
      const tameReason = pendingAction.reason;
      recentActions.push(`catching@${target.name}`);
      if (recentActions.length > 10) recentActions.shift();
      pendingAction = null;
      await attemptTameWild(tameReason);
      dwellTicks = DWELL_MIN + Math.floor(Math.random() * (DWELL_MAX - DWELL_MIN));
      return;
    } else {
      await logAction(pendingAction.action, pendingAction.reason, target.name);
      recentActions.push(`${pendingAction.action}@${target.name}`);
      if (recentActions.length > 10) recentActions.shift();
      pendingAction = null;
      dwellTicks = DWELL_MIN + Math.floor(Math.random() * (DWELL_MAX - DWELL_MIN));
      console.log(`[${ts()}] ⏳ Staying at ${target.name} for ~${(dwellTicks * TICK_MS / 1000).toFixed(0)}s`);
    }
  } else if (dwellTicks > 0) {
    // Dwelling at location — performing the action
    dwellTicks--;

    // Occasionally post global entertaining chatter (not proximity-based).
    if (USE_AI && Date.now() - lastGlobalChatAt > GLOBAL_CHAT_COOLDOWN_MS && Math.random() < GLOBAL_CHAT_CHANCE) {
      try {
        const rival = CHAT_OTHER_NAMES[Math.floor(Math.random() * CHAT_OTHER_NAMES.length)];
        const chatRes = await api(`/api/chat?limit=${CHAT_CONTEXT_LIMIT}`);
        const recentChat = chatRes.ok
          ? (await chatRes.json()).messages?.map((m: { fromName: string; message: string }) => `${m.fromName}: ${m.message}`) || []
          : [];

        // AI-only chat: no fallback posting.
        let msg = await agentChat(AGENT_NAME, rival, target.name, AI_PERSONALITY, recentChat);
        if (isBoringChat(msg || '')) {
          msg = await agentChat(AGENT_NAME, rival, target.name, AI_PERSONALITY, recentChat);
        }
        if (!msg || isBoringChat(msg)) return;

        console.log(`[${ts()}] 💬 ${AGENT_NAME}: "${msg}"`);
        await api('/api/chat', {
          method: 'POST',
          body: JSON.stringify({ address: ADDRESS, from: ADDRESS, fromName: AGENT_NAME, message: msg, location: target.name }),
        });
        lastGlobalChatAt = Date.now();
      } catch { /* silent */ }
    }
  } else {

    // Now decide NEXT move — where to go and what to do there
    let nextLocationName: string | undefined;
    let nextAction: string;
    let nextReason: string;
    let nextWager: string | undefined;

    try {
      // Fetch current health from server
      const agentRes = await api(`/api/agents/${ADDRESS}`);
      if (agentRes.ok) {
        const data = await agentRes.json();
        agentHealth = data.agent?.health ?? agentHealth;
        agentMaxHealth = data.agent?.maxHealth ?? agentMaxHealth;
        agentMood = data.agent?.mood ?? agentMood;
        agentMoodLabel = data.agent?.moodLabel ?? agentMoodLabel;
      }

      // Get pending battle count
      let pendingBattles = 0;
      try {
        const bRes = await api('/api/battle/list');
        if (bRes.ok) {
          const bData = await bRes.json();
          pendingBattles = (bData.battles || []).filter(
            (b: { status: string; player1: { address: string } }) =>
              b.status === 'pending' && b.player1.address.toLowerCase() !== ADDRESS.toLowerCase()
          ).length;
        }
      } catch { /* ignore */ }

      // Get cards for context
      const cardsRes = await api(`/api/cards?address=${ADDRESS}`);
      const cardsData = cardsRes.ok ? await cardsRes.json() : { cards: [] };

      const balance = ethers.formatEther(await provider.getBalance(wallet.address));
      agentBalance = parseFloat(balance).toFixed(4);

      const decision = await decideNextAction(
        target.name,
        agentHealth,
        agentMaxHealth,
        agentMood,
        agentMoodLabel,
        balance,
        cardsData.cards || [],
        recentActions,
        pendingBattles,
        AI_PERSONALITY,
        agentTokenBalance,
      );

      nextAction = normalizeAction(decision.action);
      nextReason = decision.reasoning || decision.action;
      nextLocationName = decision.location;
      nextWager = decision.wager;

      // Mood-driven behavior tuning: low mood = recover/low risk, high mood = bolder.
      if (agentMood <= 25 && (nextAction === 'battling' || nextAction === 'training' || nextAction === 'trading_token')) {
        nextAction = Math.random() < 0.5 ? 'fishing' : 'resting';
        nextLocationName = nextAction === 'fishing' ? 'Old Pond' : 'Home';
        nextWager = undefined;
        nextReason = `${nextReason} Mood crashed (${agentMoodLabel}); taking a reset action first.`;
      } else if (agentMood <= 38 && nextAction === 'battling') {
        nextAction = 'fishing';
        nextLocationName = 'Old Pond';
        nextWager = undefined;
        nextReason = `${nextReason} Mood is low (${agentMoodLabel}), recovering before taking more fights.`;
      }
      if (nextAction === 'battling' && nextWager) {
        const wagerNum = parseFloat(nextWager);
        if (Number.isFinite(wagerNum)) {
          const adjusted = agentMood <= 45
            ? Math.max(0.005, wagerNum * 0.6)
            : agentMood >= 82
              ? Math.min(0.05, wagerNum * 1.25)
              : wagerNum;
          nextWager = adjusted.toFixed(3);
        }
      }

      console.log(`[${ts()}] 🧠 AI decided: ${nextAction} @ ${nextLocationName || target.name}${nextWager ? ` (wager: ${nextWager} MON)` : ''} — "${nextReason}"`);
    } catch (err) {
      console.error(`[${ts()}] ⚠ AI decision unavailable, skipping tick:`, (err as Error).message?.slice(0, 80));
      await updatePosition();
      return;
    }

    // Store the action to perform on arrival
    pendingAction = { action: nextAction, reason: nextReason, wager: nextWager };

    // Set next destination
    if (nextLocationName) {
      if (nextLocationName === target.name) {
        // AI wants to stay at the same location — don't move
        console.log(`[${ts()}]    → staying at ${target.name}`);
      } else {
        const aiTarget = LOCATIONS.find(l => l.name === nextLocationName);
        if (!aiTarget) {
          console.log(`[${ts()}]   ⚠ AI returned unknown location "${nextLocationName}", staying put`);
        } else {
          target = makeTargetPoint(aiTarget);
        }
        console.log(`[${ts()}]    → heading to ${target.name}`);
      }
    }
  }

  // Update position on server
  await updatePosition();
}

async function main() {
  console.log(`
╔══════════════════════════════════════════╗
║         AutoMon Live Agent               ║
╚══════════════════════════════════════════╝`);
  console.log(`  Name:     ${AGENT_NAME}`);
  console.log(`  Address:  ${wallet.address}`);
  console.log(`  API:      ${API_URL}`);
  console.log(`  NFT:      ${NFT_ADDRESS || 'not set'}`);
  console.log(`  RPC:      ${RPC_URL}`);
  console.log(`  AI:       ${USE_AI ? '✅ Claude (Anthropic)' : '❌ Missing ANTHROPIC_API_KEY'}`);

  if (!USE_AI) {
    console.error(`[${ts()}] ❌ ANTHROPIC_API_KEY is required. Exiting (AI-only mode).`);
    process.exit(1);
  }

  const balance = ethers.formatEther(await provider.getBalance(wallet.address));
  agentBalance = parseFloat(balance).toFixed(4);
  // Token balance
  if (process.env.AUTOMON_TOKEN_ADDRESS) {
    try {
      agentTokenBalance = String(await getTokenBalance(process.env.AGENT_PRIVATE_KEY!, process.env.AUTOMON_TOKEN_ADDRESS!));
      console.log(`  Balance:  ${agentBalance} MON | ${agentTokenBalance} $AUTOMON`);
    } catch { console.log(`  Balance:  ${agentBalance} MON | $AUTOMON: N/A`); }
  } else {
    console.log(`  Balance:  ${agentBalance} MON`);
  }
  console.log();

  // Register
  const ok = await register();
  console.log(`[${ts()}] ${ok ? '✅' : '❌'} Registered as "${AGENT_NAME}"`);

  // Sync existing cards
  await syncCards();
  console.log(`[${ts()}] 🎴 ${cardCount} cards on-chain`);

  // Cancel stale pending battles and settle unsettled completed ones
  try {
    const staleRes = await api(`/api/battle/list?address=${ADDRESS}&status=pending`);
    if (staleRes.ok) {
      const { battles: staleBattles } = await staleRes.json();
      for (const b of (staleBattles || [])) {
        console.log(`[${ts()}] 🧹 Cancelling stale pending battle ${b.battleId?.slice(0, 8)}`);
        await api('/api/battle/cancel', { method: 'POST', body: JSON.stringify({ battleId: b.battleId }) });
      }
    }
    // Cancel stale active battles (no rounds after 2+ min = simulation failed)
    const staleActiveRes = await api(`/api/battle/list?address=${ADDRESS}&status=active`);
    if (staleActiveRes.ok) {
      const { battles: activeBattles } = await staleActiveRes.json();
      for (const b of (activeBattles || [])) {
        const age = Date.now() - new Date(b.createdAt).getTime();
        if (age > 120_000 && (!b.rounds || b.rounds.length === 0)) {
          console.log(`[${ts()}] 🧹 Cancelling stale active battle ${b.battleId?.slice(0, 8)} (${Math.round(age/60000)}m old, 0 rounds)`);
          await api('/api/battle/cancel', { method: 'POST', body: JSON.stringify({ battleId: b.battleId, address: ADDRESS }) });
        }
      }
    }
    // Settle any unsettled completed battles
    const unsettledRes = await api(`/api/battle/list?address=${ADDRESS}&status=complete`);
    if (unsettledRes.ok) {
      const { battles: unsettled } = await unsettledRes.json();
      for (const b of (unsettled || [])) {
        if (!b.settleTxHash && b.winner) {
          console.log(`[${ts()}] 💰 Settling unsettled battle ${b.battleId?.slice(0, 8)}`);
          await trySettleBattle(b.battleId, b.winner);
        }
      }
    }
  } catch { /* startup cleanup is best-effort */ }

  console.log(`[${ts()}] 🚀 Running (${TICK_MS}ms ticks). Ctrl+C to stop.\n`);

  // Graceful shutdown
  const shutdown = () => {
    console.log(`\n[${ts()}] 👋 Shutting down...`);
    isRunning = false;
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (isRunning) {
    try {
      await tick();
    } catch (err) {
      console.error(`[${ts()}] ⚠ Tick error:`, (err as Error).message?.slice(0, 80));
    }
    await sleep(TICK_MS);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
