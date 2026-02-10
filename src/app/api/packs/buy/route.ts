import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';
import { logTransaction } from '@/lib/transactions';

export async function POST(request: NextRequest) {
  try {
    const { txHash, price, address } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    if (!txHash) {
      return NextResponse.json({ error: 'Transaction hash required' }, { status: 400 });
    }

    const db = await getDb();

    // Check if pack already created for this transaction
    const existingPack = await db.collection('packs').findOne({ purchaseTxHash: txHash });
    if (existingPack) {
      return NextResponse.json({ pack: existingPack });
    }

    const pack = {
      packId: uuidv4(),
      owner: address.toLowerCase(),
      purchaseTxHash: txHash,
      price: price || process.env.NEXT_PUBLIC_PACK_PRICE,
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
      description: `Minted card pack for ${price || '0.1'} MON`,
      metadata: { packId: pack.packId, price },
    });

    return NextResponse.json({ pack });
  } catch (error) {
    console.error('Buy pack error:', error);
    return NextResponse.json({ error: 'Failed to record pack purchase' }, { status: 500 });
  }
}
