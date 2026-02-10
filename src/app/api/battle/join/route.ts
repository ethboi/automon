import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { battleId, address } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    if (!battleId) {
      return NextResponse.json({ error: 'Battle ID required' }, { status: 400 });
    }

    const db = await getDb();
    const battle = await db.collection('battles').findOne({ battleId });

    if (!battle) {
      return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
    }

    if (battle.status !== 'pending') {
      return NextResponse.json({ error: 'Battle not available' }, { status: 400 });
    }

    if (battle.player1.address.toLowerCase() === address.toLowerCase()) {
      return NextResponse.json({ error: 'Cannot join your own battle' }, { status: 400 });
    }

    if (battle.player2) {
      return NextResponse.json({ error: 'Battle already has two players' }, { status: 400 });
    }

    const result = await db.collection('battles').updateOne(
      { battleId, player2: null },
      {
        $set: {
          player2: {
            address: address.toLowerCase(),
            cards: [],
            activeCardIndex: 0,
            ready: false,
          },
          status: 'selecting',
          updatedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: 'Failed to join battle' }, { status: 400 });
    }

    const updatedBattle = await db.collection('battles').findOne({ battleId });

    return NextResponse.json({ battle: updatedBattle });
  } catch (error) {
    console.error('Join battle error:', error);
    return NextResponse.json({ error: 'Failed to join battle' }, { status: 500 });
  }
}
