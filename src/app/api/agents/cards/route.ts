import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    const db = await getDb();
    const cards = await db.collection('cards')
      .find({ owner: address.toLowerCase() })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ cards });
  } catch (error) {
    console.error('List cards error:', error);
    return NextResponse.json({ error: 'Failed to list cards' }, { status: 500 });
  }
}
