/**
 * AutoMon Agent Configuration
 *
 * All configuration settings for both manual (CLI) and autonomous modes.
 * Loads an env file based on AGENT_ENV:
 *   AGENT_ENV=agent1 -> .env.agent1.local
 *   default          -> .env.local
 */

import dotenv from 'dotenv';
const envName = process.env.AGENT_ENV || 'local';
const envPath = envName === 'local' ? '.env.local' : `.env.${envName}.local`;
dotenv.config({ path: envPath });

import { ethers } from 'ethers';

// Derive wallet address from private key if not explicitly set
function deriveAddress(privateKey: string, explicitAddress: string): string {
  if (explicitAddress) return explicitAddress;
  if (!privateKey) return '';
  try {
    return new ethers.Wallet(privateKey).address;
  } catch {
    return '';
  }
}

// Normalize API URL: strip trailing slash
function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

const privateKey = process.env.AGENT_PRIVATE_KEY || '';
const explicitAddress = process.env.AGENT_ADDRESS || '';
const network = (process.env.AUTOMON_NETWORK || process.env.NEXT_PUBLIC_AUTOMON_NETWORK || 'testnet').toLowerCase() === 'mainnet'
  ? 'mainnet'
  : 'testnet';
const networkSuffix = network === 'mainnet' ? 'MAINNET' : 'TESTNET';

function envForNetwork(baseKey: string): string {
  const suffixed = (process.env[`${baseKey}_${networkSuffix}`] || '').trim();
  if (suffixed) return suffixed;
  if (network === 'mainnet') return '';
  return (process.env[baseKey] || '').trim();
}

export const config = {
  // Network
  network: network ? 'mainnet' : 'testnet',
  // API Configuration
  apiUrl: normalizeUrl(process.env.AUTOMON_API_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',

  // Wallet Configuration
  agentWalletPrivateKey: privateKey,
  agentWalletAddress: deriveAddress(privateKey, explicitAddress),

  // Agent identity
  agentName: process.env.AGENT_NAME || 'Nexus',

  // Contract Configuration
  nftContractAddress: envForNetwork('AUTOMON_NFT_ADDRESS') || envForNetwork('NEXT_PUBLIC_AUTOMON_NFT_ADDRESS'),
  rpcUrl: envForNetwork('MONAD_RPC_URL') || envForNetwork('NEXT_PUBLIC_MONAD_RPC') || (network === 'testnet' ? 'https://testnet-rpc.monad.xyz' : ''),

  // Polling / timing
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '3000', 10),
  wanderIntervalMs: parseInt(process.env.WANDER_INTERVAL_MS || '3000', 10),
  maxConsecutiveErrors: 5,

  // Decision Thresholds
  minCardsForBattle: 3,
  maxWagerPercentage: 0.25,
  minBalanceReserve: 0.5,

  // Feature Flags
  features: {
    autoBuyPacks: process.env.AUTO_BUY_PACKS !== 'false',
    autoJoinBattles: process.env.AUTO_JOIN_BATTLES !== 'false',
    autoEnterTournaments: process.env.AUTO_ENTER_TOURNAMENTS !== 'false',
    verboseLogging: process.env.VERBOSE_LOGGING === 'true',
  },

  // AI Personality
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
    errors.push('AGENT_ADDRESS is required (or derive from AGENT_PRIVATE_KEY)');
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
  console.log(`Env File: ${envPath}`);
  console.log(`RPC URL: ${config.rpcUrl}`);
  console.log(`Agent Name: ${config.agentName}`);
  console.log(`Agent Address: ${config.agentWalletAddress || 'NOT SET'}`);
  console.log(`NFT Contract: ${config.nftContractAddress || 'NOT SET'}`);
  console.log(`AI Personality: ${config.aiPersonality}`);
  console.log(`Poll Interval: ${config.pollIntervalMs}ms`);
  console.log(`Wander Interval: ${config.wanderIntervalMs}ms`);
  console.log('\nFeatures:');
  console.log(`  Auto Buy Packs: ${config.features.autoBuyPacks}`);
  console.log(`  Auto Join Battles: ${config.features.autoJoinBattles}`);
  console.log(`  Auto Enter Tournaments: ${config.features.autoEnterTournaments}`);
  console.log(`  Verbose Logging: ${config.features.verboseLogging}`);
  console.log('========================================\n');
}
