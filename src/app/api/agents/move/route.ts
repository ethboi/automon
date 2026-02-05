import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const { address, position } = await request.json();

    if (!address || !position) {
      return NextResponse.json({ error: 'Address and position required' }, { status: 400 });
    }

    const db = await getDb();

    await db.collection('agents').updateOne(
      { address: address.toLowerCase() },
      {
        $set: {
          position,
          lastSeen: new Date(),
        }
      }
    );

    return NextResponse.json({ success: true, position });
  } catch (error) {
    console.error('Agent move error:', error);
    return NextResponse.json({ error: 'Failed to update position' }, { status: 500 });
  }
}
