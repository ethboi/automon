/**
 * Launch $AUTOMON token on nad.fun using pure viem.
 * Usage: npx tsx scripts/launch-token.ts
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createToken } from '../agent/trading';

dotenv.config({ path: '.env.local' });
const NETWORK = (process.env.AUTOMON_NETWORK || process.env.NEXT_PUBLIC_AUTOMON_NETWORK || 'testnet').toLowerCase() === 'mainnet'
  ? 'mainnet'
  : 'testnet';

async function main() {
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) { console.error('Missing AGENT_PRIVATE_KEY in .env.local'); process.exit(1); }

  // Optional: load image
  let imageBuffer: Buffer | undefined;
  const imgPath = path.join(__dirname, '..', 'public', 'automon-token.png');
  if (fs.existsSync(imgPath)) {
    imageBuffer = fs.readFileSync(imgPath);
    console.log(`Using token image: ${imgPath}`);
  } else {
    console.log('No token image found at public/automon-token.png — launching without image');
  }

  console.log(`Launching $AUTOMON on nad.fun ${NETWORK}...`);
  const result = await createToken(
    privateKey,
    'AutoMon',
    'AUTOMON',
    'The official token of AutoMon — mint, battle, trade. AI-powered creatures on Monad.',
    imageBuffer,
  );

  if (result) {
    console.log(`\n✅ Token launched!`);
    console.log(`   Address: ${result.tokenAddress}`);
    console.log(`   Tx: ${result.txHash}`);
    console.log(`\n   Add to .env.local: AUTOMON_TOKEN_ADDRESS=${result.tokenAddress}`);
    console.log(`   Add to Vercel: NEXT_PUBLIC_AUTOMON_TOKEN_ADDRESS=${result.tokenAddress}`);
  } else {
    console.log('\n❌ Token launch failed. Check logs above.');
  }
}

main().catch(console.error);
