import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAgentAuth } from '@/lib/agentAuth';
export const dynamic = 'force-dynamic';

/**
 * Card sync endpoint — agent sends fully-formed card objects (read from chain locally).
 * We just upsert them into MongoDB by tokenId.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAgentAuth(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { cards } = await request.json();

    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({ error: 'cards array required' }, { status: 400 });
    }

    const db = await getDb();
    let synced = 0;

    const requester = session.address.toLowerCase();
    const ops = cards.map((card: { tokenId: number; owner: string }) => {
      if (!card.owner || card.owner.toLowerCase() !== requester) {
        throw new Error('Card owner does not match authenticated agent');
      }
      return ({
      updateOne: {
        filter: { tokenId: card.tokenId },
        update: { $setOnInsert: { ...card, createdAt: new Date() } },
        upsert: true,
      },
      }
    )});

    const result = await db.collection('cards').bulkWrite(ops);
    synced = result.upsertedCount;

    return NextResponse.json({ synced, total: cards.length });
  } catch (error) {
    console.error('Sync cards error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to sync cards', detail: msg }, { status: 500 });
  }
}
