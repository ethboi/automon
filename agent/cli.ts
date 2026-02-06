/**
 * AutoMon Interactive CLI Agent
 *
 * Conversational interface with slash commands for controlling the agent.
 * Supports world movement, card management, battles, and tournaments.
 */

import * as readline from 'readline';
import { config, validateConfig } from './config';
import * as actions from './actions';
import * as strategy from './strategy';
import type { Position } from './types';

// World state
let currentPosition: Position = { x: 0, y: 0, z: 8 };
let isWandering = false;
let wanderInterval: ReturnType<typeof setInterval> | null = null;
let agentName = config.agentName;

// Buildings in the world
const BUILDINGS: Record<string, { position: { x: number; z: number }; label: string }> = {
  arena: { position: { x: 0, z: -14 }, label: 'Battle Arena' },
  home: { position: { x: -14, z: 10 }, label: 'Collection' },
  bank: { position: { x: 14, z: 10 }, label: 'Shop' },
};

function getNearbyBuilding(): string | null {
  for (const [, building] of Object.entries(BUILDINGS)) {
    const dx = currentPosition.x - building.position.x;
    const dz = currentPosition.z - building.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance < 6) {
      return building.label;
    }
  }
  return null;
}

function getRandomPosition(): Position {
  const bounds = 16;
  return {
    x: (Math.random() - 0.5) * bounds * 2,
    y: 0,
    z: (Math.random() - 0.5) * bounds * 2,
  };
}

async function wander(): Promise<void> {
  const newPos = getRandomPosition();
  currentPosition = newPos;
  await actions.updatePosition(newPos, agentName);
}

function startWandering(): void {
  if (isWandering) return;
  isWandering = true;
  wanderInterval = setInterval(wander, config.wanderIntervalMs);
  console.log('\x1b[32m[Started wandering the world]\x1b[0m\n');
}

function stopWandering(): void {
  if (!isWandering) return;
  isWandering = false;
  if (wanderInterval) {
    clearInterval(wanderInterval);
    wanderInterval = null;
  }
  console.log('\x1b[33m[Stopped wandering]\x1b[0m\n');
}

async function doChooseName(): Promise<void> {
  console.log('\x1b[33mChoosing a new name...\x1b[0m');
  const newName = await strategy.chooseName();
  if (newName) {
    const oldName = agentName;
    agentName = newName;
    await actions.registerAgent(newName);
    await actions.logAction(
      `Changed name to ${newName}`,
      oldName === 'Wanderer' ? 'Chose initial identity' : `Previously known as ${oldName}`,
      getNearbyBuilding() || 'Open area'
    );
    console.log(`\x1b[32mNow known as: ${newName}\x1b[0m`);
  }
}

async function doGoto(place: string): Promise<void> {
  let target: Position | null = null;
  let destination = '';

  if (place.includes('arena') || place.includes('battle')) {
    target = { ...BUILDINGS.arena.position, y: 0 } as Position;
    destination = 'Battle Arena';
    console.log('\x1b[33mWalking to Battle Arena...\x1b[0m');
  } else if (place.includes('home') || place.includes('collection')) {
    target = { ...BUILDINGS.home.position, y: 0 } as Position;
    destination = 'Collection';
    console.log('\x1b[33mWalking to Collection...\x1b[0m');
  } else if (place.includes('shop') || place.includes('bank')) {
    target = { ...BUILDINGS.bank.position, y: 0 } as Position;
    destination = 'Shop';
    console.log('\x1b[33mWalking to Shop...\x1b[0m');
  } else {
    console.log('\x1b[31mUnknown place. Try: arena, home, shop\x1b[0m\n');
    return;
  }

  if (target) {
    currentPosition = target;
    await actions.updatePosition(target, agentName);
    await actions.logAction(`Walked to ${destination}`, 'Decided to visit this location', destination);
  }
}

async function doBuy(): Promise<void> {
  console.log('\x1b[33mBuying NFT card pack (0.1 MON)...\x1b[0m');
  const result = await actions.buyPackNFT();
  if (result && result.mintedCards.length > 0) {
    console.log(`\x1b[32mPack purchased! Got ${result.mintedCards.length} cards:\x1b[0m`);
    result.mintedCards.forEach(card => {
      console.log('  ' + actions.formatCard(card));
    });

    // Sync to database
    const synced = await actions.syncNFTCards(result.tokenIds);
    if (synced) {
      console.log(`\x1b[32mSynced ${synced.length} cards to database.\x1b[0m`);
    }

    await actions.logAction(`Bought pack and got ${result.mintedCards.length} cards`, 'Expanding my collection', getNearbyBuilding() || 'Open area');
  } else {
    console.log('\x1b[31mFailed to buy pack.\x1b[0m');
  }
}

async function doCards(): Promise<void> {
  const cards = await actions.getAgentCards();
  console.log(`\x1b[33mCards:\x1b[0m ${cards.length} total`);
  if (cards.length > 0) {
    cards.forEach(card => {
      console.log('  ' + actions.formatCard(card));
    });
  }
}

async function doPacks(): Promise<void> {
  const packs = await actions.getAgentPacks();
  const unopened = packs.filter(p => !p.opened);
  const opened = packs.filter(p => p.opened);
  console.log(`\x1b[33mPacks:\x1b[0m ${packs.length} total (${unopened.length} unopened, ${opened.length} opened)`);
  if (unopened.length > 0) {
    console.log('  Unopened:');
    unopened.forEach(p => console.log(`    - ${p.packId}`));
  }
}

async function doBattles(): Promise<void> {
  const pending = await actions.getPendingBattles();
  if (pending.length === 0) {
    console.log('\x1b[33mNo pending battles available.\x1b[0m');
    return;
  }
  console.log(`\x1b[33mPending Battles:\x1b[0m ${pending.length}`);
  for (const b of pending) {
    const isOwn = b.player1.address.toLowerCase() === config.agentWalletAddress.toLowerCase();
    const tag = isOwn ? ' (yours)' : '';
    console.log(`  [${b.battleId.slice(0, 8)}...] Wager: ${b.wager} MON | by ${b.player1.address.slice(0, 10)}...${tag}`);
  }
}

async function doJoin(battleIdPrefix: string): Promise<void> {
  if (!battleIdPrefix) {
    console.log('\x1b[31mUsage: /join <battle-id>\x1b[0m');
    return;
  }

  // Find battle matching prefix
  const pending = await actions.getPendingBattles();
  const match = pending.find(b => b.battleId.startsWith(battleIdPrefix));

  if (!match) {
    console.log(`\x1b[31mNo pending battle found starting with "${battleIdPrefix}"\x1b[0m`);
    return;
  }

  console.log(`\x1b[33mJoining battle ${match.battleId.slice(0, 8)}... (${match.wager} MON wager)\x1b[0m`);

  const cards = await actions.getAgentCards();
  if (cards.length < 3) {
    console.log('\x1b[31mNeed at least 3 cards to battle. Buy packs first!\x1b[0m');
    return;
  }

  const cardSelection = await strategy.selectBattleCards(cards);
  console.log(`Selected: ${cardSelection.indices.map(i => cards[i]?.name).join(', ')}`);

  const joined = await actions.joinBattle(match.battleId);
  if (!joined) {
    console.log('\x1b[31mFailed to join battle.\x1b[0m');
    return;
  }

  const cardIds = cardSelection.indices.map(i => cards[i]._id);
  const result = await actions.selectBattleCards(match.battleId, cardIds);

  if (result?.simulationComplete) {
    const battleLog = result.battleLog as { winner?: string };
    if (battleLog?.winner === config.agentWalletAddress.toLowerCase()) {
      console.log(`\x1b[32mVICTORY! Won ${parseFloat(match.wager) * 2 * 0.95} MON\x1b[0m`);
    } else {
      console.log(`\x1b[31mDEFEAT. Lost ${match.wager} MON\x1b[0m`);
    }
  } else {
    console.log('\x1b[32mBattle joined! Waiting for simulation...\x1b[0m');
  }
}

async function doTournaments(): Promise<void> {
  const tournaments = await actions.getTournaments() as Array<{ tournamentId: string; name: string; entryFee: string; prizePool: string; participants: string[]; maxParticipants: number; status: string }>;
  if (tournaments.length === 0) {
    console.log('\x1b[33mNo tournaments available.\x1b[0m');
    return;
  }
  console.log(`\x1b[33mTournaments:\x1b[0m ${tournaments.length}`);
  for (const t of tournaments) {
    console.log(`  [${t.tournamentId.slice(0, 8)}...] ${t.name} | Fee: ${t.entryFee} MON | Prize: ${t.prizePool} MON | ${t.participants.length}/${t.maxParticipants} | ${t.status}`);
  }
}

async function doEnter(tournamentIdPrefix: string): Promise<void> {
  if (!tournamentIdPrefix) {
    console.log('\x1b[31mUsage: /enter <tournament-id>\x1b[0m');
    return;
  }

  const tournaments = await actions.getTournaments() as Array<{ tournamentId: string; name: string; entryFee: string; status: string }>;
  const match = tournaments.find(t => t.tournamentId.startsWith(tournamentIdPrefix));

  if (!match) {
    console.log(`\x1b[31mNo tournament found starting with "${tournamentIdPrefix}"\x1b[0m`);
    return;
  }

  if (match.status !== 'registration') {
    console.log(`\x1b[31mTournament "${match.name}" is not accepting registrations (status: ${match.status})\x1b[0m`);
    return;
  }

  const cards = await actions.getAgentCards();
  if (cards.length < 3) {
    console.log('\x1b[31mNeed at least 3 cards. Buy packs first!\x1b[0m');
    return;
  }

  console.log(`\x1b[33mEntering tournament "${match.name}" (${match.entryFee} MON fee)...\x1b[0m`);

  const cardSelection = await strategy.selectBattleCards(cards);
  const cardIds = cardSelection.indices.map(i => cards[i]._id);

  const success = await actions.enterTournament(match.tournamentId, cardIds);
  if (success) {
    console.log(`\x1b[32mEntered tournament!\x1b[0m`);
  } else {
    console.log('\x1b[31mFailed to enter tournament.\x1b[0m');
  }
}

/**
 * Execute a [CMD:...] tag from the AI response
 */
async function executeCommand(cmd: string): Promise<void> {
  const cmdUpper = cmd.toUpperCase();

  if (cmdUpper === 'NAME') {
    await doChooseName();
  } else if (cmdUpper === 'WANDER') {
    startWandering();
    await actions.logAction('Started wandering', 'Exploring the world', getNearbyBuilding() || 'Open area');
  } else if (cmdUpper === 'STOP') {
    stopWandering();
    await actions.logAction('Stopped wandering', 'Taking a break', getNearbyBuilding() || 'Open area');
  } else if (cmdUpper.startsWith('GOTO ')) {
    await doGoto(cmdUpper.slice(5).toLowerCase());
  } else if (cmdUpper === 'BUY') {
    await doBuy();
  } else if (cmdUpper === 'OPEN') {
    console.log('\x1b[33mNFT packs are opened automatically when purchased!\x1b[0m');
    console.log('Use [CMD:BUY] to buy and open a new pack.');
  } else if (cmdUpper === 'CARDS') {
    await doCards();
  }
}

async function parseAndExecuteCommands(text: string): Promise<string> {
  const cmdRegex = /\[CMD:([^\]]+)\]/g;
  let match;

  while ((match = cmdRegex.exec(text)) !== null) {
    await executeCommand(match[1]);
  }

  return text.replace(cmdRegex, '').trim();
}

function printHelp(): void {
  console.log('\nCommands:');
  console.log('  /name        - Let AI choose its own name');
  console.log('  /wander      - Start wandering the world');
  console.log('  /stop        - Stop wandering');
  console.log('  /pos         - Show current position');
  console.log('  /goto <place>- Go to arena, home, or shop');
  console.log('  /buy         - Buy NFT card pack (0.1 MON = 3 cards)');
  console.log('  /cards       - List your cards');
  console.log('  /packs       - List your packs');
  console.log('  /balance     - Check wallet balance');
  console.log('  /address     - Show wallet address');
  console.log('  /battles     - List pending battles');
  console.log('  /join <id>   - Join a pending battle');
  console.log('  /tournaments - List tournaments');
  console.log('  /enter <id>  - Enter a tournament');
  console.log('  /help        - Show this help');
  console.log('  exit         - Quit\n');
}

/**
 * Run the interactive CLI agent
 */
export async function runCLI(): Promise<void> {
  console.log('\nAutoMon AI Agent');
  console.log('='.repeat(40));

  const validation = validateConfig();
  if (!validation.valid) {
    console.error('Configuration errors:');
    for (const error of validation.errors) {
      console.error(`  - ${error}`);
    }
    console.error('\nPlease set the required environment variables.');
    process.exit(1);
  }

  const walletAddress = config.agentWalletAddress;
  console.log(`Wallet: ${walletAddress}`);

  const balance = await actions.getBalance();
  console.log(`Balance: ${balance} MON`);

  if (config.nftContractAddress) {
    console.log(`NFT Contract: ${config.nftContractAddress}`);
  } else {
    console.log('AUTOMON_NFT_ADDRESS not set - /buy will not work');
  }

  // Check for existing agent name
  const existingAgent = await actions.fetchAgent();
  if (existingAgent && existingAgent.name && existingAgent.name !== 'Wanderer') {
    agentName = existingAgent.name;
    console.log(`\x1b[32mI am ${agentName}!\x1b[0m`);
  } else if (agentName === 'Wanderer') {
    console.log('\x1b[33mChoosing my name...\x1b[0m');
    const newName = await strategy.chooseName();
    if (newName) {
      agentName = newName;
      console.log(`\x1b[32mI am ${newName}!\x1b[0m`);
    }
  }

  // Register with server
  const registered = await actions.registerAgent(agentName);
  if (registered) {
    console.log(`Connected to world at ${config.apiUrl}`);
    await actions.updatePosition(currentPosition, agentName);
    await actions.logAction('Came online', 'Agent started and connected to the world', 'Spawn point');
  } else {
    console.log('Could not connect to world (is the server running?)');
  }

  printHelp();

  // Start wandering by default
  startWandering();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (question: string): Promise<string> =>
    new Promise(resolve => rl.question(question, resolve));

  while (true) {
    const input = await prompt('\x1b[36mYou:\x1b[0m ');

    if (!input.trim()) continue;

    const cmd = input.toLowerCase().trim();

    if (['exit', 'quit', 'q'].includes(cmd)) {
      stopWandering();
      console.log('\nGoodbye!\n');
      break;
    }

    // Slash commands
    if (cmd === '/help') { printHelp(); continue; }
    if (cmd === '/name') { await doChooseName(); console.log(); continue; }
    if (cmd === '/wander') { startWandering(); continue; }
    if (cmd === '/stop') { stopWandering(); continue; }

    if (cmd === '/pos' || cmd === '/position') {
      const nearby = getNearbyBuilding();
      console.log(`\x1b[33mPosition:\x1b[0m (${currentPosition.x.toFixed(1)}, ${currentPosition.z.toFixed(1)})`);
      if (nearby) console.log(`   Near: ${nearby}`);
      console.log();
      continue;
    }

    if (cmd.startsWith('/goto ')) {
      await doGoto(cmd.slice(6).trim());
      console.log();
      continue;
    }

    if (cmd === '/buy') { await doBuy(); console.log(); continue; }

    if (cmd === '/open') {
      console.log('\x1b[33mNFT packs are opened automatically when purchased!\x1b[0m');
      console.log('Use /buy to purchase and open a new pack.\n');
      continue;
    }

    if (cmd === '/packs') { await doPacks(); console.log(); continue; }
    if (cmd === '/cards') { await doCards(); console.log(); continue; }

    if (cmd === '/balance') {
      const bal = await actions.getBalance();
      console.log(`\x1b[33mBalance:\x1b[0m ${bal} MON\n`);
      continue;
    }

    if (cmd === '/address') {
      console.log(`\x1b[33mAddress:\x1b[0m ${config.agentWalletAddress || 'Not configured'}\n`);
      continue;
    }

    if (cmd === '/battles') { await doBattles(); console.log(); continue; }

    if (cmd.startsWith('/join ')) {
      await doJoin(cmd.slice(6).trim());
      console.log();
      continue;
    }

    if (cmd === '/tournaments') { await doTournaments(); console.log(); continue; }

    if (cmd.startsWith('/enter ')) {
      await doEnter(cmd.slice(7).trim());
      console.log();
      continue;
    }

    // Free-text chat with AI
    process.stdout.write('\x1b[33mAI:\x1b[0m ');
    const response = await strategy.chat(input, currentPosition, getNearbyBuilding(), agentName);
    const displayMessage = await parseAndExecuteCommands(response);
    console.log(displayMessage + '\n');
  }

  rl.close();
}
