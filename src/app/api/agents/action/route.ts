import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { address, action, reason, location } = await request.json();

    if (!address || !action) {
      return NextResponse.json({ error: 'Address and action required' }, { status: 400 });
    }

    const db = await getDb();

    await db.collection('agent_actions').insertOne({
      address: address.toLowerCase(),
      action,
      reason: reason || '',
      location: location || null,
      timestamp: new Date(),
    });

    // Keep only last 100 actions per agent
    const count = await db.collection('agent_actions').countDocuments({
      address: address.toLowerCase()
    });

    if (count > 100) {
      const oldActions = await db.collection('agent_actions')
        .find({ address: address.toLowerCase() })
        .sort({ timestamp: 1 })
        .limit(count - 100)
        .toArray();

      const idsToDelete = oldActions.map(a => a._id);
      await db.collection('agent_actions').deleteMany({
        _id: { $in: idsToDelete }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Log action error:', error);
    return NextResponse.json({ error: 'Failed to log action' }, { status: 500 });
  }
}
