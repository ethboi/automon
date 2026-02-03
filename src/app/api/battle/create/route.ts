import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { Battle } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { wager, txHash } = await request.json();

    if (!wager) {
      return NextResponse.json({ error: 'Wager amount required' }, { status: 400 });
    }

    const db = await getDb();
    const battleId = uuidv4();

    const battle: Battle = {
      battleId,
      player1: {
        address: session.address.toLowerCase(),
        cards: [],
        activeCardIndex: 0,
        ready: false,
      },
      player2: null,
      wager,
      status: 'pending',
      currentTurn: 0,
      rounds: [],
      winner: null,
      escrowTxHash: txHash || null,
      settleTxHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('battles').insertOne(battle);

    return NextResponse.json({ battle });
  } catch (error) {
    console.error('Create battle error:', error);
    return NextResponse.json({ error: 'Failed to create battle' }, { status: 500 });
  }
}
