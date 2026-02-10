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

const LOCATIONS = [
  { name: 'Starter Town',    x:   0, z:   0 },
  { name: 'Town Arena',      x:   0, z: -20 },
  { name: 'Town Market',     x:  18, z:   0 },
  { name: 'Community Farm',  x: -18, z:   0 },
  { name: 'Green Meadows',   x: -14, z: -18 },
  { name: 'Old Pond',        x: -22, z: -18 },
  { name: 'Dark Forest',     x: -24, z:  14 },
  { name: 'River Delta',     x:  22, z: -16 },
  { name: 'Crystal Caves',   x:  20, z:  16 },
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
  'Green Meadows': [
    { action: 'catching', reasons: ['Found a rare spawn!', 'Tracking footprints', 'Setting a lure'] },
    { action: 'exploring', reasons: ['Searching for wild AutoMon', 'Scouting the meadows', 'Looking for rare spawns'] },
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
  'River Delta': [
    { action: 'fishing', reasons: ['Fishing at the delta', 'Great spot for water-types', 'River fishing session'] },
    { action: 'exploring', reasons: ['Following the river upstream', 'Checking the delta banks', 'Searching the shallows'] },
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
  return fetch(`${API_URL}${path}`, { ...opts, headers, redirect: 'follow' });
}

// ─── Agent State ───────────────────────────────────────────────────────────────

let posX = 0;
let posZ = 8;
let target = pick(LOCATIONS);
let cardCount = 0;
let totalMinted = 0;
let isRunning = true;

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
      body: JSON.stringify({ address: ADDRESS, action, reason, location }),
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

// ─── Main Loop ─────────────────────────────────────────────────────────────────

async function tick(): Promise<void> {
  const dx = target.x - posX;
  const dz = target.z - posZ;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist > 2) {
    const speed = 5;
    posX += (dx / dist) * speed;
    posZ += (dz / dist) * speed;
    // silently moving
  } else {
    // Arrived — do an action appropriate for this location
    const locationActions = LOCATION_ACTIONS[target.name] || [{ action: 'exploring', reasons: ['Looking around'] }];
    const event = pick(locationActions);
    const reason = pick(event.reasons);

    console.log(`[${ts()}] 📍 ${target.name}: ${event.action} — "${reason}"`);
    await logAction(event.action, reason, target.name);

    // ~25% chance to buy a pack if we have < 10 cards
    if (cardCount < 10 && Math.random() < 0.25 && NFT_ADDRESS) {
      await buyPack();
    }

    // Pick new destination (different from current)
    let next;
    do { next = pick(LOCATIONS); } while (next.name === target.name);
    target = next;
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
