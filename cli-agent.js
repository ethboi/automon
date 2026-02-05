#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const Anthropic = require('@anthropic-ai/sdk').default;
const { ethers } = require('ethers');
const readline = require('readline');

// Config
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003';
const RPC_URL = process.env.MONAD_RPC_URL || process.env.NEXT_PUBLIC_MONAD_RPC || 'https://testnet-rpc.monad.xyz';
const NFT_CONTRACT_ADDRESS = process.env.AUTOMON_NFT_ADDRESS;
const provider = new ethers.JsonRpcProvider(RPC_URL);

// NFT Contract ABI
const NFT_ABI = [
  'function buyPack() external payable',
  'function getCard(uint256 tokenId) view returns (uint8 automonId, uint8 rarity)',
  'function getCardsOf(address owner) view returns (uint256[])',
  'function balanceOf(address owner) view returns (uint256)',
  'event CardMinted(uint256 indexed tokenId, uint8 automonId, uint8 rarity)',
];

// AutoMon names lookup
const AUTOMON_NAMES = {
  1: 'Blazeon', 2: 'Emberwing', 3: 'Magmor', 4: 'Cindercat',
  5: 'Aquaris', 6: 'Tidalon', 7: 'Coralix', 8: 'Frostfin',
  9: 'Terrox', 10: 'Bouldern', 11: 'Crysthorn',
  12: 'Zephyrix', 13: 'Stormwing', 14: 'Gustal',
  15: 'Shadowmere', 16: 'Voidling', 17: 'Noxfang',
  18: 'Luxara', 19: 'Solaris', 20: 'Aurorix',
};

const AUTOMON_ELEMENTS = {
  1: 'fire', 2: 'fire', 3: 'fire', 4: 'fire',
  5: 'water', 6: 'water', 7: 'water', 8: 'water',
  9: 'earth', 10: 'earth', 11: 'earth',
  12: 'air', 13: 'air', 14: 'air',
  15: 'dark', 16: 'dark', 17: 'dark',
  18: 'light', 19: 'light', 20: 'light',
};

const RARITY_NAMES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

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

async function buyPack() {
  if (!wallet || !NFT_CONTRACT_ADDRESS) {
    console.error('Wallet or NFT contract not configured');
    return null;
  }
  try {
    const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, wallet);
    const packPrice = ethers.parseEther('0.1');

    console.log('  Sending transaction...');
    const tx = await contract.buyPack({ value: packPrice });
    console.log(`  TX: ${tx.hash.slice(0, 10)}...`);

    const receipt = await tx.wait();
    console.log(`  Confirmed in block ${receipt.blockNumber}`);

    // Parse minted cards from events
    const mintedCards = [];
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
        if (parsed?.name === 'CardMinted') {
          const tokenId = Number(parsed.args[0]);
          const automonId = Number(parsed.args[1]);
          const rarity = Number(parsed.args[2]);
          mintedCards.push({
            tokenId,
            name: AUTOMON_NAMES[automonId] || `AutoMon #${automonId}`,
            element: AUTOMON_ELEMENTS[automonId] || 'unknown',
            rarity: RARITY_NAMES[rarity] || 'common',
          });
        }
      } catch {}
    }

    // Sync to database
    if (mintedCards.length > 0) {
      const tokenIds = mintedCards.map(c => c.tokenId);
      await fetch(`${APP_URL}/api/agents/cards/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenIds, address: walletAddress }),
      });
    }

    return { packId: tx.hash, cards: mintedCards, txHash: tx.hash };
  } catch (error) {
    console.error('Buy pack error:', error.message);
    return null;
  }
}

async function openPack(packId = null) {
  if (!walletAddress) return null;
  try {
    const res = await fetch(`${APP_URL}/api/agents/packs/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: walletAddress, packId }),
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
    const error = await res.json();
    console.error('Open pack failed:', error.error);
    return null;
  } catch (error) {
    console.error('Open pack error:', error.message);
    return null;
  }
}

async function listPacks() {
  if (!walletAddress) return [];
  try {
    const res = await fetch(`${APP_URL}/api/agents/packs?address=${walletAddress}`);
    if (res.ok) {
      const data = await res.json();
      return data.packs || [];
    }
    return [];
  } catch (error) {
    console.error('List packs error:', error.message);
    return [];
  }
}

async function listCards() {
  if (!walletAddress) return [];
  try {
    const res = await fetch(`${APP_URL}/api/agents/cards?address=${walletAddress}`);
    if (res.ok) {
      const data = await res.json();
      return data.cards || [];
    }
    return [];
  } catch (error) {
    console.error('List cards error:', error.message);
    return [];
  }
}

function formatCard(card) {
  const rarityColors = {
    common: '\x1b[37m',      // white
    uncommon: '\x1b[32m',    // green
    rare: '\x1b[34m',        // blue
    epic: '\x1b[35m',        // purple
    legendary: '\x1b[33m',   // yellow
  };
  const color = rarityColors[card.rarity] || '\x1b[37m';
  const reset = '\x1b[0m';

  // Handle both NFT cards (no stats) and DB cards (with stats)
  if (card.stats) {
    return `${color}[${card.rarity.toUpperCase()}]${reset} ${card.name} (${card.element}) - ATK:${card.stats.attack} DEF:${card.stats.defense} SPD:${card.stats.speed} HP:${card.stats.hp}`;
  } else {
    // NFT card from purchase (minimal info)
    const tokenInfo = card.tokenId ? ` #${card.tokenId}` : '';
    return `${color}[${card.rarity.toUpperCase()}]${reset} ${card.name}${tokenInfo} (${card.element})`;
  }
}

async function fetchExistingAgent() {
  if (!walletAddress) return null;
  try {
    const res = await fetch(`${APP_URL}/api/agents/${walletAddress}`);
    if (res.ok) {
      const data = await res.json();
      return data.agent;
    }
  } catch (error) {
    // Agent doesn't exist yet
  }
  return null;
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
    const oldName = agentName;
    agentName = newName;

    // Re-register with new name
    await registerAgent();

    // Log the name change
    await logAction(
      `Changed name to ${newName}`,
      oldName === 'Wanderer' ? 'Chose initial identity' : `Previously known as ${oldName}`,
      getNearbyBuilding() || 'Open area'
    );

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
        name: agentName, // Also send name to keep it synced
      }),
    });
  } catch (error) {
    // Silently fail position updates
  }
}

async function logAction(action, reason, location) {
  if (!walletAddress) return;
  try {
    await fetch(`${APP_URL}/api/agents/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: walletAddress,
        action,
        reason,
        location,
      }),
    });
  } catch (error) {
    // Silently fail action logs
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
    await logAction('Started wandering', 'Exploring the world', getNearbyBuilding() || 'Open area');
  } else if (cmdUpper === 'STOP') {
    stopWandering();
    await logAction('Stopped wandering', 'Taking a break', getNearbyBuilding() || 'Open area');
  } else if (cmdUpper.startsWith('GOTO ')) {
    const place = cmdUpper.slice(5).toLowerCase();
    let target = null;
    let destination = '';

    if (place.includes('arena') || place.includes('battle')) {
      target = { ...BUILDINGS.arena.position, y: 0 };
      destination = 'Battle Arena';
      console.log('\x1b[33m🚶 Walking to Battle Arena...\x1b[0m');
    } else if (place.includes('home') || place.includes('collection')) {
      target = { ...BUILDINGS.home.position, y: 0 };
      destination = 'Collection';
      console.log('\x1b[33m🚶 Walking to Collection...\x1b[0m');
    } else if (place.includes('shop') || place.includes('bank')) {
      target = { ...BUILDINGS.bank.position, y: 0 };
      destination = 'Shop';
      console.log('\x1b[33m🚶 Walking to Shop...\x1b[0m');
    }

    if (target) {
      await updatePosition(target);
      await logAction(`Walked to ${destination}`, 'Decided to visit this location', destination);
    }
  } else if (cmdUpper === 'BUY') {
    console.log('\x1b[33m🛒 Buying a card pack (0.1 MON)...\x1b[0m');
    const result = await buyPack();
    if (result && result.cards) {
      console.log(`\x1b[32m✨ Pack purchased! Got ${result.cards.length} cards:\x1b[0m`);
      result.cards.forEach(card => {
        console.log('  ' + formatCard(card));
      });
      await logAction(`Bought pack and got ${result.cards.length} cards`, 'Expanding my collection', getNearbyBuilding() || 'Open area');
    }
  } else if (cmdUpper === 'OPEN') {
    // NFT packs are opened immediately on purchase
    console.log('\x1b[33mℹ️  NFT packs are opened automatically when purchased!\x1b[0m');
    console.log('Use [CMD:BUY] to buy and open a new pack.');
  } else if (cmdUpper === 'CARDS') {
    const cards = await listCards();
    console.log(`\x1b[33m🎴 I have ${cards.length} cards:\x1b[0m`);
    if (cards.length > 0) {
      cards.slice(0, 10).forEach(card => {
        console.log('  ' + formatCard(card));
      });
      if (cards.length > 10) {
        console.log(`  ... and ${cards.length - 10} more`);
      }
    }
  }
}

async function parseAndExecuteCommands(text) {
  const cmdRegex = /\[CMD:([^\]]+)\]/g;
  let match;

  while ((match = cmdRegex.exec(text)) !== null) {
    await executeCommand(match[1]);
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
    const displayMessage = await parseAndExecuteCommands(assistantMessage);

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

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY not found in .env.local');
    process.exit(1);
  }

  if (walletAddress) {
    console.log(`🔑 Wallet: ${walletAddress}`);
    const balance = await getBalance();
    console.log(`💰 Balance: ${balance}`);
    if (NFT_CONTRACT_ADDRESS) {
      console.log(`📜 NFT Contract: ${NFT_CONTRACT_ADDRESS}`);
    } else {
      console.log('⚠️  AUTOMON_NFT_ADDRESS not set - /buy will not work');
    }

    // First, check if agent already exists with a name
    const existingAgent = await fetchExistingAgent();
    if (existingAgent && existingAgent.name && existingAgent.name !== 'Wanderer') {
      agentName = existingAgent.name;
      console.log(`\x1b[32m✨ I am ${agentName}!\x1b[0m`);
    } else if (agentName === 'Wanderer') {
      // Only choose a new name if no existing name found
      console.log('\x1b[33m🤔 Choosing my name...\x1b[0m');
      const newName = await chooseName();
      if (newName) {
        console.log(`\x1b[32m✨ I am ${newName}!\x1b[0m`);
      }
    }

    // Now register with the correct name
    const registered = await registerAgent();
    if (registered) {
      console.log(`🌍 Connected to world at ${APP_URL}`);
      await updatePosition(currentPosition);
      await logAction('Came online', 'Agent started and connected to the world', 'Spawn point');
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
  console.log('  /buy      - Buy NFT card pack (0.1 MON = 3 cards)');
  console.log('  /cards    - List your cards');
  console.log('  /balance  - Check wallet balance');
  console.log('  /address  - Show wallet address');
  console.log('  exit      - Quit\n');

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

    if (cmd === '/buy') {
      console.log('\x1b[33m🛒 Buying NFT card pack (0.1 MON)...\x1b[0m');
      const result = await buyPack();
      if (result && result.cards) {
        console.log(`\x1b[32m✨ Pack purchased! Got ${result.cards.length} cards:\x1b[0m`);
        result.cards.forEach(card => {
          console.log('  ' + formatCard(card));
        });
        await logAction(`Bought pack and got ${result.cards.length} cards`, 'Expanding my collection', getNearbyBuilding() || 'Open area');
      } else {
        console.log('\x1b[31mFailed to buy pack.\x1b[0m');
      }
      console.log();
      continue;
    }

    if (cmd === '/open') {
      // NFT packs open automatically on purchase
      console.log('\x1b[33mℹ️  NFT packs are opened automatically when purchased!\x1b[0m');
      console.log('Use /buy to purchase and open a new pack.\n');
      continue;
    }

    if (cmd === '/packs') {
      const packs = await listPacks();
      const unopened = packs.filter(p => !p.opened);
      const opened = packs.filter(p => p.opened);
      console.log(`\x1b[33m📦 Packs:\x1b[0m ${packs.length} total (${unopened.length} unopened, ${opened.length} opened)`);
      if (unopened.length > 0) {
        console.log('  Unopened:');
        unopened.forEach(p => console.log(`    - ${p.packId}`));
      }
      console.log();
      continue;
    }

    if (cmd === '/cards') {
      const cards = await listCards();
      console.log(`\x1b[33m🎴 Cards:\x1b[0m ${cards.length} total`);
      if (cards.length > 0) {
        cards.forEach(card => {
          console.log('  ' + formatCard(card));
        });
      }
      console.log();
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
