import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const db = await getDb();
    const query = status ? { status } : {};

    const tournaments = await db
      .collection('tournaments')
      .find(query)
      .sort({ startAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({ tournaments });
  } catch (error) {
    console.error('List tournaments error:', error);
    return NextResponse.json({ error: 'Failed to fetch tournaments' }, { status: 500 });
  }
}
