import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const network = (process.env.AUTOMON_NETWORK || process.env.NEXT_PUBLIC_AUTOMON_NETWORK || 'testnet').toLowerCase() === 'mainnet'
  ? 'mainnet'
  : 'testnet';

function val(key: string): string {
  return (process.env[key] || '').trim();
}

function required(keys: string[]): string[] {
  return keys.filter((k) => !val(k));
}

if (network !== 'mainnet') {
  console.error('Preflight expects AUTOMON_NETWORK=mainnet in .env.local');
  process.exit(1);
}

if (val('AUTOMON_NETWORK').toLowerCase() !== 'mainnet') {
  console.error('AUTOMON_NETWORK must be set to mainnet');
  process.exit(1);
}

if (val('NEXT_PUBLIC_AUTOMON_NETWORK').toLowerCase() !== 'mainnet') {
  console.error('NEXT_PUBLIC_AUTOMON_NETWORK must be set to mainnet');
  process.exit(1);
}

const missing = required([
  'MONAD_RPC_URL_MAINNET',
  'NEXT_PUBLIC_MONAD_RPC_MAINNET',
  'NEXT_PUBLIC_CHAIN_ID_MAINNET',
  'ESCROW_CONTRACT_ADDRESS_MAINNET',
  'AUTOMON_NFT_ADDRESS_MAINNET',
  'ADMIN_PRIVATE_KEY_MAINNET',
  'DEPLOYER_PRIVATE_KEY_MAINNET',
  'NEXT_PUBLIC_BLOCK_EXPLORER_URL_MAINNET',
  'NAD_BONDING_CURVE_ROUTER_MAINNET',
  'NAD_LENS_MAINNET',
  'NAD_CURVE_MAINNET',
  'NAD_WMON_MAINNET',
]);

const chainId = val('NEXT_PUBLIC_CHAIN_ID_MAINNET');
if (chainId && chainId !== '143') {
  console.error(`NEXT_PUBLIC_CHAIN_ID_MAINNET should be 143, got: ${chainId}`);
  process.exit(1);
}

if (missing.length) {
  console.error('Missing required mainnet keys:');
  for (const key of missing) console.error(`- ${key}`);
  process.exit(1);
}

console.log('Mainnet preflight OK.');
