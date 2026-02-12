import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    await db.collection('users').updateOne(
      { address: session.address.toLowerCase() },
      {
        $set: { lastSeen: new Date() },
        $setOnInsert: { createdAt: new Date(), address: session.address.toLowerCase() },
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('User presence error:', error);
    return NextResponse.json({ error: 'Failed to update presence' }, { status: 500 });
  }
}

