import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { initializeBattleCard } from '@/lib/battle';
import { Card } from '@/lib/types';
import { ObjectId } from 'mongodb';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { battleId, cardIds, address, cardSelectionReasoning } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    if (!battleId || !cardIds || !Array.isArray(cardIds) || cardIds.length !== 3) {
      return NextResponse.json({ error: 'Battle ID and exactly 3 card IDs required' }, { status: 400 });
    }

    const db = await getDb();

    // Verify cards belong to player
    const cards = await db
      .collection('cards')
      .find({
        _id: { $in: cardIds.map((id: string) => new ObjectId(id)) },
        owner: address.toLowerCase(),
      })
      .toArray();

    if (cards.length !== 3) {
      return NextResponse.json({ error: 'Invalid cards selected' }, { status: 400 });
    }

    const battle = await db.collection('battles').findOne({ battleId });

    if (!battle) {
      return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
    }

    // Allow card selection in pending, selecting, or active (if player hasn't selected yet)
    if (battle.status !== 'pending' && battle.status !== 'selecting' && battle.status !== 'active') {
      return NextResponse.json({ error: 'Cannot select cards at this time' }, { status: 400 });
    }

    const isPlayer1 = battle.player1.address.toLowerCase() === address.toLowerCase();
    const isPlayer2 = battle.player2?.address.toLowerCase() === address.toLowerCase();

    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json({ error: 'Not a participant in this battle' }, { status: 403 });
    }

    // Initialize battle cards with currentHp, buffs, debuffs
    const battleCards = cards.map(card => initializeBattleCard(card as unknown as Card));

    const playerField = isPlayer1 ? 'player1' : 'player2';
    const updateQuery: Record<string, unknown> = {
      [`${playerField}.cards`]: battleCards,
      [`${playerField}.ready`]: true,
      ...(cardSelectionReasoning ? { [`${playerField}.cardSelectionReasoning`]: cardSelectionReasoning } : {}),
      updatedAt: new Date(),
    };

    await db.collection('battles').updateOne({ battleId }, { $set: updateQuery });

    // Check if both players are ready
    const updatedBattle = await db.collection('battles').findOne({ battleId });

    if (updatedBattle?.player1.ready && updatedBattle?.player2?.ready) {
      // Set battle to active
      await db.collection('battles').updateOne(
        { battleId },
        {
          $set: {
            status: 'active',
            currentTurn: 0,
            updatedAt: new Date(),
          },
        }
      );

      // Simulation is now handled agent-side (no Vercel timeout).
      // Just return the active battle — agents will detect and simulate.
      console.log(`Battle ${battleId}: both players ready, status=active. Awaiting agent-side simulation.`);
    }

    const finalBattle = await db.collection('battles').findOne({ battleId });

    return NextResponse.json({ battle: finalBattle });
  } catch (error) {
    console.error('Select cards error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to select cards', detail: msg }, { status: 500 });
  }
}
