#!/usr/bin/env npx tsx
/**
 * AutoMon Demo Agent
 * 
 * A lightweight agent that connects directly to MongoDB and wanders the world,
 * logging actions and updating positions. No wallet/auth required.
 * Perfect for populating the dashboard with live activity.
 * 
 * Usage:
 *   npm run agent:demo                          # one agent (Wanderer)
 *   npm run agent:demo -- --name Astra          # custom name
 *   npm run agent:demo -- --all                 # spawn 3 agents
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { MongoClient, Db } from 'mongodb';
import crypto from 'crypto';

// ─── Config ────────────────────────────────────────────────────────────────────

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.MONGODB_DB || 'automon';

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

const ACTIONS = [
  { action: 'exploring', reasons: ['Searching for wild AutoMon', 'Scouting the area', 'Looking for rare spawns', 'Investigating strange energy readings'] },
  { action: 'training', reasons: ['Grinding XP for the team', 'Practicing type matchups', 'Building team synergy', 'Perfecting combo strategies'] },
  { action: 'resting', reasons: ['Team needs to recover', 'Taking a breather', 'Healing up at the campsite', 'Waiting for nightfall'] },
  { action: 'battling', reasons: ['Challenged a wild AutoMon!', 'Spotted a rival trainer', 'Arena match started', 'Defending territory'] },
  { action: 'trading', reasons: ['Looking for good deals', 'Swapping duplicate cards', 'Negotiating a rare trade', 'Checking the marketplace'] },
  { action: 'catching', reasons: ['Found a rare spawn!', 'Attempting capture', 'Setting up a lure', 'Tracking footprints'] },
  { action: 'traveling', reasons: ['Heading to a new zone', 'Following a quest marker', 'Shortcut through the mountains', 'Moving to better hunting grounds'] },
];

const PERSONALITIES = ['aggressive', 'defensive', 'balanced', 'unpredictable'];

interface AgentState {
  address: string;
  name: string;
  personality: string;
  position: { x: number; y: number; z: number };
  targetLocation: number;
  moveSpeed: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function randomAddress(): string {
  return '0x' + crypto.randomBytes(20).toString('hex');
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(t, 1);
}

function distance(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
}

function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

// ─── Agent Logic ───────────────────────────────────────────────────────────────

function createAgent(name: string): AgentState {
  const startLoc = pick(LOCATIONS);
  return {
    address: randomAddress(),
    name,
    personality: pick(PERSONALITIES),
    position: { x: startLoc.x, y: 0, z: startLoc.z },
    targetLocation: LOCATIONS.indexOf(startLoc),
    moveSpeed: 1 + Math.random() * 2,
  };
}

async function registerAgent(db: Db, agent: AgentState): Promise<void> {
  await db.collection('agents').updateOne(
    { address: agent.address },
    {
      $set: {
        address: agent.address,
        name: agent.name,
        personality: agent.personality,
        isAI: true,
        position: agent.position,
        lastSeen: new Date(),
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
  console.log(`[${timestamp()}] ✅ ${agent.name} registered (${agent.address.slice(0, 10)}…)`);
}

async function tick(db: Db, agent: AgentState): Promise<void> {
  const target = LOCATIONS[agent.targetLocation];
  const dist = distance(agent.position, target);

  // Move toward target
  if (dist > 2) {
    const step = agent.moveSpeed / dist;
    agent.position.x = lerp(agent.position.x, target.x, step);
    agent.position.z = lerp(agent.position.z, target.z, step);
  } else {
    // Arrived — do something, then pick a new target
    const event = pick(ACTIONS);
    const reason = pick(event.reasons);

    await db.collection('agent_actions').insertOne({
      address: agent.address,
      action: event.action,
      reason,
      location: target.name,
      timestamp: new Date(),
    });

    console.log(`[${timestamp()}] 🤖 ${agent.name} @ ${target.name}: ${event.action} — "${reason}"`);

    // Pick new destination (different from current)
    let next: number;
    do {
      next = Math.floor(Math.random() * LOCATIONS.length);
    } while (next === agent.targetLocation);
    agent.targetLocation = next;

    const newTarget = LOCATIONS[next];
    console.log(`[${timestamp()}]    → heading to ${newTarget.name}`);
  }

  // Update position + heartbeat
  await db.collection('agents').updateOne(
    { address: agent.address },
    { $set: { position: agent.position, lastSeen: new Date() } },
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not set in .env.local');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const spawnAll = args.includes('--all');
  const nameIdx = args.indexOf('--name');
  const customName = nameIdx !== -1 ? args[nameIdx + 1] : null;

  const names = spawnAll
    ? ['Astra ⚡', 'Bram 🔥', 'Cyra 🌊']
    : [customName || 'Wanderer 🤖'];

  console.log(`
╔══════════════════════════════════════╗
║       AutoMon Demo Agent             ║
║       Connecting to MongoDB…         ║
╚══════════════════════════════════════╝
`);

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  console.log(`[${timestamp()}] 📡 Connected to MongoDB (${DB_NAME})`);

  const agents = names.map(n => createAgent(n));

  // Register all
  for (const agent of agents) {
    await registerAgent(db, agent);
  }

  console.log(`[${timestamp()}] 🚀 ${agents.length} agent(s) running. Press Ctrl+C to stop.\n`);

  // Tick loop — every 3 seconds per agent
  const TICK_MS = 3000;

  const loop = setInterval(async () => {
    for (const agent of agents) {
      try {
        await tick(db, agent);
      } catch (err) {
        console.error(`[${timestamp()}] ⚠ ${agent.name} error:`, err);
      }
    }
  }, TICK_MS);

  // Graceful shutdown
  const shutdown = async () => {
    console.log(`\n[${timestamp()}] 👋 Shutting down…`);
    clearInterval(loop);

    // Mark agents as offline
    for (const agent of agents) {
      await db.collection('agents').updateOne(
        { address: agent.address },
        { $set: { lastSeen: new Date(0) } },
      );
    }

    await client.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
