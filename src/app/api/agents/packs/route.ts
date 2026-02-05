import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';

// GET - List packs for an agent
export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    const db = await getDb();
    const packs = await db.collection('packs')
      .find({ owner: address.toLowerCase() })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ packs });
  } catch (error) {
    console.error('List packs error:', error);
    return NextResponse.json({ error: 'Failed to list packs' }, { status: 500 });
  }
}

// POST - Buy a pack for an agent
export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    const db = await getDb();

    // Verify agent exists
    const agent = await db.collection('agents').findOne({
      address: address.toLowerCase()
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Create a mock transaction hash for the agent
    const txHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');

    const pack = {
      packId: uuidv4(),
      owner: address.toLowerCase(),
      purchaseTxHash: txHash,
      price: process.env.NEXT_PUBLIC_PACK_PRICE || '100000000000000000',
      opened: false,
      cards: [],
      createdAt: new Date(),
      openedAt: null,
    };

    await db.collection('packs').insertOne(pack);

    return NextResponse.json({ pack });
  } catch (error) {
    console.error('Buy pack error:', error);
    return NextResponse.json({ error: 'Failed to buy pack' }, { status: 500 });
  }
}
