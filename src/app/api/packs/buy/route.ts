import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { txHash, price } = await request.json();

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
      owner: session.address.toLowerCase(),
      purchaseTxHash: txHash,
      price: price || process.env.NEXT_PUBLIC_PACK_PRICE,
      opened: false,
      cards: [],
      createdAt: new Date(),
      openedAt: null,
    };

    await db.collection('packs').insertOne(pack);

    return NextResponse.json({ pack });
  } catch (error) {
    console.error('Buy pack error:', error);
    return NextResponse.json({ error: 'Failed to record pack purchase' }, { status: 500 });
  }
}
