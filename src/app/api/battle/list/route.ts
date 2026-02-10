import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

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
    } else if (type === 'all') {
      query = {};
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
        selectedCards: (battle.player1.cards || []).map((c: { name: string; element: string; rarity?: string }) => ({
          name: c.name,
          element: c.element,
          rarity: c.rarity,
        })),
      },
      player2: battle.player2 ? {
        address: battle.player2.address,
        ready: battle.player2.ready,
        cardCount: battle.player2.cards?.length || 0,
        selectedCards: (battle.player2.cards || []).map((c: { name: string; element: string; rarity?: string }) => ({
          name: c.name,
          element: c.element,
          rarity: c.rarity,
        })),
      } : null,
      lastRound: (battle.rounds || []).length > 0
        ? (() => {
            const r = battle.rounds[battle.rounds.length - 1];
            return {
              turn: r.turn,
              player1Move: r.player1Move
                ? {
                    action: r.player1Move.action,
                    reasoning: r.player1Move.reasoning || null,
                  }
                : null,
              player2Move: r.player2Move
                ? {
                    action: r.player2Move.action,
                    reasoning: r.player2Move.reasoning || null,
                  }
                : null,
              timestamp: r.timestamp,
            };
          })()
        : null,
    }));

    return NextResponse.json({ battles: sanitizedBattles });
  } catch (error) {
    console.error('List battles error:', error);
    return NextResponse.json({ error: 'Failed to fetch battles' }, { status: 500 });
  }
}
