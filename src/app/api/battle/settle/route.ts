export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const { battleId, settleTxHash } = await request.json();
    if (!battleId || !settleTxHash) {
      return NextResponse.json({ error: 'Missing battleId or settleTxHash' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('automon');
    
    await db.collection('battles').updateOne(
      { battleId },
      { $set: { settleTxHash } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settle error:', error);
    return NextResponse.json({ error: 'Failed to update settlement' }, { status: 500 });
  }
}
