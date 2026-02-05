import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET() {
  try {
    const db = await getDb();

    // Get agents seen in last 30 seconds
    const thirtySecondsAgo = new Date(Date.now() - 30000);

    const agents = await db.collection('agents')
      .find({ lastSeen: { $gte: thirtySecondsAgo } })
      .toArray();

    return NextResponse.json({
      agents: agents.map(a => ({
        address: a.address,
        name: a.name,
        personality: a.personality,
        isAI: a.isAI,
        position: a.position,
      }))
    });
  } catch (error) {
    console.error('Get online agents error:', error);
    return NextResponse.json({ error: 'Failed to get agents' }, { status: 500 });
  }
}
