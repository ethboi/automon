import { createWalletClient, createPublicClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { monad } from 'viem/chains';

const ADMIN_KEY = process.env.ADMIN_PRIVATE_KEY as `0x${string}` | undefined;
const ESCROW = '0x5191e3fac06225A61beE01d1BA5E779904b7C4bD' as const;
const NFT = '0x46A77fF689773B637A4af9D131e7E9f99eDc9B58' as const;

const AGENTS = [
  { name: 'Nexus', address: '0xe13158E35A179bf274D169818a42A26AED8eB037' as const },
  { name: 'Atlas', address: '0x3f4FCafb612d624B45DaE55Ad2b39F03D28EE18C' as const },
  { name: 'Pyre', address: '0x4F40daff39da6D266362b365C335749655eC7fd2' as const },
];

const withdrawAbi = [{ type: 'function', name: 'withdraw', inputs: [], outputs: [], stateMutability: 'nonpayable' }] as const;

async function main() {
  if (!ADMIN_KEY) {
    throw new Error('ADMIN_PRIVATE_KEY is required');
  }

  const account = privateKeyToAccount(ADMIN_KEY);
  const transport = http('https://rpc.monad.xyz');

  const publicClient = createPublicClient({ chain: monad, transport });
  const walletClient = createWalletClient({ account, chain: monad, transport });

  console.log(`Admin: ${account.address}`);

  // Check balances before
  const escrowBal = await publicClient.getBalance({ address: ESCROW });
  const nftBal = await publicClient.getBalance({ address: NFT });
  console.log(`\nEscrow balance: ${formatEther(escrowBal)} MON`);
  console.log(`NFT balance: ${formatEther(nftBal)} MON`);

  // Withdraw from Escrow
  if (escrowBal > BigInt(0)) {
    console.log('\nWithdrawing from Escrow...');
    const tx1 = await walletClient.writeContract({ address: ESCROW, abi: withdrawAbi, functionName: 'withdraw' });
    console.log(`Escrow withdraw tx: ${tx1}`);
    await publicClient.waitForTransactionReceipt({ hash: tx1 });
    console.log('Escrow withdraw confirmed ✅');
  }

  // Withdraw from NFT
  if (nftBal > BigInt(0)) {
    console.log('\nWithdrawing from NFT...');
    const tx2 = await walletClient.writeContract({ address: NFT, abi: withdrawAbi, functionName: 'withdraw' });
    console.log(`NFT withdraw tx: ${tx2}`);
    await publicClient.waitForTransactionReceipt({ hash: tx2 });
    console.log('NFT withdraw confirmed ✅');
  }

  // Check admin balance after withdrawals
  const adminBal = await publicClient.getBalance({ address: account.address });
  console.log(`\nAdmin balance after withdrawals: ${formatEther(adminBal)} MON`);

  // Keep some for gas, distribute the rest equally
  const gasReserve = parseEther('1');
  const distributable = adminBal - gasReserve;
  const perAgent = distributable / BigInt(3);

  console.log(`\nDistributing ${formatEther(perAgent)} MON to each agent...`);

  for (const agent of AGENTS) {
    const currentBal = await publicClient.getBalance({ address: agent.address });
    console.log(`\n${agent.name} (${agent.address})`);
    console.log(`  Current: ${formatEther(currentBal)} MON`);

    const tx = await walletClient.sendTransaction({ to: agent.address, value: perAgent });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    
    const newBal = await publicClient.getBalance({ address: agent.address });
    console.log(`  Sent: ${formatEther(perAgent)} MON (tx: ${tx})`);
    console.log(`  New balance: ${formatEther(newBal)} MON ✅`);
  }

  const finalAdmin = await publicClient.getBalance({ address: account.address });
  console.log(`\nAdmin remaining: ${formatEther(finalAdmin)} MON`);
  console.log('Done! 🎉');
}

main().catch(console.error);
