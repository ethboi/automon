export type AutomonNetwork = 'testnet' | 'mainnet';

const DEFAULT_TESTNET_RPC = 'https://testnet-rpc.monad.xyz';
const DEFAULT_TESTNET_CHAIN_ID = 10143;
const DEFAULT_TESTNET_EXPLORER = 'https://testnet.monadexplorer.com';

export function getAutomonNetwork(): AutomonNetwork {
  const raw = (process.env.AUTOMON_NETWORK || process.env.NEXT_PUBLIC_AUTOMON_NETWORK || 'testnet').toLowerCase();
  return raw === 'mainnet' ? 'mainnet' : 'testnet';
}

function getNetworkSuffix(network: AutomonNetwork): string {
  return network === 'mainnet' ? 'MAINNET' : 'TESTNET';
}

function envForNetwork(baseKey: string, network: AutomonNetwork): string | undefined {
  const suffix = getNetworkSuffix(network);
  const val = process.env[`${baseKey}_${suffix}`] || process.env[baseKey];
  return val?.trim();
}

export function getRpcUrl(): string {
  const network = getAutomonNetwork();
  const value = envForNetwork('MONAD_RPC_URL', network) || envForNetwork('NEXT_PUBLIC_MONAD_RPC', network);
  if (value) return value;
  if (network === 'testnet') return DEFAULT_TESTNET_RPC;
  throw new Error('MONAD_RPC_URL_MAINNET (or NEXT_PUBLIC_MONAD_RPC_MAINNET) is required when AUTOMON_NETWORK=mainnet');
}

export function getChainId(): number {
  const network = getAutomonNetwork();
  const raw = envForNetwork('NEXT_PUBLIC_CHAIN_ID', network);
  if (raw) return Number(raw);
  if (network === 'testnet') return DEFAULT_TESTNET_CHAIN_ID;
  throw new Error('NEXT_PUBLIC_CHAIN_ID_MAINNET is required when AUTOMON_NETWORK=mainnet');
}

export function getEscrowContractAddress(): string {
  const network = getAutomonNetwork();
  const value = envForNetwork('ESCROW_CONTRACT_ADDRESS', network) || envForNetwork('NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS', network);
  if (!value) throw new Error(`ESCROW_CONTRACT_ADDRESS_${getNetworkSuffix(network)} is not configured`);
  return value;
}

export function getNftContractAddress(): string {
  const network = getAutomonNetwork();
  const value =
    envForNetwork('AUTOMON_NFT_ADDRESS', network) ||
    envForNetwork('NEXT_PUBLIC_AUTOMON_NFT_ADDRESS', network) ||
    envForNetwork('NEXT_PUBLIC_NFT_CONTRACT_ADDRESS', network);
  if (!value) throw new Error(`AUTOMON_NFT_ADDRESS_${getNetworkSuffix(network)} is not configured`);
  return value;
}

export function getTokenContractAddress(): string {
  const network = getAutomonNetwork();
  const value = envForNetwork('AUTOMON_TOKEN_ADDRESS', network) || envForNetwork('NEXT_PUBLIC_AUTOMON_TOKEN_ADDRESS', network);
  if (!value) throw new Error(`AUTOMON_TOKEN_ADDRESS_${getNetworkSuffix(network)} is not configured`);
  return value;
}

export function getAdminPrivateKey(): string {
  const network = getAutomonNetwork();
  const value = envForNetwork('ADMIN_PRIVATE_KEY', network);
  if (!value) throw new Error(`ADMIN_PRIVATE_KEY_${getNetworkSuffix(network)} is not configured`);
  return value;
}

export function getPackPriceWei(): string {
  const network = getAutomonNetwork();
  return envForNetwork('NEXT_PUBLIC_PACK_PRICE', network) || process.env.NEXT_PUBLIC_PACK_PRICE || '100000000000000000';
}

export function getExplorerBaseUrl(): string {
  const network = getAutomonNetwork();
  const value = envForNetwork('NEXT_PUBLIC_BLOCK_EXPLORER_URL', network) || envForNetwork('BLOCK_EXPLORER_URL', network);
  if (value) return value;
  if (network === 'testnet') return DEFAULT_TESTNET_EXPLORER;
  throw new Error('NEXT_PUBLIC_BLOCK_EXPLORER_URL_MAINNET (or BLOCK_EXPLORER_URL_MAINNET) is required when AUTOMON_NETWORK=mainnet');
}
