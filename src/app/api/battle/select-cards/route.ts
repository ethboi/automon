import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';
import { initializeBattleCard } from '@/lib/battle';
import { Card } from '@/lib/types';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { battleId, cardIds } = await request.json();

    if (!battleId || !cardIds || !Array.isArray(cardIds) || cardIds.length !== 3) {
      return NextResponse.json({ error: 'Battle ID and exactly 3 card IDs required' }, { status: 400 });
    }

    const db = await getDb();

    // Verify cards belong to player
    const cards = await db
      .collection('cards')
      .find({
        _id: { $in: cardIds.map((id: string) => new ObjectId(id)) },
        owner: session.address.toLowerCase(),
      })
      .toArray();

    if (cards.length !== 3) {
      return NextResponse.json({ error: 'Invalid cards selected' }, { status: 400 });
    }

    const battle = await db.collection('battles').findOne({ battleId });

    if (!battle) {
      return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
    }

    // Allow card selection in 'pending' (for player1) or 'selecting' (both players)
    if (battle.status !== 'pending' && battle.status !== 'selecting') {
      return NextResponse.json({ error: 'Cannot select cards at this time' }, { status: 400 });
    }

    const isPlayer1 = battle.player1.address.toLowerCase() === session.address.toLowerCase();
    const isPlayer2 = battle.player2?.address.toLowerCase() === session.address.toLowerCase();

    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json({ error: 'Not a participant in this battle' }, { status: 403 });
    }

    // Initialize battle cards with currentHp, buffs, debuffs
    const battleCards = cards.map(card => initializeBattleCard(card as unknown as Card));

    const playerField = isPlayer1 ? 'player1' : 'player2';
    const updateQuery: Record<string, unknown> = {
      [`${playerField}.cards`]: battleCards,
      [`${playerField}.ready`]: true,
      updatedAt: new Date(),
    };

    await db.collection('battles').updateOne({ battleId }, { $set: updateQuery });

    // Check if both players are ready
    const updatedBattle = await db.collection('battles').findOne({ battleId });

    if (updatedBattle?.player1.ready && updatedBattle?.player2?.ready) {
      await db.collection('battles').updateOne(
        { battleId },
        {
          $set: {
            status: 'active',
            currentTurn: 1,
            updatedAt: new Date(),
          },
        }
      );
    }

    const finalBattle = await db.collection('battles').findOne({ battleId });

    return NextResponse.json({ battle: finalBattle });
  } catch (error) {
    console.error('Select cards error:', error);
    return NextResponse.json({ error: 'Failed to select cards' }, { status: 500 });
  }
}
