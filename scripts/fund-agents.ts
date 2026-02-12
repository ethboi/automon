/**
 * Fund new agent wallets from the main agent wallet.
 * Run: npx ts-node scripts/fund-agents.ts
 */
import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const NETWORK = (process.env.AUTOMON_NETWORK || process.env.NEXT_PUBLIC_AUTOMON_NETWORK || 'testnet').toLowerCase() === 'mainnet'
  ? 'mainnet'
  : 'testnet';
const SUFFIX = NETWORK === 'mainnet' ? 'MAINNET' : 'TESTNET';
const RPC =
  process.env[`MONAD_RPC_URL_${SUFFIX}`] ||
  process.env[`NEXT_PUBLIC_MONAD_RPC_${SUFFIX}`] ||
  (NETWORK === 'testnet' ? (process.env.MONAD_RPC_URL || process.env.NEXT_PUBLIC_MONAD_RPC || 'https://testnet-rpc.monad.xyz') : '');
const MAIN_AGENT_KEY = process.env.AGENT_PRIVATE_KEY!;

if (!RPC) {
  throw new Error('MONAD_RPC_URL_MAINNET (or NEXT_PUBLIC_MONAD_RPC_MAINNET) is required when AUTOMON_NETWORK=mainnet');
}

const NEW_AGENTS = [
  { name: 'Kira 🌙 (Collector)', address: '0xEf86E433E13C3D898b2e730F87667f81e0619AeC' },
  { name: 'Sage 🌿 (Farmer)', address: '0x8BEb4B395D5F1F53Bb51964228E3D4cBF8b3ac22' },
];

const AMOUNT = ethers.parseEther('0.5');

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(MAIN_AGENT_KEY, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Main agent (${wallet.address}): ${ethers.formatEther(balance)} MON`);

  for (const agent of NEW_AGENTS) {
    console.log(`\nSending 0.5 MON to ${agent.name} (${agent.address})...`);
    const tx = await wallet.sendTransaction({
      to: agent.address,
      value: AMOUNT,
    });
    console.log(`  TX: ${tx.hash}`);
    await tx.wait();
    console.log(`  Confirmed ✅`);
  }

  console.log('\nDone! New agent balances:');
  for (const agent of NEW_AGENTS) {
    const bal = await provider.getBalance(agent.address);
    console.log(`  ${agent.name}: ${ethers.formatEther(bal)} MON`);
  }
}

main().catch(console.error);
