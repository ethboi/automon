/**
 * AutoMon Agent Actions
 *
 * API wrapper functions for interacting with the AutoMon game server.
 * Covers both blockchain operations and agent-specific REST endpoints.
 */

import { config } from './config';
import { ethers } from 'ethers';
import type { Card, Battle, Pack, Position, Agent, MintedCard, NFTCard } from './types';

// Re-export types for convenience
export type { Card, Battle, Pack, Position, Agent, MintedCard, NFTCard };

// AutoMonNFT contract ABI (minimal)
const NFT_ABI = [
  'function buyPack() external payable',
  'function totalSupply() view returns (uint256)',
  'function getCard(uint256 tokenId) view returns (uint8 automonId, uint8 rarity)',
  'function getCardsOf(address owner) view returns (uint256[])',
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event PackPurchased(address indexed buyer, uint256[] tokenIds)',
  'event CardMinted(uint256 indexed tokenId, uint8 automonId, uint8 rarity)',
];

// AutoMon names lookup
const AUTOMON_NAMES: Record<number, string> = {
  1: 'Blazeon', 2: 'Emberwing', 3: 'Magmor', 4: 'Cindercat',
  5: 'Aquaris', 6: 'Tidalon', 7: 'Coralix', 8: 'Frostfin',
  9: 'Terrox', 10: 'Bouldern', 11: 'Crysthorn',
  12: 'Zephyrix', 13: 'Stormwing', 14: 'Gustal',
  15: 'Shadowmere', 16: 'Voidling', 17: 'Noxfang',
  18: 'Luxara', 19: 'Solaris', 20: 'Aurorix',
};

const AUTOMON_ELEMENTS: Record<number, string> = {
  1: 'fire', 2: 'fire', 3: 'fire', 4: 'fire',
  5: 'water', 6: 'water', 7: 'water', 8: 'water',
  9: 'earth', 10: 'earth', 11: 'earth',
  12: 'air', 13: 'air', 14: 'air',
  15: 'dark', 16: 'dark', 17: 'dark',
  18: 'light', 19: 'light', 20: 'light',
};

const RARITY_NAMES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

// Blockchain provider and wallet (lazy initialized)
let provider: ethers.JsonRpcProvider | null = null;
let wallet: ethers.Wallet | null = null;
let nftContract: ethers.Contract | null = null;

function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(config.rpcUrl);
  }
  return provider;
}

function getWallet(): ethers.Wallet {
  if (!wallet) {
    if (!config.agentWalletPrivateKey) {
      throw new Error('AGENT_PRIVATE_KEY not configured');
    }
    wallet = new ethers.Wallet(config.agentWalletPrivateKey, getProvider());
  }
  return wallet;
}

function getNftContract(): ethers.Contract {
  if (!nftContract) {
    if (!config.nftContractAddress) {
      throw new Error('AUTOMON_NFT_ADDRESS not configured');
    }
    nftContract = new ethers.Contract(config.nftContractAddress, NFT_ABI, getWallet());
  }
  return nftContract;
}

// Authentication token storage
let authToken: string | null = null;
let authCookie: string | null = null;

/**
 * Authenticate the agent via SIWE (Sign-In with Ethereum)
 * Gets a nonce, signs it, verifies, and stores the auth cookie.
 */
export async function authenticate(): Promise<boolean> {
  try {
    const w = getWallet();
    const address = w.address;
    console.log(`[AUTH] Authenticating ${address}...`);

    // 1. Get nonce
    const nonceRes = await fetch(`${config.apiUrl}/api/auth/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    if (!nonceRes.ok) {
      console.error('[AUTH] Failed to get nonce:', nonceRes.status);
      return false;
    }
    const { nonce } = await nonceRes.json();

    // 2. Create and sign SIWE message
    const domain = new URL(config.apiUrl).host;
    const origin = config.apiUrl;
    const { SiweMessage } = await import('siwe');
    const siweMessage = new SiweMessage({
      domain,
      address,
      statement: 'Sign in to AutoMon',
      uri: origin,
      version: '1',
      chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '10143'),
      nonce,
      issuedAt: new Date().toISOString(),
    });
    const message = siweMessage.toMessage();
    const signature = await w.signMessage(message);

    // 3. Verify with server
    const verifyRes = await fetch(`${config.apiUrl}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, signature }),
    });
    if (!verifyRes.ok) {
      console.error('[AUTH] Verification failed:', verifyRes.status);
      return false;
    }
    const verifyData = await verifyRes.json();

    // 4. Extract auth cookie from Set-Cookie header
    const setCookie = verifyRes.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/auth_token=([^;]+)/);
      if (match) {
        authCookie = match[1];
        authToken = match[1];
      }
    }
    // Also use token from body if available
    if (verifyData.token) {
      authToken = verifyData.token;
      authCookie = verifyData.token;
    }

    console.log(`[AUTH] ✅ Authenticated as ${address}`);
    return true;
  } catch (error) {
    console.error('[AUTH] Authentication error:', error);
    return false;
  }
}

async function fetchApi(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${config.apiUrl}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  if (authCookie) {
    headers['Cookie'] = `auth_token=${authCookie}`;
  } else if (authToken) {
    headers['Cookie'] = `auth_token=${authToken}`;
  }

  // Also send agent secret for CLI auth fallback
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret) {
    headers['x-agent-secret'] = jwtSecret;
  }

  return fetch(url, { ...options, headers, redirect: 'follow' });
}

// ─── Agent-specific API functions ──────────────────────────────────────────────

/**
 * Register the agent with the game server
 */
export async function registerAgent(name: string): Promise<boolean> {
  try {
    const res = await fetchApi('/api/agents/register', {
      method: 'POST',
      body: JSON.stringify({
        address: config.agentWalletAddress,
        name,
        personality: config.aiPersonality,
      }),
    });
    return res.ok;
  } catch (error) {
    console.error('Failed to register:', error);
    return false;
  }
}

/**
 * Fetch existing agent data from the server
 */
export async function fetchAgent(): Promise<Agent | null> {
  if (!config.agentWalletAddress) return null;
  try {
    const res = await fetchApi(`/api/agents/${config.agentWalletAddress}`);
    if (res.ok) {
      const data = await res.json();
      return data.agent;
    }
  } catch {
    // Agent doesn't exist yet
  }
  return null;
}

/**
 * Update agent position in the game world
 */
export async function updatePosition(pos: Position, name: string): Promise<void> {
  if (!config.agentWalletAddress) return;
  try {
    await fetchApi('/api/agents/move', {
      method: 'POST',
      body: JSON.stringify({
        address: config.agentWalletAddress,
        position: pos,
        name,
      }),
    });
  } catch {
    // Silently fail position updates
  }
}

/**
 * Log an agent action to the server
 */
export async function logAction(action: string, reason: string, location: string): Promise<void> {
  if (!config.agentWalletAddress) return;
  try {
    await fetchApi('/api/agents/action', {
      method: 'POST',
      body: JSON.stringify({
        address: config.agentWalletAddress,
        action,
        reason,
        location,
      }),
    });
  } catch {
    // Silently fail action logs
  }
}

/**
 * Get cards for this agent via agent-specific endpoint
 */
export async function getAgentCards(): Promise<Card[]> {
  if (!config.agentWalletAddress) return [];
  try {
    const res = await fetchApi(`/api/agents/cards?address=${config.agentWalletAddress}`);
    if (res.ok) {
      const data = await res.json();
      return data.cards || [];
    }
    return [];
  } catch (error) {
    console.error('Get agent cards error:', error);
    return [];
  }
}

/**
 * Get packs for this agent via agent-specific endpoint
 */
export async function getAgentPacks(): Promise<Pack[]> {
  if (!config.agentWalletAddress) return [];
  try {
    const res = await fetchApi(`/api/agents/packs?address=${config.agentWalletAddress}`);
    if (res.ok) {
      const data = await res.json();
      return data.packs || [];
    }
    return [];
  } catch (error) {
    console.error('Get agent packs error:', error);
    return [];
  }
}

/**
 * Open a pack via agent-specific endpoint
 */
export async function openAgentPack(packId?: string): Promise<{ cards?: Card[] } | null> {
  if (!config.agentWalletAddress) return null;
  try {
    const res = await fetchApi('/api/agents/packs/open', {
      method: 'POST',
      body: JSON.stringify({ address: config.agentWalletAddress, packId }),
    });
    if (res.ok) {
      return await res.json();
    }
    const error = await res.json();
    console.error('Open pack failed:', error.error);
    return null;
  } catch (error) {
    console.error('Open pack error:', error);
    return null;
  }
}

// ─── Blockchain operations ─────────────────────────────────────────────────────

/**
 * Get current session info
 */
export async function getSession(): Promise<{ address: string } | null> {
  try {
    const response = await fetchApi('/api/auth/session');
    if (!response.ok) return null;
    const data = await response.json();
    return data.session;
  } catch (error) {
    console.error('Get session error:', error);
    return null;
  }
}

/**
 * Get agent's MON balance from the blockchain
 */
export async function getBalance(): Promise<string> {
  try {
    const w = getWallet();
    const balance = await getProvider().getBalance(w.address);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error('Get balance error:', error);
    return '0';
  }
}

/**
 * Get all cards owned by the agent (auth-session endpoint)
 */
export async function getCards(): Promise<Card[]> {
  try {
    const response = await fetchApi('/api/cards');
    if (!response.ok) {
      console.error('Get cards failed:', response.status);
      return [];
    }
    const data = await response.json();
    return data.cards || [];
  } catch (error) {
    console.error('Get cards error:', error);
    return [];
  }
}

/**
 * Get all packs owned by the agent (auth-session endpoint)
 */
export async function getPacks(): Promise<Pack[]> {
  try {
    const response = await fetchApi('/api/packs');
    if (!response.ok) return [];
    const data = await response.json();
    return data.packs || [];
  } catch (error) {
    console.error('Get packs error:', error);
    return [];
  }
}

/**
 * Buy a card pack from the NFT contract
 */
export async function buyPackNFT(): Promise<{ txHash: string; tokenIds: number[]; mintedCards: MintedCard[] } | null> {
  try {
    const contract = getNftContract();
    const packPrice = ethers.parseEther(config.packPrice);

    console.log(`Buying pack for ${config.packPrice} MON...`);
    const tx = await contract.buyPack({ value: packPrice });
    console.log(`TX sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`TX confirmed in block ${receipt.blockNumber}`);

    // Parse the CardMinted events to get token IDs and card info
    const tokenIds: number[] = [];
    const mintedCards: MintedCard[] = [];
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
        if (parsed?.name === 'CardMinted') {
          const tokenId = Number(parsed.args[0]);
          const automonId = Number(parsed.args[1]);
          const rarity = Number(parsed.args[2]);
          tokenIds.push(tokenId);
          mintedCards.push({
            tokenId,
            name: AUTOMON_NAMES[automonId] || `AutoMon #${automonId}`,
            element: AUTOMON_ELEMENTS[automonId] || 'unknown',
            rarity: RARITY_NAMES[rarity] || 'common',
          });
        }
      } catch {
        // Not our event
      }
    }

    return { txHash: tx.hash, tokenIds, mintedCards };
  } catch (error) {
    console.error('Buy pack NFT error:', error);
    return null;
  }
}

/**
 * Sync NFT cards to the game server database
 */
export async function syncNFTCards(tokenIds: number[]): Promise<Card[] | null> {
  try {
    const response = await fetchApi('/api/agents/cards/sync', {
      method: 'POST',
      body: JSON.stringify({ tokenIds, address: config.agentWalletAddress }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Sync NFT cards failed:', error);
      return null;
    }

    const data = await response.json();
    return data.cards;
  } catch (error) {
    console.error('Sync NFT cards error:', error);
    return null;
  }
}

/**
 * Get NFT cards owned by the agent directly from the contract
 */
export async function getNFTCards(): Promise<NFTCard[]> {
  try {
    const contract = getNftContract();
    const w = getWallet();

    const tokenIds = await contract.getCardsOf(w.address);
    const cards: NFTCard[] = [];

    for (const tokenId of tokenIds) {
      const [automonId, rarity] = await contract.getCard(tokenId);
      cards.push({
        tokenId: Number(tokenId),
        automonId: Number(automonId),
        rarity: Number(rarity),
      });
    }

    return cards;
  } catch (error) {
    console.error('Get NFT cards error:', error);
    return [];
  }
}

// ─── Battle operations ─────────────────────────────────────────────────────────

/**
 * Get list of pending battles available to join
 */
export async function getPendingBattles(): Promise<Battle[]> {
  try {
    const response = await fetchApi('/api/battle/list?status=pending');
    if (!response.ok) return [];
    const data = await response.json();
    return data.battles || [];
  } catch (error) {
    console.error('Get pending battles error:', error);
    return [];
  }
}

/**
 * Get agent's active and recent battles
 */
export async function getMyBattles(): Promise<Battle[]> {
  try {
    const response = await fetchApi('/api/battle/list?type=my');
    if (!response.ok) return [];
    const data = await response.json();
    return data.battles || [];
  } catch (error) {
    console.error('Get my battles error:', error);
    return [];
  }
}

/**
 * Join a pending battle
 */
export async function joinBattle(battleId: string): Promise<Battle | null> {
  try {
    const response = await fetchApi('/api/battle/join', {
      method: 'POST',
      body: JSON.stringify({ battleId }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Join battle failed:', error);
      return null;
    }

    const data = await response.json();
    return data.battle;
  } catch (error) {
    console.error('Join battle error:', error);
    return null;
  }
}

/**
 * Select cards for battle
 */
export async function selectBattleCards(
  battleId: string,
  cardIds: string[]
): Promise<{ battle: Battle; battleLog?: unknown; simulationComplete?: boolean } | null> {
  try {
    const response = await fetchApi('/api/battle/select-cards', {
      method: 'POST',
      body: JSON.stringify({ battleId, cardIds }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Select cards failed:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Select cards error:', error);
    return null;
  }
}

/**
 * Create a new battle with wager
 */
export async function createBattle(
  wager: string,
  txHash: string
): Promise<Battle | null> {
  try {
    const response = await fetchApi('/api/battle/create', {
      method: 'POST',
      body: JSON.stringify({ wager, txHash }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Create battle failed:', error);
      return null;
    }

    const data = await response.json();
    return data.battle;
  } catch (error) {
    console.error('Create battle error:', error);
    return null;
  }
}

/**
 * Get battle details by ID
 */
export async function getBattle(battleId: string): Promise<Battle | null> {
  try {
    const response = await fetchApi(`/api/battle/${battleId}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.battle;
  } catch (error) {
    console.error('Get battle error:', error);
    return null;
  }
}

/**
 * Get battle log for replay
 */
export async function getBattleLog(battleId: string): Promise<unknown | null> {
  try {
    const response = await fetchApi(`/api/battle/simulate?battleId=${battleId}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.battleLog;
  } catch (error) {
    console.error('Get battle log error:', error);
    return null;
  }
}

// ─── Tournament operations ─────────────────────────────────────────────────────

/**
 * Get list of upcoming tournaments
 */
export async function getTournaments(): Promise<unknown[]> {
  try {
    const response = await fetchApi('/api/tournament/list');
    if (!response.ok) return [];
    const data = await response.json();
    return data.tournaments || [];
  } catch (error) {
    console.error('Get tournaments error:', error);
    return [];
  }
}

/**
 * Enter a tournament
 */
export async function enterTournament(
  tournamentId: string,
  cardIds: string[]
): Promise<boolean> {
  try {
    const response = await fetchApi('/api/tournament/enter', {
      method: 'POST',
      body: JSON.stringify({ tournamentId, cardIds }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Enter tournament failed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Enter tournament error:', error);
    return false;
  }
}

// ─── Utility functions ─────────────────────────────────────────────────────────

/**
 * Set authentication token
 */
export function setAuthToken(token: string): void {
  authToken = token;
}

/**
 * Get element distribution from cards
 */
export function getElementDistribution(cards: Card[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  for (const card of cards) {
    distribution[card.element] = (distribution[card.element] || 0) + 1;
  }
  return distribution;
}

/**
 * Calculate team strength score
 */
export function calculateTeamStrength(cards: Card[]): number {
  if (cards.length === 0) return 0;

  let totalScore = 0;
  const rarityMultipliers: Record<string, number> = {
    legendary: 2.0,
    epic: 1.5,
    rare: 1.2,
    uncommon: 1.1,
    common: 1.0,
  };

  for (const card of cards) {
    const statTotal = card.stats.attack + card.stats.defense + card.stats.speed + card.stats.hp;
    const multiplier = rarityMultipliers[card.rarity] || 1.0;
    totalScore += statTotal * multiplier;
  }

  return totalScore / cards.length;
}

/**
 * Format a card for console display with color
 */
export function formatCard(card: Card | MintedCard): string {
  const rarityColors: Record<string, string> = {
    common: '\x1b[37m',
    uncommon: '\x1b[32m',
    rare: '\x1b[34m',
    epic: '\x1b[35m',
    legendary: '\x1b[33m',
  };
  const color = rarityColors[card.rarity] || '\x1b[37m';
  const reset = '\x1b[0m';

  if ('stats' in card && card.stats) {
    return `${color}[${card.rarity.toUpperCase()}]${reset} ${card.name} (${card.element}) - ATK:${card.stats.attack} DEF:${card.stats.defense} SPD:${card.stats.speed} HP:${card.stats.hp}`;
  }
  // Minimal card info (e.g. from NFT mint)
  const tokenInfo = 'tokenId' in card && card.tokenId ? ` #${card.tokenId}` : '';
  return `${color}[${card.rarity.toUpperCase()}]${reset} ${card.name}${tokenInfo} (${card.element})`;
}
