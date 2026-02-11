import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { logTransaction } from '@/lib/transactions';
import { clampMood, DEFAULT_MOOD, getMoodTier } from '@/lib/agentMood';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { battleId, address, txHash } = await request.json();

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
    const playerAgent = await db.collection('agents').findOne({ address: address.toLowerCase() });
    const p2Mood = clampMood(typeof playerAgent?.mood === 'number' ? playerAgent.mood : DEFAULT_MOOD);

    const result = await db.collection('battles').updateOne(
      { battleId, player2: null },
      {
        $set: {
          player2: {
            address: address.toLowerCase(),
            cards: [],
            activeCardIndex: 0,
            ready: false,
            mood: p2Mood,
            moodLabel: playerAgent?.moodLabel || getMoodTier(p2Mood),
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

    if (txHash) {
      await logTransaction({
        txHash,
        type: 'battle_join',
        from: address,
        description: `Joined battle with ${updatedBattle?.wager || '0'} MON wager`,
        metadata: { battleId, wager: updatedBattle?.wager || '0' },
      });
    }

    return NextResponse.json({ battle: updatedBattle });
  } catch (error) {
    console.error('Join battle error:', error);
    return NextResponse.json({ error: 'Failed to join battle' }, { status: 500 });
  }
}
