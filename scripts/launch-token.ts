/**
 * Launch $AUTOMON token on nad.fun
 * Run: npx tsx scripts/launch-token.ts
 */
import { initSDK, parseEther, formatEther } from '@nadfun/sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load Nexus (admin) wallet
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const RPC_URL = process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY as `0x${string}`;

if (!PRIVATE_KEY) {
  console.error('Missing AGENT_PRIVATE_KEY in .env.local');
  process.exit(1);
}

async function main() {
  console.log('🚀 Launching $AUTOMON on nad.fun testnet...\n');

  const sdk = initSDK({
    rpcUrl: RPC_URL,
    privateKey: PRIVATE_KEY,
    network: 'testnet',
  });

  console.log(`Wallet: ${sdk.account.address}`);

  // Check balance
  const balance = await sdk.publicClient.getBalance({ address: sdk.account.address });
  console.log(`Balance: ${formatEther(balance)} MON`);

  if (balance < parseEther('0.6')) {
    console.error('Need at least 0.6 MON (0.5 initial buy + gas)');
    process.exit(1);
  }

  // Use the favicon as a simple logo, or generate a placeholder
  let imageBuffer: Buffer;
  const logoPath = path.resolve(__dirname, '../public/automon-logo.png');
  if (fs.existsSync(logoPath)) {
    imageBuffer = fs.readFileSync(logoPath);
    console.log('Using existing logo');
  } else {
    // Create a simple 256x256 purple square as placeholder
    // For a real launch, replace with actual logo
    console.log('No logo found at public/automon-logo.png');
    console.log('Please add a logo image and re-run.');
    console.log('Expected path:', logoPath);
    process.exit(1);
  }

  console.log('\nCreating token...');
  const result = await sdk.createToken({
    name: 'CryptoClash',
    symbol: 'CLASH',
    description: 'The token of CryptoClash — autonomous AI creature battles on Monad. Three AI agents trade it, battle for it, and trash talk about it. gotta mint em all 🎮⚔️',
    image: imageBuffer,
    imageContentType: 'image/png',
    website: 'https://automon.xyz',
    // initialBuyAmount: parseEther('0.5'), // Need ~10.5 MON total (deploy fee + buy)
  });

  console.log('\n✅ Token launched!');
  console.log(`Token Address: ${result.tokenAddress}`);
  console.log(`Pool Address: ${result.poolAddress}`);
  console.log(`Tx Hash: ${result.transactionHash}`);
  console.log(`Image URI: ${result.imageUri}`);
  console.log(`Metadata URI: ${result.metadataUri}`);
  console.log(`Salt: ${result.salt}`);

  console.log('\n📝 Add to your .env files:');
  console.log(`AUTOMON_TOKEN_ADDRESS=${result.tokenAddress}`);

  // Also write to a file for easy reference
  fs.writeFileSync(
    path.resolve(__dirname, '../.token-launch.json'),
    JSON.stringify({
      tokenAddress: result.tokenAddress,
      poolAddress: result.poolAddress,
      transactionHash: result.transactionHash,
      imageUri: result.imageUri,
      metadataUri: result.metadataUri,
      launchedAt: new Date().toISOString(),
      launchedBy: sdk.account.address,
    }, null, 2)
  );
  console.log('Saved to .token-launch.json');
}

main().catch(err => {
  console.error('Launch failed:', err);
  process.exit(1);
});
