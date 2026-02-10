import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const address = searchParams.get('address');

    const db = await getDb();
    let query: Record<string, unknown> = {};

    // If type=my, fetch user's battles
    if (type === 'my' && address) {
      query = {
        $or: [
          { 'player1.address': address.toLowerCase() },
          { 'player2.address': address.toLowerCase() },
        ],
      };
    } else if (status) {
      query.status = status;
    } else {
      // Default: show pending battles
      query.status = 'pending';
    }

    const battles = await db
      .collection('battles')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    // Remove sensitive card data from listings
    const sanitizedBattles = battles.map(battle => ({
      ...battle,
      player1: {
        address: battle.player1.address,
        ready: battle.player1.ready,
        cardCount: battle.player1.cards?.length || 0,
      },
      player2: battle.player2 ? {
        address: battle.player2.address,
        ready: battle.player2.ready,
        cardCount: battle.player2.cards?.length || 0,
      } : null,
    }));

    return NextResponse.json({ battles: sanitizedBattles });
  } catch (error) {
    console.error('List battles error:', error);
    return NextResponse.json({ error: 'Failed to fetch battles' }, { status: 500 });
  }
}
