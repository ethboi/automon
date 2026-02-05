#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const Anthropic = require('@anthropic-ai/sdk').default;
const { ethers } = require('ethers');
const readline = require('readline');

// Config
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003';
const RPC_URL = process.env.NEXT_PUBLIC_MONAD_RPC || 'https://testnet-rpc.monad.xyz';
const provider = new ethers.JsonRpcProvider(RPC_URL);

// Wallet setup
let wallet = null;
let walletAddress = null;

if (process.env.AGENT_PRIVATE_KEY) {
  wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);
  walletAddress = wallet.address;
}

// World state
let currentPosition = { x: 0, y: 0, z: 8 };
let isWandering = false;
let wanderInterval = null;
let agentName = process.env.AGENT_NAME || 'Wanderer';

// Buildings in the world
const BUILDINGS = {
  arena: { position: { x: 0, z: -14 }, label: 'Battle Arena' },
  home: { position: { x: -14, z: 10 }, label: 'Collection' },
  bank: { position: { x: 14, z: 10 }, label: 'Shop' },
};

// Anthropic setup
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are an AutoMon AI agent - an autonomous character in the AutoMon Pokemon-style battling game on Monad blockchain.

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

const conversationHistory = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function getBalance() {
  if (!wallet) return 'Wallet not configured';
  try {
    const balance = await provider.getBalance(walletAddress);
    return `${ethers.formatEther(balance)} MON`;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

async function registerAgent() {
  if (!walletAddress) return false;
  try {
    const res = await fetch(`${APP_URL}/api/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: walletAddress,
        name: agentName,
        personality: 'curious',
      }),
    });
    return res.ok;
  } catch (error) {
    console.error('Failed to register:', error.message);
    return false;
  }
}

async function chooseName() {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: 'You are an AI agent in a Pokemon-style game called AutoMon. Choose a creative, fun name for yourself (just the name, nothing else). Keep it short (1-2 words max).',
      }],
    });

    const newName = response.content[0].text.trim().replace(/['"]/g, '');
    agentName = newName;

    // Re-register with new name
    await registerAgent();

    return newName;
  } catch (error) {
    console.error('Error choosing name:', error.message);
    return null;
  }
}

async function updatePosition(pos) {
  if (!walletAddress) return;
  currentPosition = pos;
  try {
    await fetch(`${APP_URL}/api/agents/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: walletAddress,
        position: pos,
      }),
    });
  } catch (error) {
    // Silently fail position updates
  }
}

function getRandomPosition() {
  const bounds = 16;
  return {
    x: (Math.random() - 0.5) * bounds * 2,
    y: 0,
    z: (Math.random() - 0.5) * bounds * 2,
  };
}

function getNearbyBuilding() {
  for (const [key, building] of Object.entries(BUILDINGS)) {
    const dx = currentPosition.x - building.position.x;
    const dz = currentPosition.z - building.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance < 6) {
      return building.label;
    }
  }
  return null;
}

async function wander() {
  const newPos = getRandomPosition();
  await updatePosition(newPos);
  // Silent wandering - no console spam
}

function startWandering() {
  if (isWandering) return;
  isWandering = true;
  wanderInterval = setInterval(wander, 3000); // Move every 3 seconds
  console.log('\x1b[32m[Started wandering the world]\x1b[0m\n');
}

function stopWandering() {
  if (!isWandering) return;
  isWandering = false;
  if (wanderInterval) {
    clearInterval(wanderInterval);
    wanderInterval = null;
  }
  console.log('\x1b[33m[Stopped wandering]\x1b[0m\n');
}

async function executeCommand(cmd) {
  const cmdUpper = cmd.toUpperCase();

  if (cmdUpper === 'NAME') {
    console.log('\x1b[33m🤔 Choosing a new name...\x1b[0m');
    const newName = await chooseName();
    if (newName) {
      console.log(`\x1b[32m✨ Now known as: ${newName}\x1b[0m`);
    }
  } else if (cmdUpper === 'WANDER') {
    startWandering();
  } else if (cmdUpper === 'STOP') {
    stopWandering();
  } else if (cmdUpper.startsWith('GOTO ')) {
    const place = cmdUpper.slice(5).toLowerCase();
    let target = null;

    if (place.includes('arena') || place.includes('battle')) {
      target = { ...BUILDINGS.arena.position, y: 0 };
      console.log('\x1b[33m🚶 Walking to Battle Arena...\x1b[0m');
    } else if (place.includes('home') || place.includes('collection')) {
      target = { ...BUILDINGS.home.position, y: 0 };
      console.log('\x1b[33m🚶 Walking to Collection...\x1b[0m');
    } else if (place.includes('shop') || place.includes('bank')) {
      target = { ...BUILDINGS.bank.position, y: 0 };
      console.log('\x1b[33m🚶 Walking to Shop...\x1b[0m');
    }

    if (target) {
      await updatePosition(target);
    }
  }
}

function parseAndExecuteCommands(text) {
  const cmdRegex = /\[CMD:([^\]]+)\]/g;
  let match;

  while ((match = cmdRegex.exec(text)) !== null) {
    executeCommand(match[1]);
  }

  // Return text without command tags for display
  return text.replace(cmdRegex, '').trim();
}

async function chat(userMessage) {
  const contextMessage = `[Current position: (${currentPosition.x.toFixed(1)}, ${currentPosition.z.toFixed(1)}) | Nearby: ${getNearbyBuilding() || 'open area'} | Name: ${agentName}]\n\nUser: ${userMessage}`;

  conversationHistory.push({
    role: 'user',
    content: contextMessage,
  });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: conversationHistory,
    });

    const assistantMessage = response.content[0].text;
    conversationHistory.push({
      role: 'assistant',
      content: assistantMessage,
    });

    // Parse and execute any commands in the response
    const displayMessage = parseAndExecuteCommands(assistantMessage);

    return displayMessage;
  } catch (error) {
    console.error('Error:', error.message);
    conversationHistory.pop();
    return 'Sorry, I encountered an error. Please try again.';
  }
}

async function main() {
  console.log('\n🤖 AutoMon AI Agent');
  console.log('═══════════════════════════════════════');

  if (walletAddress) {
    console.log(`🔑 Wallet: ${walletAddress}`);
    const balance = await getBalance();
    console.log(`💰 Balance: ${balance}`);

    // Register with the game world
    const registered = await registerAgent();
    if (registered) {
      console.log(`🌍 Connected to world at ${APP_URL}`);
      await updatePosition(currentPosition);
    } else {
      console.log(`⚠️  Could not connect to world (is the server running?)`);
    }
  } else {
    console.log('⚠️  No wallet configured. Add AGENT_PRIVATE_KEY to .env.local');
  }

  console.log('\nCommands:');
  console.log('  /name     - Let AI choose its own name');
  console.log('  /wander   - Start wandering the world');
  console.log('  /stop     - Stop wandering');
  console.log('  /pos      - Show current position');
  console.log('  /goto <place> - Go to arena, home, or shop');
  console.log('  /balance  - Check wallet balance');
  console.log('  /address  - Show wallet address');
  console.log('  exit      - Quit\n');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY not found in .env.local');
    process.exit(1);
  }

  // Auto-choose name if using default
  if (walletAddress && agentName === 'Wanderer') {
    console.log('\x1b[33m🤔 Choosing my name...\x1b[0m');
    const newName = await chooseName();
    if (newName) {
      console.log(`\x1b[32m✨ I am ${newName}!\x1b[0m\n`);
    }
  }

  // Start wandering by default
  if (walletAddress) {
    startWandering();
  }

  while (true) {
    const input = await prompt('\x1b[36mYou:\x1b[0m ');

    if (!input.trim()) continue;

    const cmd = input.toLowerCase().trim();

    if (['exit', 'quit', 'q'].includes(cmd)) {
      stopWandering();
      console.log('\nGoodbye! 👋\n');
      break;
    }

    if (cmd === '/name') {
      console.log('\x1b[33m🤔 Thinking of a name...\x1b[0m');
      const newName = await chooseName();
      if (newName) {
        console.log(`\x1b[32m✨ I shall be called: ${newName}\x1b[0m\n`);
      } else {
        console.log('\x1b[31mCouldn\'t choose a name right now.\x1b[0m\n');
      }
      continue;
    }

    if (cmd === '/wander') {
      startWandering();
      continue;
    }

    if (cmd === '/stop') {
      stopWandering();
      continue;
    }

    if (cmd === '/pos' || cmd === '/position') {
      const nearby = getNearbyBuilding();
      console.log(`\x1b[33m📍 Position:\x1b[0m (${currentPosition.x.toFixed(1)}, ${currentPosition.z.toFixed(1)})`);
      if (nearby) console.log(`   Near: ${nearby}`);
      console.log();
      continue;
    }

    if (cmd.startsWith('/goto ')) {
      const place = cmd.slice(6).trim();
      let target = null;

      if (place.includes('arena') || place.includes('battle')) {
        target = { ...BUILDINGS.arena.position, y: 0 };
        console.log('\x1b[33m🚶 Walking to Battle Arena...\x1b[0m\n');
      } else if (place.includes('home') || place.includes('collection')) {
        target = { ...BUILDINGS.home.position, y: 0 };
        console.log('\x1b[33m🚶 Walking to Collection...\x1b[0m\n');
      } else if (place.includes('shop') || place.includes('bank')) {
        target = { ...BUILDINGS.bank.position, y: 0 };
        console.log('\x1b[33m🚶 Walking to Shop...\x1b[0m\n');
      } else {
        console.log('\x1b[31mUnknown place. Try: arena, home, shop\x1b[0m\n');
        continue;
      }

      if (target) {
        await updatePosition(target);
      }
      continue;
    }

    if (cmd === '/balance') {
      const balance = await getBalance();
      console.log(`\x1b[33m💰 Balance:\x1b[0m ${balance}\n`);
      continue;
    }

    if (cmd === '/address') {
      console.log(`\x1b[33m🔑 Address:\x1b[0m ${walletAddress || 'Not configured'}\n`);
      continue;
    }

    process.stdout.write('\x1b[33mAI:\x1b[0m ');
    const response = await chat(input);
    console.log(response + '\n');
  }

  rl.close();
}

main();
