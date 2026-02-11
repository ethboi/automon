import { ethers } from 'ethers';
import { getAdminPrivateKey, getAutomonNetwork, getChainId, getEscrowContractAddress, getExplorerBaseUrl, getRpcUrl } from './network';

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
  return new ethers.JsonRpcProvider(getRpcUrl());
}

export function getEscrowContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  const contractAddress = getEscrowContractAddress();
  const provider = signerOrProvider || getProvider();
  return new ethers.Contract(contractAddress, ESCROW_ABI, provider);
}

export function getAdminSigner() {
  const privateKey = getAdminPrivateKey();
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

export async function getBalance(address: string): Promise<string> {
  const provider = getProvider();
  const balanceWei = await provider.getBalance(address);
  return ethers.formatEther(balanceWei);
}

export const CHAIN_CONFIG = {
  chainId: getChainId(),
  chainIdHex: `0x${getChainId().toString(16)}`,
  chainName: `Monad ${getAutomonNetwork() === 'mainnet' ? 'Mainnet' : 'Testnet'}`,
  nativeCurrency: {
    name: 'MON',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: [getRpcUrl()],
  blockExplorerUrls: [getExplorerBaseUrl()],
};
