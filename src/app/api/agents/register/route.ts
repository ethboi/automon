import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { address, name, personality } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    const db = await getDb();

    const agent = {
      address: address.toLowerCase(),
      name: name || `Agent ${address.slice(0, 6)}`,
      personality: personality || 'friendly',
      isAI: true,
      position: { x: 0, y: 0, z: 8 },
      lastSeen: new Date(),
    };

    await db.collection('agents').updateOne(
      { address: address.toLowerCase() },
      { $set: agent },
      { upsert: true }
    );

    return NextResponse.json({ success: true, agent });
  } catch (error) {
    console.error('Agent register error:', error);
    return NextResponse.json({ error: 'Failed to register agent' }, { status: 500 });
  }
}
