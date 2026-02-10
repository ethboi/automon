import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAgentAuth } from '@/lib/agentAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getAgentAuth(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { battleId } = await request.json();
    if (!battleId) return NextResponse.json({ error: 'battleId required' }, { status: 400 });

    const db = await getDb();
    const result = await db.collection('battles').updateOne(
      { battleId, status: { $in: ['pending', 'active'] } },
      { $set: { status: 'cancelled', cancelledAt: new Date(), cancelReason: 'agent-restart' } }
    );

    return NextResponse.json({ success: true, modified: result.modifiedCount });
  } catch (error) {
    console.error('Cancel battle error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
