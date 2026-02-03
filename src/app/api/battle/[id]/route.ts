import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: battleId } = await params;
    const session = await getSession();

    const db = await getDb();
    const battle = await db.collection('battles').findOne({ battleId });

    if (!battle) {
      return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
    }

    // If user is not a participant, hide card details during active battle
    const isParticipant = session && (
      battle.player1.address.toLowerCase() === session.address.toLowerCase() ||
      battle.player2?.address.toLowerCase() === session.address.toLowerCase()
    );

    if (!isParticipant && battle.status === 'active') {
      // Hide opponent's cards for spectators during active battle
      return NextResponse.json({
        battle: {
          ...battle,
          player1: {
            ...battle.player1,
            cards: battle.player1.cards.map((c: { name: string; element: string; currentHp: number; stats: { maxHp: number } }) => ({
              name: c.name,
              element: c.element,
              currentHp: c.currentHp,
              stats: { maxHp: c.stats.maxHp },
            })),
          },
          player2: battle.player2 ? {
            ...battle.player2,
            cards: battle.player2.cards.map((c: { name: string; element: string; currentHp: number; stats: { maxHp: number } }) => ({
              name: c.name,
              element: c.element,
              currentHp: c.currentHp,
              stats: { maxHp: c.stats.maxHp },
            })),
          } : null,
        },
      });
    }

    return NextResponse.json({ battle });
  } catch (error) {
    console.error('Get battle error:', error);
    return NextResponse.json({ error: 'Failed to fetch battle' }, { status: 500 });
  }
}
