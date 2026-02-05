/**
 * AutoMon Agent Configuration
 *
 * This file contains all configuration settings for the autonomous agent.
 * Set environment variables or modify defaults as needed.
 */

export const config = {
  // API Configuration
  apiUrl: process.env.AUTOMON_API_URL || 'http://localhost:3000',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',

  // Wallet Configuration
  agentWalletPrivateKey: process.env.AGENT_PRIVATE_KEY || '',
  agentWalletAddress: process.env.AGENT_ADDRESS || '',

  // Contract Configuration
  nftContractAddress: process.env.AUTOMON_NFT_ADDRESS || '',
  rpcUrl: process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',

  // Polling Configuration
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '3000', 10),
  maxConsecutiveErrors: 5,

  // Decision Thresholds
  minCardsForBattle: 3,
  maxWagerPercentage: 0.25, // Max % of balance to wager
  minBalanceReserve: 0.5, // Min MON to keep in reserve

  // Feature Flags
  features: {
    autoBuyPacks: process.env.AUTO_BUY_PACKS !== 'false',
    autoJoinBattles: process.env.AUTO_JOIN_BATTLES !== 'false',
    autoEnterTournaments: process.env.AUTO_ENTER_TOURNAMENTS !== 'false',
    verboseLogging: process.env.VERBOSE_LOGGING === 'true',
  },

  // AI Personality (affects battle decisions)
  aiPersonality: process.env.AI_PERSONALITY || 'balanced',

  // Pack price in MON
  packPrice: process.env.PACK_PRICE || '0.1',
};

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.anthropicApiKey) {
    errors.push('ANTHROPIC_API_KEY is required');
  }

  if (!config.agentWalletPrivateKey) {
    errors.push('AGENT_PRIVATE_KEY is required for on-chain transactions');
  }

  if (!config.agentWalletAddress) {
    errors.push('AGENT_ADDRESS is required');
  }

  if (config.features.autoBuyPacks && !config.nftContractAddress) {
    errors.push('AUTOMON_NFT_ADDRESS is required for buying packs');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function logConfig(): void {
  console.log('\n========================================');
  console.log('AUTOMON AGENT CONFIGURATION');
  console.log('========================================');
  console.log(`API URL: ${config.apiUrl}`);
  console.log(`RPC URL: ${config.rpcUrl}`);
  console.log(`Poll Interval: ${config.pollIntervalMs}ms`);
  console.log(`Agent Address: ${config.agentWalletAddress || 'NOT SET'}`);
  console.log(`NFT Contract: ${config.nftContractAddress || 'NOT SET'}`);
  console.log(`AI Personality: ${config.aiPersonality}`);
  console.log('\nFeatures:');
  console.log(`  Auto Buy Packs: ${config.features.autoBuyPacks}`);
  console.log(`  Auto Join Battles: ${config.features.autoJoinBattles}`);
  console.log(`  Auto Enter Tournaments: ${config.features.autoEnterTournaments}`);
  console.log(`  Verbose Logging: ${config.features.verboseLogging}`);
  console.log('========================================\n');
}
