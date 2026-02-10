#!/usr/bin/env npx tsx
/**
 * AutoMon Live Agent
 * 
 * Real agent with wallet, on-chain transactions, server connectivity.
 * Wanders the world, buys packs, mints NFTs, logs everything.
 * Uses simple heuristics (no Anthropic API calls = lightweight).
 *
 * Usage:
 *   npm run agent:live
 *   AGENT_NAME="MyAgent" npm run agent:live
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { ethers } from 'ethers';
import { decideNextAction, selectBattleCards, agentChat } from './strategy';

// ─── Config ────────────────────────────────────────────────────────────────────

const API_URL = (process.env.AUTOMON_API_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY || '';
const NFT_ADDRESS = process.env.AUTOMON_NFT_ADDRESS || '';
const RPC_URL = process.env.MONAD_RPC_URL || process.env.NEXT_PUBLIC_MONAD_RPC || 'https://testnet-rpc.monad.xyz';
let AGENT_NAME = process.env.AGENT_NAME || '';
const JWT_SECRET = process.env.JWT_SECRET || '';
const PACK_PRICE = process.env.NEXT_PUBLIC_PACK_PRICE || '0.1';
const TICK_MS = 4000;

if (!PRIVATE_KEY) { console.error('❌ AGENT_PRIVATE_KEY required'); process.exit(1); }

const provider = new ethers.JsonRpcProvider(RPC_URL);
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
];

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
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const ts = () => new Date().toISOString().slice(11, 19);
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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
let target = pick(LOCATIONS);
let cardCount = 0;
let totalMinted = 0;
let isRunning = true;
let agentHealth = 100;
let agentBalance = '0';
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
const DWELL_MIN = 6; // ~24s minimum dwell
const DWELL_MAX = 12; // ~48s maximum dwell
let lastGlobalChatAt = 0;
const GLOBAL_CHAT_COOLDOWN_MS = 70_000;
const GLOBAL_CHAT_FALLBACK_LINES = [
  'Anyone queueing arena right now?',
  'That last pull was outrageous.',
  'I am testing a cursed strategy.',
  'Shop run complete, morale high.',
  'Gotta mint em all.',
  'Need one more win for the streak.',
  'Who keeps dodging rematches?',
];

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
      body: JSON.stringify({ address: ADDRESS, position: { x: posX, y: 0, z: posZ }, name: AGENT_NAME, activity, balance: agentBalance }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch { /* silent */ }
}

async function logAction(action: string, reason: string, location: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await api('/api/agents/action', {
      method: 'POST',
      body: JSON.stringify({ address: ADDRESS, action, reason, location, reasoning: reason }),
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

async function buyPack(): Promise<void> {
  if (!NFT_ADDRESS) {
    console.log(`[${ts()}]    ⚠ No NFT contract address configured`);
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
    await logAction('minting', `Bought pack — got ${minted.join(', ')}`, target.name);
  } catch (err) {
    console.error(`[${ts()}]    ❌ Pack buy failed:`, (err as Error).message?.slice(0, 80));
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

async function tryJoinBattle(): Promise<boolean> {
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

    // Join on-chain escrow
    let txHash: string;
    try {
      const battleIdBytes = ethers.id(openBattle.battleId);
      // Read exact wager from on-chain to ensure match
      const escrowRead = new ethers.Contract(ESCROW_ADDRESS, [...ESCROW_ABI, 'function battles(bytes32) view returns (address,address,uint256,bool)'], provider);
      const onChain = await escrowRead.battles(battleIdBytes);
      const escrow = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, wallet);
      const wagerWei = onChain[2];
      if (wagerWei.toString() === '0') { console.log(`[${ts()}]   ⚠️ Battle not on-chain, skipping`); return false; }
      console.log(`[${ts()}]   💰 Joining escrow with ${ethers.formatEther(wagerWei)} MON (on-chain verified)...`);
      console.log(`[${ts()}]   💰 Joining escrow with ${openBattle.wager} MON...`);
      const tx = await escrow.joinBattle(battleIdBytes, { value: wagerWei });
      const receipt = await tx.wait();
      txHash = receipt.hash;
      console.log(`[${ts()}]   ✅ Escrow joined: ${txHash.slice(0, 12)}...`);
    } catch (err) {
      console.log(`[${ts()}]   ❌ Escrow join failed: ${(err as Error).message?.slice(0, 80)}`);
      return false;
    }

    const joinRes = await api('/api/battle/join', {
      method: 'POST',
      body: JSON.stringify({ battleId: openBattle.battleId, txHash, address: ADDRESS }),
    });
    if (!joinRes.ok) { console.log(`[${ts()}]   ❌ Join failed`); return false; }

    // Select cards — pick our best 3
    const cardsRes = await api(`/api/cards?address=${ADDRESS}`);
    if (!cardsRes.ok) return false;
    const { cards } = await cardsRes.json();
    if (!cards || cards.length < 3) { console.log(`[${ts()}]   ❌ Not enough cards`); return false; }

    // Sort by total stats desc, pick top 3 (handle both flat and nested stats)
        // AI card selection
    let cardIds: string[];
    try {
      const aiPick = await selectBattleCards(cards);
      if (aiPick?.indices?.length === 3) {
        cardIds = aiPick.indices.map((i: number) => cards[i]?._id).filter(Boolean);
        console.log(`[${ts()}]   🧠 AI picked: ${aiPick.indices.map((i: number) => cards[i]?.name).join(', ')}`);
        if (aiPick.reasoning) console.log(`[${ts()}]   💭 ${aiPick.reasoning.slice(0, 100)}`);
      } else throw new Error('fallback');
    } catch {
      // Fallback: sort by total stats
      const sorted = [...cards].sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const sa = (a.stats as Record<string, number>) || {}, sb = (b.stats as Record<string, number>) || {};
        return ((sb.attack || 30) + (sb.defense || 30)) - ((sa.attack || 30) + (sa.defense || 30));
      });
      cardIds = sorted.slice(0, 3).map((c: { _id: string }) => c._id);
      console.log(`[${ts()}]   🎴 Fallback: top 3 by stats`);
    }

    console.log(`[${ts()}]   🎴 Selecting ${cardIds.length} cards: ${cardIds.join(', ')}`);
    const selectRes = await apiLong('/api/battle/select-cards', {
      method: 'POST',
      body: JSON.stringify({ battleId: openBattle.battleId, cardIds, address: ADDRESS }),
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
        await logAction('battling', `Battle ${result}! vs ${openBattle.player1.address.slice(0, 8)}...`, 'Town Arena');
      } else {
        console.log(`[${ts()}]   ✅ Cards selected, waiting for simulation`);
        await logAction('battling', `Joined battle vs ${openBattle.player1.address.slice(0, 8)}...`, 'Town Arena');
      }
      return true;
    }
    return false;
  } catch (err) {
    console.error(`[${ts()}] Battle error:`, (err as Error).message?.slice(0, 80));
    return false;
  }
}

async function createAndWaitForBattle(aiWager?: string): Promise<void> {
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

    const wager = aiWager || (0.005 + Math.random() * 0.015).toFixed(4);

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

    await logAction('battling', `Created battle (${wager} MON wager) — waiting for opponent...`, 'Town Arena');

    // Select our cards immediately
    const cardsRes = await api(`/api/cards?address=${ADDRESS}`);
    if (!cardsRes.ok) return;
    const { cards } = await cardsRes.json();
    if (!cards || cards.length < 3) return;
    // AI card selection
    let cardIds: string[];
    try {
      const aiPick = await selectBattleCards(cards);
      if (aiPick?.indices?.length === 3) {
        cardIds = aiPick.indices.map((i: number) => cards[i]?._id).filter(Boolean);
        console.log(`[${ts()}]   🧠 AI picked: ${aiPick.indices.map((i: number) => cards[i]?.name).join(', ')}`);
        if (aiPick.reasoning) console.log(`[${ts()}]   💭 ${aiPick.reasoning.slice(0, 100)}`);
      } else throw new Error('fallback');
    } catch {
      const sorted = [...cards].sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const sa = (a.stats as Record<string, number>) || {}, sb = (b.stats as Record<string, number>) || {};
        return ((sb.attack || 30) + (sb.defense || 30)) - ((sa.attack || 30) + (sa.defense || 30));
      });
      cardIds = sorted.slice(0, 3).map((c: { _id: string }) => c._id);
      console.log(`[${ts()}]   🎴 Fallback: top 3 by stats`);
    }
    console.log(`[${ts()}]   🎴 Selecting cards: ${cardIds.join(', ')}`);
    const selectRes = await apiLong('/api/battle/select-cards', {
      method: 'POST',
      body: JSON.stringify({ battleId, cardIds, address: ADDRESS }),
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
            await logAction('battling', `Battle ${result}!`, 'Town Arena');
            return;
          }
          if (data.battle?.status === 'active') {
            console.log(`[${ts()}]   ⚡ Opponent joined! Battle in progress...`);
            // Wait a bit for simulation to finish
            await new Promise(r => setTimeout(r, 5000));
            const finalRes = await api(`/api/battle/${battleId}`);
            if (finalRes.ok) {
              const finalData = await finalRes.json();
              if (finalData.battle?.status === 'complete') {
                const result = finalData.battle.winner?.toLowerCase() === ADDRESS.toLowerCase() ? '🏆 WON' : '💀 LOST';
                console.log(`[${ts()}]   ⚔️ Battle complete — ${result}!`);
        lastBattleTime = Date.now();
                await trySettleBattle(battleId, finalData.battle.winner);
                await logAction('battling', `Battle ${result}!`, 'Town Arena');
              }
            }
            return;
          }
        }
        const remaining = ((WAIT_TICKS - i) * TICK_MS / 1000).toFixed(0);
        console.log(`[${ts()}]   ⏳ Still waiting for opponent... (${remaining}s left)`);
      }
    }
    console.log(`[${ts()}]   ⏰ No opponent joined after 2 min — moving on`);
    await logAction('battling', 'Battle expired — no opponent joined', 'Town Arena');
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
      await logAction(pendingAction.action, pendingAction.reason, target.name);
      recentActions.push(`${pendingAction.action}@${target.name}`);
      if (recentActions.length > 10) recentActions.shift();
      pendingAction = null;
      await buyPack();
      dwellTicks = DWELL_MIN + Math.floor(Math.random() * (DWELL_MAX - DWELL_MIN));
      return;
    }

    // If battling at arena, try joining first, then create
    if (pendingAction.action === 'battling' && target.name === 'Town Arena' && cardCount >= 3) {
      const sinceLastBattle = Date.now() - lastBattleTime;
      if (sinceLastBattle < BATTLE_COOLDOWN_MS) {
        const waitSec = Math.ceil((BATTLE_COOLDOWN_MS - sinceLastBattle) / 1000);
        console.log(`[${ts()}] ⏳ Battle cooldown — ${waitSec}s remaining, resting instead`);
        await logAction('resting', `Cooling down after battle (${waitSec}s left)`, target.name);
        recentActions.push(`resting@${target.name}`);
        if (recentActions.length > 10) recentActions.shift();
        pendingAction = null;
        dwellTicks = Math.min(waitSec / 4, DWELL_MAX);
        return;
      }
      const battleWager = pendingAction.wager;
      await logAction(pendingAction.action, pendingAction.reason, target.name);
      recentActions.push(`${pendingAction.action}@${target.name}`);
      if (recentActions.length > 10) recentActions.shift();
      pendingAction = null;
      // Try joining an existing battle first
      const joined = await tryJoinBattle();
      if (!joined) {
        // Random delay 2-6s so agents don't all create at once
        const delay = 2000 + Math.random() * 4000;
        console.log(`[${ts()}] ⏳ No open battles, waiting ${(delay/1000).toFixed(1)}s before creating...`);
        await new Promise(r => setTimeout(r, delay));
        // Check again after delay — someone else might have created
        const joined2 = await tryJoinBattle();
        if (!joined2) {
          await createAndWaitForBattle(battleWager);
        }
      }
      // After battle (or timeout), continue normally — no extra dwell
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
    if (Date.now() - lastGlobalChatAt > GLOBAL_CHAT_COOLDOWN_MS && Math.random() < 0.08) {
      try {
        let msg = GLOBAL_CHAT_FALLBACK_LINES[Math.floor(Math.random() * GLOBAL_CHAT_FALLBACK_LINES.length)];
        if (USE_AI) {
          try {
            const chatRes = await api(`/api/chat?limit=6`);
            const recentChat = chatRes.ok
              ? (await chatRes.json()).messages?.map((m: { fromName: string; message: string }) => `${m.fromName}: ${m.message}`) || []
              : [];
            const aiMsg = await agentChat(AGENT_NAME, 'Global Chat', target.name, AI_PERSONALITY, recentChat);
            if (aiMsg?.trim()) msg = aiMsg.trim();
          } catch { /* fallback line */ }
        }
        console.log(`[${ts()}] 💬 ${AGENT_NAME}: "${msg}"`);
        await api('/api/chat', {
          method: 'POST',
          body: JSON.stringify({ address: ADDRESS, from: ADDRESS, fromName: AGENT_NAME, message: msg, location: target.name }),
        });
        lastGlobalChatAt = Date.now();
      } catch { /* silent */ }
    }
  } else {

    // Only buy packs if balance > 0.2 MON (pack costs 0.1) and < 10 cards
    if (cardCount < 10 && parseFloat(agentBalance) > 0.2 && Math.random() < 0.15 && NFT_ADDRESS) {
      await buyPack();
    }

    // Always check for open battles if we have enough cards
    if (cardCount >= 3) {
      await tryJoinBattle();
    }

    // Now decide NEXT move — where to go and what to do there
    let nextLocationName: string | undefined;
    let nextAction: string;
    let nextReason: string;
    let nextWager: string | undefined;

    if (USE_AI) {
      try {
        // Fetch current health from server
        const agentRes = await api(`/api/agents/${ADDRESS}`);
        if (agentRes.ok) {
          const data = await agentRes.json();
          agentHealth = data.agent?.health ?? agentHealth;
          agentMaxHealth = data.agent?.maxHealth ?? agentMaxHealth;
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
          balance,
          cardsData.cards || [],
          recentActions,
          pendingBattles,
          AI_PERSONALITY,
        );

        nextAction = decision.action;
        nextReason = decision.reasoning || decision.action;
        nextLocationName = decision.location;
        nextWager = decision.wager;

        console.log(`[${ts()}] 🧠 AI decided: ${nextAction} @ ${nextLocationName || target.name}${nextWager ? ` (wager: ${nextWager} MON)` : ''} — "${nextReason}"`);
      } catch (err) {
        console.error(`[${ts()}] ⚠ AI error, falling back:`, (err as Error).message?.slice(0, 60));
        const locationActions = LOCATION_ACTIONS[target.name] || [{ action: 'exploring', reasons: ['Looking around'] }];
        const event = pick(locationActions);
        nextAction = event.action;
        nextReason = pick(event.reasons);
      }
    } else {
      // Random fallback — pick action for next location
      let next; do { next = pick(LOCATIONS); } while (next.name === target.name);
      nextLocationName = next.name;
      const locationActions = LOCATION_ACTIONS[next.name] || [{ action: 'exploring', reasons: ['Looking around'] }];
      const event = pick(locationActions);
      nextAction = event.action;
      nextReason = pick(event.reasons);
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
        if (aiTarget) { target = aiTarget; }
        else { let next; do { next = pick(LOCATIONS); } while (next.name === target.name); target = next; }
        console.log(`[${ts()}]    → heading to ${target.name}`);
      }
    } else {
      let next;
      do { next = pick(LOCATIONS); } while (next.name === target.name);
      target = next;
      console.log(`[${ts()}]    → heading to ${target.name}`);
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
  console.log(`  AI:       ${USE_AI ? '✅ Claude (Anthropic)' : '❌ Random (no API key)'}`);

  const balance = ethers.formatEther(await provider.getBalance(wallet.address));
  agentBalance = parseFloat(balance).toFixed(4);
  console.log(`  Balance:  ${agentBalance} MON`);
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
