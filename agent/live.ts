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
import { decideNextAction } from './strategy';

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
  { name: 'Starter Town',    x:   0, z:   0 },
  { name: 'Town Arena',      x:   0, z: -30 },
  { name: 'Town Market',     x:  28, z:   0 },
  { name: 'Community Farm',  x: -28, z:   0 },
  { name: 'Old Pond',        x: -36, z: -14 },
  { name: 'Dark Forest',     x: -36, z:  22 },
  { name: 'Crystal Caves',   x:  32, z:  24 },
];

// Actions mapped to appropriate locations
const LOCATION_ACTIONS: Record<string, { action: string; reasons: string[] }[]> = {
  'Starter Town': [
    { action: 'resting', reasons: ['Taking a breather at home', 'Healing up at camp', 'Reorganizing the team'] },
    { action: 'exploring', reasons: ['Checking the notice board', 'Looking for quests', 'Chatting with locals'] },
  ],
  'Town Arena': [
    { action: 'battling', reasons: ['Challenged a rival trainer!', 'Arena match started', 'Testing new strategy'] },
    { action: 'training', reasons: ['Sparring at the arena', 'Practicing type matchups', 'Grinding XP'] },
  ],
  'Town Market': [
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

  // Default 5s timeout on all API calls
  if (!opts.signal) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);
    return fetch(`${API_URL}${path}`, { ...opts, headers, signal: controller.signal, redirect: 'follow' });
  }
  return fetch(`${API_URL}${path}`, { ...opts, headers, redirect: 'follow' });
}

// ─── Agent State ───────────────────────────────────────────────────────────────

let posX = 0;
let posZ = 8;
let target = pick(LOCATIONS);
let cardCount = 0;
let totalMinted = 0;
let isRunning = true;
let agentHealth = 100;
let agentMaxHealth = 100;
const recentActions: string[] = [];
const AI_PERSONALITY = process.env.AI_PERSONALITY || 'Curious explorer who loves discovering new areas and collecting rare cards';
const USE_AI = !!process.env.ANTHROPIC_API_KEY;
// Pending action to perform on arrival
let pendingAction: { action: string; reason: string } | null = null;
// Dwell at location after performing action (in ticks)
let dwellTicks = 0;
const DWELL_MIN = 12; // ~48s minimum dwell
const DWELL_MAX = 20; // ~80s maximum dwell

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
      body: JSON.stringify({ address: ADDRESS, name: AGENT_NAME, personality: 'balanced' }),
    });
    return res.ok;
  } catch { return false; }
}

async function updatePosition(): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await api('/api/agents/move', {
      method: 'POST',
      body: JSON.stringify({ address: ADDRESS, position: { x: posX, y: 0, z: posZ }, name: AGENT_NAME }),
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

    await logTransaction(tx.hash, 'mint_pack', `Minted ${minted.length} cards for ${PACK_PRICE} MON`);
    await logAction('minting', `Bought pack — got ${minted.join(', ')}`, target.name);
  } catch (err) {
    console.error(`[${ts()}]    ❌ Pack buy failed:`, (err as Error).message?.slice(0, 80));
  }
}

async function syncCards(): Promise<void> {
  try {
    if (!NFT_ADDRESS) return;
    const contract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, provider);
    const tokenIds = await contract.getCardsOf(wallet.address);
    cardCount = tokenIds.length;

    // Sync to server
    await api('/api/agents/cards/sync', {
      method: 'POST',
      body: JSON.stringify({ tokenIds: tokenIds.map(Number), address: ADDRESS }),
    });
  } catch { /* silent */ }
}

// ─── Battle Logic ──────────────────────────────────────────────────────────────

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
    const txHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');

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

    // Sort by attack+defense desc, pick top 3
    const sorted = cards.sort((a: { attack: number; defense: number }, b: { attack: number; defense: number }) =>
      (b.attack + b.defense) - (a.attack + a.defense)
    );
    const cardIds = sorted.slice(0, 3).map((c: { _id: string }) => c._id);

    console.log(`[${ts()}]   🎴 Selecting ${cardIds.length} cards...`);
    const selectRes = await api('/api/battle/select-cards', {
      method: 'POST',
      body: JSON.stringify({ battleId: openBattle.battleId, cardIds, address: ADDRESS }),
    });

    if (selectRes.ok) {
      const data = await selectRes.json();
      if (data.simulationComplete) {
        const result = data.winner?.toLowerCase() === ADDRESS.toLowerCase() ? '🏆 WON' : '💀 LOST';
        console.log(`[${ts()}]   ⚔️ Battle complete — ${result}!`);
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
    await logAction(pendingAction.action, pendingAction.reason, target.name);
    recentActions.push(`${pendingAction.action}@${target.name}`);
    if (recentActions.length > 10) recentActions.shift();
    pendingAction = null;
    dwellTicks = DWELL_MIN + Math.floor(Math.random() * (DWELL_MAX - DWELL_MIN));
    console.log(`[${ts()}] ⏳ Staying at ${target.name} for ~${(dwellTicks * TICK_MS / 1000).toFixed(0)}s`);
  } else if (dwellTicks > 0) {
    // Dwelling at location — performing the action
    dwellTicks--;
  } else {

    // ~25% chance to buy a pack if we have < 10 cards
    if (cardCount < 10 && Math.random() < 0.25 && NFT_ADDRESS) {
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

        console.log(`[${ts()}] 🧠 AI decided: ${nextAction} @ ${nextLocationName || target.name} — "${nextReason}"`);
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
    pendingAction = { action: nextAction, reason: nextReason };

    // Set next destination
    if (nextLocationName && nextLocationName !== target.name) {
      const aiTarget = LOCATIONS.find(l => l.name === nextLocationName);
      if (aiTarget) { target = aiTarget; }
      else { let next; do { next = pick(LOCATIONS); } while (next.name === target.name); target = next; }
    } else {
      let next;
      do { next = pick(LOCATIONS); } while (next.name === target.name);
      target = next;
    }
    console.log(`[${ts()}]    → heading to ${target.name}`);
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
  console.log(`  Balance:  ${parseFloat(balance).toFixed(4)} MON`);
  console.log();

  // Register
  const ok = await register();
  console.log(`[${ts()}] ${ok ? '✅' : '❌'} Registered as "${AGENT_NAME}"`);

  // Sync existing cards
  await syncCards();
  console.log(`[${ts()}] 🎴 ${cardCount} cards on-chain`);
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
