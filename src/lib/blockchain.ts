import { ethers } from 'ethers';

const ESCROW_ABI = [
  'function createBattle(bytes32 battleId) external payable',
  'function joinBattle(bytes32 battleId) external payable',
  'function settleBattle(bytes32 battleId, address winner) external',
  'function cancelBattle(bytes32 battleId) external',
  'function battles(bytes32) external view returns (address player1, address player2, uint256 wager, bool settled)',
  'event BattleCreated(bytes32 indexed battleId, address player1, uint256 wager)',
  'event BattleJoined(bytes32 indexed battleId, address player2)',
  'event BattleSettled(bytes32 indexed battleId, address winner, uint256 payout)',
];

export function getProvider() {
  const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC || 'https://testnet.rpc.monad.xyz';
  return new ethers.JsonRpcProvider(rpcUrl);
}

export function getEscrowContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  const contractAddress = process.env.ESCROW_CONTRACT_ADDRESS;

  if (!contractAddress) {
    throw new Error('ESCROW_CONTRACT_ADDRESS not configured');
  }

  const provider = signerOrProvider || getProvider();
  return new ethers.Contract(contractAddress, ESCROW_ABI, provider);
}

export function getAdminSigner() {
  const privateKey = process.env.ADMIN_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error('ADMIN_PRIVATE_KEY not configured');
  }

  const provider = getProvider();
  return new ethers.Wallet(privateKey, provider);
}

export async function settleBattleOnChain(battleId: string, winner: string): Promise<string> {
  const signer = getAdminSigner();
  const contract = getEscrowContract(signer);

  const battleIdBytes = ethers.id(battleId);
  const tx = await contract.settleBattle(battleIdBytes, winner);
  const receipt = await tx.wait();

  return receipt.hash;
}

export function battleIdToBytes32(battleId: string): string {
  return ethers.id(battleId);
}

export function formatMON(wei: string | bigint): string {
  return ethers.formatEther(wei);
}

export function parseMON(mon: string): bigint {
  return ethers.parseEther(mon);
}

// Client-side helpers
export const CHAIN_CONFIG = {
  chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '10143'),
  chainIdHex: `0x${(parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '10143')).toString(16)}`,
  chainName: 'Monad Testnet',
  nativeCurrency: {
    name: 'MON',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: [process.env.NEXT_PUBLIC_MONAD_RPC || 'https://testnet.rpc.monad.xyz'],
  blockExplorerUrls: ['https://testnet.monadexplorer.com'],
};
