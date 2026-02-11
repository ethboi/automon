import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';
import { logTransaction } from '@/lib/transactions';
import { ethers } from 'ethers';
import { getNftContractAddress, getPackPriceWei, getRpcUrl } from '@/lib/network';
export const dynamic = 'force-dynamic';

const PACK_PURCHASE_EVENT_ABI = [
  'event PackPurchased(address indexed buyer, uint256[] tokenIds)',
];

export async function POST(request: NextRequest) {
  try {
    const { txHash, price, address } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    if (!txHash) {
      return NextResponse.json({ error: 'Transaction hash required' }, { status: 400 });
    }

    const normalizedAddress = address.toLowerCase();
    const contractAddress = getNftContractAddress();
    const rpcUrl = getRpcUrl();

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) {
      return NextResponse.json({ error: 'Transaction not confirmed on-chain' }, { status: 400 });
    }

    if ((receipt.to || '').toLowerCase() !== contractAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Transaction is not for the NFT contract' }, { status: 400 });
    }

    const iface = new ethers.Interface(PACK_PURCHASE_EVENT_ABI);
    const tokenIds: number[] = [];
    let buyerFromEvent: string | null = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue;
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name !== 'PackPurchased') continue;
        buyerFromEvent = String(parsed.args.buyer).toLowerCase();
        tokenIds.push(...(parsed.args.tokenIds as bigint[]).map((id: bigint) => Number(id)));
      } catch {
        // Ignore non-matching logs.
      }
    }

    if (!buyerFromEvent || buyerFromEvent !== normalizedAddress) {
      return NextResponse.json({ error: 'Transaction buyer does not match wallet address' }, { status: 400 });
    }

    if (tokenIds.length === 0) {
      return NextResponse.json({ error: 'No minted cards found in transaction' }, { status: 400 });
    }

    const db = await getDb();

    // Check if pack already created for this transaction
    const existingPack = await db.collection('packs').findOne({ purchaseTxHash: txHash });
    if (existingPack) {
      return NextResponse.json({ pack: existingPack });
    }

    const pack = {
      packId: uuidv4(),
      owner: normalizedAddress,
      purchaseTxHash: txHash,
      price: price || getPackPriceWei(),
      onchainVerified: true,
      onchainTokenIds: tokenIds,
      opened: false,
      cards: [],
      createdAt: new Date(),
      openedAt: null,
    };

    await db.collection('packs').insertOne(pack);

    // Log on-chain transaction
    await logTransaction({
      txHash,
      type: 'mint_pack',
      from: address,
      amount: `${price ? (Number(price) / 1e18).toFixed(2) : '0.10'}`,
      description: `Minted AutoMon card pack`,
      metadata: { packId: pack.packId, price, tokenIds },
    });

    return NextResponse.json({ pack });
  } catch (error) {
    console.error('Buy pack error:', error);
    return NextResponse.json({ error: 'Failed to record pack purchase' }, { status: 500 });
  }
}
