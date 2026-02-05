/**
 * AutoMon Agent Actions
 *
 * API wrapper functions for interacting with the AutoMon game server.
 * These provide a clean interface for the agent's autonomous decision-making.
 */

import { config } from './config';
import { ethers } from 'ethers';

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

interface Card {
  _id: string;
  id?: string;
  name: string;
  element: string;
  rarity: string;
  stats: {
    attack: number;
    defense: number;
    speed: number;
    hp: number;
    maxHp: number;
  };
  ability: {
    name: string;
    effect: string;
    power: number;
    cooldown: number;
  };
}

interface Battle {
  battleId: string;
  player1: {
    address: string;
    cards: Card[];
    ready: boolean;
  };
  player2?: {
    address: string;
    cards: Card[];
    ready: boolean;
  };
  wager: string;
  status: string;
  winner?: string;
}

interface Pack {
  packId: string;
  opened: boolean;
  cards: string[];
}

// Authentication token storage
let authToken: string | null = null;

async function fetchApi(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${config.apiUrl}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  if (authToken) {
    headers['Cookie'] = `auth_token=${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}

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
    const wallet = getWallet();
    const balance = await getProvider().getBalance(wallet.address);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error('Get balance error:', error);
    return '0';
  }
}

/**
 * Get all cards owned by the agent
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
 * Get all packs owned by the agent
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
export async function buyPackNFT(): Promise<{ txHash: string; tokenIds: number[] } | null> {
  try {
    const contract = getNftContract();
    const packPrice = ethers.parseEther(config.packPrice);

    console.log(`Buying pack for ${config.packPrice} MON...`);
    const tx = await contract.buyPack({ value: packPrice });
    console.log(`TX sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`TX confirmed in block ${receipt.blockNumber}`);

    // Parse the PackPurchased event to get token IDs
    const tokenIds: number[] = [];
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
        if (parsed?.name === 'CardMinted') {
          tokenIds.push(Number(parsed.args[0]));
        }
      } catch {
        // Not our event
      }
    }

    return { txHash: tx.hash, tokenIds };
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
      body: JSON.stringify({ tokenIds }),
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
export async function getNFTCards(): Promise<{ tokenId: number; automonId: number; rarity: number }[]> {
  try {
    const contract = getNftContract();
    const wallet = getWallet();

    const tokenIds = await contract.getCardsOf(wallet.address);
    const cards = [];

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

/**
 * Buy a card pack (legacy API method)
 * @deprecated Use buyPackNFT instead
 */
export async function buyPack(txHash: string): Promise<Pack | null> {
  try {
    const response = await fetchApi('/api/packs/buy', {
      method: 'POST',
      body: JSON.stringify({ txHash }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Buy pack failed:', error);
      return null;
    }

    const data = await response.json();
    return data.pack;
  } catch (error) {
    console.error('Buy pack error:', error);
    return null;
  }
}

/**
 * Open a pack to reveal cards
 */
export async function openPack(packId: string): Promise<Card[] | null> {
  try {
    const response = await fetchApi('/api/packs/open', {
      method: 'POST',
      body: JSON.stringify({ packId }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Open pack failed:', error);
      return null;
    }

    const data = await response.json();
    return data.cards;
  } catch (error) {
    console.error('Open pack error:', error);
    return null;
  }
}

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
