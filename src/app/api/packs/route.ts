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
    const packs = await db
      .collection('packs')
      .find({ owner: session.address.toLowerCase() })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ packs });
  } catch (error) {
    console.error('Get packs error:', error);
    return NextResponse.json({ error: 'Failed to fetch packs' }, { status: 500 });
  }
}
