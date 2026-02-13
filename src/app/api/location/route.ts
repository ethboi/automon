import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  const location = req.nextUrl.searchParams.get('name');
  if (!location) return NextResponse.json({ error: 'Missing name param' }, { status: 400 });

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 100);
  const client = await clientPromise;
  const db = client.db('automon');

  const [actions, chat] = await Promise.all([
    db.collection('agent_actions')
      .find({ location })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray(),

    db.collection('chat')
      .find({ location })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray(),
  ]);

  return NextResponse.json({
    actions: actions.map(a => ({
      agent: a.agent,
      action: a.action,
      reason: a.reason || a.reasoning || '',
      location: a.location,
      timestamp: a.timestamp,
      healthDelta: a.healthDelta,
      moodDelta: a.moodDelta,
    })),
    chat: chat.reverse().map(c => ({
      fromName: c.fromName || c.from,
      message: c.message,
      location: c.location,
      timestamp: c.timestamp,
    })),
  });
}
