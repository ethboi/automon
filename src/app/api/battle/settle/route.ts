export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const { battleId, settleTxHash, winner, wager } = await request.json();
    if (!battleId || !settleTxHash) {
      return NextResponse.json({ error: 'Missing battleId or settleTxHash' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('automon');
    
    await db.collection('battles').updateOne(
      { battleId },
      { $set: { settleTxHash } }
    );

    // Log to transactions for Chain tab
    if (winner && wager) {
      const payout = (Number(wager) * 2 * 0.95).toFixed(4);
      await db.collection('transactions').insertOne({
        type: 'battle_settle',
        txHash: settleTxHash,
        from: winner,
        description: 'Battle won! Payout received',
        metadata: { battleId, wager: payout },
        timestamp: new Date(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settle error:', error);
    return NextResponse.json({ error: 'Failed to update settlement' }, { status: 500 });
  }
}
