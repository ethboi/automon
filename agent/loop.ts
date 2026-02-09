/**
 * AutoMon Autonomous Agent Loop
 *
 * Runs the autonomous decision loop: buy packs, join battles, enter tournaments.
 */

import { config, validateConfig, logConfig } from './config';
import * as actions from './actions';
import * as strategy from './strategy';

// Agent state
let consecutiveErrors = 0;
let isRunning = true;
let iterationCount = 0;

// Statistics
const stats = {
  packsConsidered: 0,
  packsBought: 0,
  battlesConsidered: 0,
  battlesJoined: 0,
  battlesWon: 0,
  battlesLost: 0,
  tournamentsEntered: 0,
  totalEarnings: 0,
  totalLosses: 0,
};

function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

function log(message: string): void {
  console.log(`[${timestamp()}] ${message}`);
}

function verbose(message: string): void {
  if (config.features.verboseLogging) {
    console.log(`[${timestamp()}] [VERBOSE] ${message}`);
  }
}

function printBanner(): void {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     █████╗ ██╗   ██╗████████╗ ██████╗ ███╗   ███╗ ██████╗ ███╗   ██╗    ║
║    ██╔══██╗██║   ██║╚══██╔══╝██╔═══██╗████╗ ████║██╔═══██╗████╗  ██║    ║
║    ███████║██║   ██║   ██║   ██║   ██║██╔████╔██║██║   ██║██╔██╗ ██║    ║
║    ██╔══██║██║   ██║   ██║   ██║   ██║██║╚██╔╝██║██║   ██║██║╚██╗██║    ║
║    ██║  ██║╚██████╔╝   ██║   ╚██████╔╝██║ ╚═╝ ██║╚██████╔╝██║ ╚████║    ║
║    ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝ ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═══╝    ║
║                                                           ║
║              AUTONOMOUS AGENT v1.0                        ║
║         Powered by Claude AI - Anthropic                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
}

function printStats(): void {
  console.log('\n========================================');
  console.log('AGENT STATISTICS');
  console.log('========================================');
  console.log(`Iterations: ${iterationCount}`);
  console.log(`Packs: ${stats.packsBought}/${stats.packsConsidered} bought`);
  console.log(`Battles: ${stats.battlesJoined}/${stats.battlesConsidered} joined`);
  console.log(`  Won: ${stats.battlesWon} | Lost: ${stats.battlesLost}`);
  console.log(`Tournaments: ${stats.tournamentsEntered} entered`);
  console.log(`Net Earnings: ${(stats.totalEarnings - stats.totalLosses).toFixed(4)} MON`);
  console.log('========================================\n');
}

async function checkAndBuyPacks(): Promise<void> {
  if (!config.features.autoBuyPacks) {
    verbose('Pack buying disabled');
    return;
  }

  const cards = await actions.getAgentCards();
  const balance = await actions.getBalance();

  stats.packsConsidered++;

  const decision = await strategy.decideToBuyPack(balance, cards, config.packPrice);

  if (decision.decision) {
    log(`DECISION: Buy pack (${decision.confidence}% confidence)`);
    log(`REASONING: ${decision.reasoning}`);

    const result = await actions.buyPackNFT();

    if (result) {
      log(`Pack purchased! TX: ${result.txHash.slice(0, 10)}...`);
      log(`Minted token IDs: ${result.tokenIds.join(', ')}`);
      stats.packsBought++;

      const newCards = await actions.syncNFTCards(result.tokenIds);
      if (newCards) {
        log(`Synced ${newCards.length} cards to database:`);
        for (const card of newCards) {
          console.log(`  - ${card.name} (${card.element}, ${card.rarity})`);
        }
      }
    }
  } else {
    verbose(`Pack purchase skipped: ${decision.reasoning}`);
  }
}

async function checkAndCreateBattle(): Promise<void> {
  if (!config.features.autoJoinBattles) {
    verbose('Battle creation disabled');
    return;
  }

  const cards = await actions.getAgentCards();
  if (cards.length < config.minCardsForBattle) {
    verbose('Not enough cards to create a battle');
    return;
  }

  const balance = await actions.getBalance();
  const numericBalance = parseFloat(balance);

  // Pick a wager: small random amount between 0.01 and 0.05 MON
  const wagerOptions = ['0.01', '0.02', '0.03', '0.05'];
  const wager = wagerOptions[Math.floor(Math.random() * wagerOptions.length)];
  const numericWager = parseFloat(wager);

  if (!Number.isFinite(numericBalance) || numericBalance - numericWager < config.minBalanceReserve) {
    verbose('Not enough balance to create a battle');
    return;
  }

  log(`⚔️ Creating battle with ${wager} MON wager...`);
  const battle = await actions.createBattle(wager);

  if (battle) {
    log(`Battle created! ID: ${battle.battleId.slice(0, 8)}... waiting for opponent`);

    // Select cards for our side
    const cardSelection = await strategy.selectBattleCards(cards);
    const cardIds = cardSelection.indices.map(i => cards[i]._id);
    log(`Pre-selected cards: ${cardSelection.indices.map(i => cards[i]?.name).join(', ')}`);

    await actions.selectBattleCards(battle.battleId, cardIds);
  } else {
    log('Failed to create battle');
  }
}

async function checkAndJoinBattles(): Promise<void> {
  if (!config.features.autoJoinBattles) {
    verbose('Battle joining disabled');
    return;
  }

  const pendingBattles = await actions.getPendingBattles();
  const cards = await actions.getAgentCards();
  const balance = await actions.getBalance();

  if (pendingBattles.length === 0) {
    verbose('No pending battles found');
    return;
  }

  log(`Found ${pendingBattles.length} pending battles`);

  for (const battle of pendingBattles) {
    if (battle.player1.address.toLowerCase() === config.agentWalletAddress.toLowerCase()) {
      continue;
    }

    stats.battlesConsidered++;

    // Strong bias to join battles when we have enough cards and safe balance reserve.
    const numericBalance = parseFloat(balance);
    const numericWager = parseFloat(battle.wager);
    const canAfford = Number.isFinite(numericBalance) && Number.isFinite(numericWager)
      && numericWager > 0
      && numericBalance - numericWager >= config.minBalanceReserve;
    const hasMinimumCards = cards.length >= config.minCardsForBattle;

    let shouldJoin = hasMinimumCards && canAfford;
    let decisionReason = 'Battle-priority mode: eligible and affordable.';
    let decisionConfidence = 90;

    if (!shouldJoin) {
      const decision = await strategy.decideToJoinBattle(battle, cards, balance);
      shouldJoin = decision.decision;
      decisionReason = decision.reasoning;
      decisionConfidence = decision.confidence;
    }

    if (!shouldJoin) {
      verbose(`Battle ${battle.battleId.slice(0, 8)}... skipped: ${decisionReason}`);
      continue;
    }

    log(`DECISION: Join battle ${battle.battleId.slice(0, 8)}... (${decisionConfidence}% confidence)`);
    log(`REASONING: ${decisionReason}`);

    const cardSelection = await strategy.selectBattleCards(cards);
    log(`Selected cards: ${cardSelection.indices.map(i => cards[i]?.name).join(', ')}`);

    const joinedBattle = await actions.joinBattle(battle.battleId);
    if (!joinedBattle) continue;

    log(`Joined battle! Now selecting cards...`);

    const cardIds = cardSelection.indices.map(i => cards[i]._id);
    const result = await actions.selectBattleCards(battle.battleId, cardIds);

    if (result?.simulationComplete) {
      log(`Battle simulation complete!`);
      stats.battlesJoined++;

      const battleLog = result.battleLog as { winner?: string };
      if (battleLog?.winner === config.agentWalletAddress.toLowerCase()) {
        log(`VICTORY! Won ${parseFloat(battle.wager) * 2 * 0.95} MON`);
        stats.battlesWon++;
        stats.totalEarnings += parseFloat(battle.wager) * 2 * 0.95;
      } else {
        log(`DEFEAT. Lost ${battle.wager} MON`);
        stats.battlesLost++;
        stats.totalLosses += parseFloat(battle.wager);
      }
    }

    // Join at most one battle per iteration.
    break;
  }
}

async function checkTournaments(): Promise<void> {
  if (!config.features.autoEnterTournaments) {
    verbose('Tournament entry disabled');
    return;
  }

  const tournaments = await actions.getTournaments();
  const cards = await actions.getAgentCards();
  const balance = await actions.getBalance();

  if (tournaments.length === 0) {
    verbose('No tournaments available');
    return;
  }

  log(`Found ${tournaments.length} tournaments`);

  for (const tournament of tournaments as Array<{ tournamentId: string; name: string; entryFee: string; prizePool: string; participants: string[]; maxParticipants: number; status: string }>) {
    if (tournament.status !== 'registration') continue;

    const tournamentInfo = {
      tournamentId: tournament.tournamentId,
      name: tournament.name,
      entryFee: tournament.entryFee,
      prizePool: tournament.prizePool,
      participants: tournament.participants.length,
      maxParticipants: tournament.maxParticipants,
    };

    const decision = await strategy.decideToEnterTournament(tournamentInfo, cards, balance);

    if (decision.decision) {
      log(`DECISION: Enter tournament "${tournament.name}" (${decision.confidence}% confidence)`);
      log(`REASONING: ${decision.reasoning}`);

      const cardSelection = await strategy.selectBattleCards(cards);
      const cardIds = cardSelection.indices.map(i => cards[i]._id);

      const success = await actions.enterTournament(tournament.tournamentId, cardIds);
      if (success) {
        log(`Entered tournament!`);
        stats.tournamentsEntered++;
      }
    }
  }
}

async function runIteration(): Promise<void> {
  iterationCount++;

  if (iterationCount % 10 === 0) {
    printStats();
  }

  log(`--- Iteration ${iterationCount} ---`);

  try {
    const battlesJoinedBefore = stats.battlesJoined;
    await checkAndJoinBattles();
    // If no battle was joined this cycle, continue with secondary actions.
    if (stats.battlesJoined === battlesJoinedBefore) {
      await checkAndBuyPacks();
      await checkTournaments();
    }

    consecutiveErrors = 0;
  } catch (error) {
    consecutiveErrors++;
    console.error(`[${timestamp()}] ERROR:`, error);

    if (consecutiveErrors >= config.maxConsecutiveErrors) {
      log(`Too many consecutive errors (${consecutiveErrors}), stopping agent`);
      isRunning = false;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setupShutdownHandlers(): void {
  const shutdown = () => {
    log('\nShutting down agent...');
    printStats();
    isRunning = false;
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/**
 * Run the autonomous agent loop
 */
export async function runAutoLoop(): Promise<void> {
  printBanner();

  const validation = validateConfig();
  if (!validation.valid) {
    console.error('Configuration errors:');
    for (const error of validation.errors) {
      console.error(`  - ${error}`);
    }
    console.error('\nPlease set the required environment variables and try again.');
    console.error('Example:');
    console.error('  ANTHROPIC_API_KEY=your-key AGENT_PRIVATE_KEY=0x... npm run agent:auto');
    process.exit(1);
  }

  logConfig();
  setupShutdownHandlers();

  log('Agent starting in AUTONOMOUS mode...');

  // Authenticate via SIWE
  const authed = await actions.authenticate();
  if (!authed) {
    log('⚠ Authentication failed — some features may not work');
    log('  Agent will still register and wander, but battles/packs need auth');
  }

  // Register agent
  const agentName = config.agentName;
  const registered = await actions.registerAgent(agentName);
  log(`Agent registered: ${registered ? '✅' : '❌'} as "${agentName}"`);

  log(`Polling every ${config.pollIntervalMs}ms`);
  log('Press Ctrl+C to stop\n');

  // Wander state
  let wanderX = 0;
  let wanderZ = 8;
  let currentHealth = 100;
  const LOCATIONS = [
    { name: 'Starter Town', x: 0, z: 0 },
    { name: 'Town Arena', x: 0, z: -20 },
    { name: 'Town Market', x: 18, z: 0 },
    { name: 'Community Farm', x: -18, z: 0 },
    { name: 'Green Meadows', x: -14, z: -18 },
    { name: 'Old Pond', x: -22, z: -18 },
    { name: 'Dark Forest', x: -24, z: 14 },
    { name: 'River Delta', x: 22, z: -16 },
    { name: 'Crystal Caves', x: 20, z: 16 },
  ];

  let targetLoc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
  let pendingAction: { action: string; reason: string; reasoning: string; wager?: string } | null = null;
  let recentActionLog: string[] = [];

  while (isRunning) {
    // Check health and state
    const agentData = await actions.fetchAgent();
    if (agentData && typeof agentData.health === 'number') {
      currentHealth = agentData.health;
    }

    // Move toward target location
    const dx = targetLoc.x - wanderX;
    const dz = targetLoc.z - wanderZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 2) {
      const speed = currentHealth <= 20 ? 1 : 2;
      wanderX += (dx / dist) * speed;
      wanderZ += (dz / dist) * speed;
    } else {
      // Arrived at location — execute the pending action or ask AI for one
      if (!pendingAction) {
        // Ask Claude what to do
        const cards = await actions.getAgentCards();
        const balance = await actions.getBalance();
        const pendingBattles = await actions.getPendingBattles();

        const decision = await strategy.decideNextAction(
          targetLoc.name,
          currentHealth,
          100,
          balance,
          cards,
          recentActionLog,
          pendingBattles.length,
          config.aiPersonality,
        );

        pendingAction = {
          action: decision.action,
          reason: decision.reasoning,
          reasoning: decision.reasoning,
          wager: decision.wager,
        };

        // If AI chose a different location, navigate there first
        const chosenLoc = LOCATIONS.find(l => l.name === decision.location);
        if (chosenLoc && chosenLoc.name !== targetLoc.name) {
          targetLoc = chosenLoc;
          log(`🧠 AI decided: go to ${decision.location} to ${decision.action}`);
          log(`   💭 "${decision.reasoning}"`);
          // Don't execute action yet — need to travel there first
          await actions.updatePosition({ x: wanderX, y: 0, z: wanderZ }, agentName);
          await runIteration();
          await sleep(config.pollIntervalMs);
          continue;
        }
      }

      // Execute the action at current location
      const { action, reasoning, wager } = pendingAction;
      log(`📍 ${targetLoc.name}: ${action} [❤️ ${currentHealth}/100]`);
      log(`   💭 "${reasoning}"`);

      await actions.logAction(action, reasoning, targetLoc.name, reasoning);
      recentActionLog.push(`${action}@${targetLoc.name}`);
      if (recentActionLog.length > 10) recentActionLog.shift();

      // If the AI wants to create a battle with a wager
      if (wager && action === 'battling' && targetLoc.name === 'Town Arena') {
        log(`⚔️ Creating battle with ${wager} MON wager`);
        const battle = await actions.createBattle(wager);
        if (battle) {
          log(`   Battle created: ${battle.battleId.slice(0, 8)}...`);
          const cards = await actions.getAgentCards();
          if (cards.length >= 3) {
            const cardSelection = await strategy.selectBattleCards(cards);
            const cardIds = cardSelection.indices.map(i => cards[i]._id);
            await actions.selectBattleCards(battle.battleId, cardIds);
            log(`   Cards selected: ${cardSelection.indices.map(i => cards[i]?.name).join(', ')}`);
            log(`   💭 "${cardSelection.reasoning}"`);
          }
        }
      }

      // Clear pending action and ask AI for next move
      pendingAction = null;

      // Ask AI where to go next
      const cards = await actions.getAgentCards();
      const balance = await actions.getBalance();
      const pendingBattles = await actions.getPendingBattles();

      const nextDecision = await strategy.decideNextAction(
        targetLoc.name,
        currentHealth,
        100,
        balance,
        cards,
        recentActionLog,
        pendingBattles.length,
        config.aiPersonality,
      );

      pendingAction = {
        action: nextDecision.action,
        reason: nextDecision.reasoning,
        reasoning: nextDecision.reasoning,
        wager: nextDecision.wager,
      };

      const nextLoc = LOCATIONS.find(l => l.name === nextDecision.location);
      if (nextLoc && nextLoc.name !== targetLoc.name) {
        targetLoc = nextLoc;
        log(`   → heading to ${nextDecision.location} for ${nextDecision.action}`);
      }
    }

    // Update position on server
    await actions.updatePosition({ x: wanderX, y: 0, z: wanderZ }, agentName);

    // Also run game actions (buy packs, join battles, etc.)
    await runIteration();
    await sleep(config.pollIntervalMs);
  }

  log('Agent stopped.');
}
