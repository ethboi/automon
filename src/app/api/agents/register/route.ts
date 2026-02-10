import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAgentAuth } from '@/lib/agentAuth';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getAgentAuth(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { address, name, personality, isAI } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    const db = await getDb();

    const normalizedAddress = address.toLowerCase();
    const existing = await db.collection('agents').findOne({ address: normalizedAddress });

    const agent = {
      address: normalizedAddress,
      name: name || existing?.name || `Agent ${address.slice(0, 6)}`,
      personality: personality || existing?.personality || 'friendly',
      isAI: typeof isAI === 'boolean' ? isAI : (existing?.isAI ?? true),
      position: existing?.position || { x: 0, y: 0, z: 8 },
      health: typeof existing?.health === 'number' ? existing.health : 100,
      maxHealth: typeof existing?.maxHealth === 'number' ? existing.maxHealth : 100,
      currentAction: existing?.currentAction || 'wandering',
      currentReason: existing?.currentReason || 'Exploring the world',
      currentLocation: existing?.currentLocation || 'Starter Town',
      createdAt: existing?.createdAt || new Date(),
      lastSeen: new Date(),
    };

    await db.collection('agents').updateOne(
      { address: normalizedAddress },
      { $set: agent },
      { upsert: true }
    );

    return NextResponse.json({ success: true, agent });
  } catch (error) {
    console.error('Agent register error:', error);
    return NextResponse.json({ error: 'Failed to register agent' }, { status: 500 });
  }
}
