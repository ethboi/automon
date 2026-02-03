import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    const cards = await db
      .collection('cards')
      .find({ owner: session.address.toLowerCase() })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ cards });
  } catch (error) {
    console.error('Get cards error:', error);
    return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 });
  }
}
