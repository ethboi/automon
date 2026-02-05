#!/usr/bin/env npx tsx
/**
 * AutoMon Autonomous Agent
 *
 * This agent runs as a separate process and autonomously:
 * - Checks if it needs more cards and decides whether to buy packs
 * - Looks for open battles and decides whether to join based on risk/reward
 * - Enters tournaments when the odds are favorable
 * - Logs all decisions with detailed reasoning
 *
 * Run with: npm run agent
 * Or directly: npx tsx agent/index.ts
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

/**
 * Format time for logging
 */
function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

/**
 * Log with timestamp
 */
function log(message: string): void {
  console.log(`[${timestamp()}] ${message}`);
}

/**
 * Log verbose messages (only if enabled)
 */
function verbose(message: string): void {
  if (config.features.verboseLogging) {
    console.log(`[${timestamp()}] [VERBOSE] ${message}`);
  }
}

/**
 * Print agent banner
 */
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

/**
 * Print current statistics
 */
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

/**
 * Check and buy packs if needed
 */
async function checkAndBuyPacks(): Promise<void> {
  if (!config.features.autoBuyPacks) {
    verbose('Pack buying disabled');
    return;
  }

  const cards = await actions.getCards();
  const balance = await actions.getBalance();

  stats.packsConsidered++;

  const decision = await strategy.decideToBuyPack(balance, cards, config.packPrice);

  if (decision.decision) {
    log(`DECISION: Buy pack (${decision.confidence}% confidence)`);
    log(`REASONING: ${decision.reasoning}`);

    // Buy pack from NFT contract
    const result = await actions.buyPackNFT();

    if (result) {
      log(`Pack purchased! TX: ${result.txHash.slice(0, 10)}...`);
      log(`Minted token IDs: ${result.tokenIds.join(', ')}`);
      stats.packsBought++;

      // Sync the NFT cards to the database
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

/**
 * Check and join battles if available
 */
async function checkAndJoinBattles(): Promise<void> {
  if (!config.features.autoJoinBattles) {
    verbose('Battle joining disabled');
    return;
  }

  const pendingBattles = await actions.getPendingBattles();
  const cards = await actions.getCards();
  const balance = await actions.getBalance();

  if (pendingBattles.length === 0) {
    verbose('No pending battles found');
    return;
  }

  log(`Found ${pendingBattles.length} pending battles`);

  for (const battle of pendingBattles) {
    // Skip our own battles
    if (battle.player1.address.toLowerCase() === config.agentWalletAddress.toLowerCase()) {
      continue;
    }

    stats.battlesConsidered++;

    const decision = await strategy.decideToJoinBattle(battle, cards, balance);

    if (decision.decision) {
      log(`DECISION: Join battle ${battle.battleId.slice(0, 8)}... (${decision.confidence}% confidence)`);
      log(`REASONING: ${decision.reasoning}`);

      // Select cards for battle
      const cardSelection = await strategy.selectBattleCards(cards);
      log(`Selected cards: ${cardSelection.indices.map(i => cards[i]?.name).join(', ')}`);

      // Join the battle
      const joinedBattle = await actions.joinBattle(battle.battleId);

      if (joinedBattle) {
        log(`Joined battle! Now selecting cards...`);

        // Select cards
        const cardIds = cardSelection.indices.map(i => cards[i]._id);
        const result = await actions.selectBattleCards(battle.battleId, cardIds);

        if (result?.simulationComplete) {
          log(`Battle simulation complete!`);
          stats.battlesJoined++;

          // Check if we won
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
      }
    } else {
      verbose(`Battle ${battle.battleId.slice(0, 8)}... skipped: ${decision.reasoning}`);
    }
  }
}

/**
 * Check and enter tournaments if available
 */
async function checkTournaments(): Promise<void> {
  if (!config.features.autoEnterTournaments) {
    verbose('Tournament entry disabled');
    return;
  }

  const tournaments = await actions.getTournaments();
  const cards = await actions.getCards();
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

/**
 * Main agent loop iteration
 */
async function runIteration(): Promise<void> {
  iterationCount++;

  if (iterationCount % 10 === 0) {
    printStats();
  }

  log(`--- Iteration ${iterationCount} ---`);

  try {
    // Check each opportunity type
    await checkAndBuyPacks();
    await checkAndJoinBattles();
    await checkTournaments();

    // Reset error counter on success
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

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Handle graceful shutdown
 */
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
 * Main entry point
 */
async function main(): Promise<void> {
  printBanner();

  // Validate configuration
  const validation = validateConfig();
  if (!validation.valid) {
    console.error('Configuration errors:');
    for (const error of validation.errors) {
      console.error(`  - ${error}`);
    }
    console.error('\nPlease set the required environment variables and try again.');
    console.error('Example:');
    console.error('  ANTHROPIC_API_KEY=your-key AGENT_PRIVATE_KEY=0x... AGENT_ADDRESS=0x... npm run agent');
    process.exit(1);
  }

  logConfig();
  setupShutdownHandlers();

  log('Agent starting...');
  log(`Polling every ${config.pollIntervalMs}ms`);
  log('Press Ctrl+C to stop\n');

  // Main loop
  while (isRunning) {
    await runIteration();
    await sleep(config.pollIntervalMs);
  }

  log('Agent stopped.');
}

// Run the agent
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
