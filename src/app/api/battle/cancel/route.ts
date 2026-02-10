import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';


export async function POST(request: NextRequest) {
  try {
    const { battleId, address } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    if (!battleId) {
      return NextResponse.json({ error: 'Battle ID required' }, { status: 400 });
    }

    const db = await getDb();
    const battle = await db.collection('battles').findOne({ battleId });

    if (!battle) {
      return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
    }

    if (battle.player1.address.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json({ error: 'Only creator can cancel' }, { status: 403 });
    }

    if (battle.status !== 'pending') {
      return NextResponse.json({ error: 'Can only cancel pending battles' }, { status: 400 });
    }

    await db.collection('battles').updateOne(
      { battleId },
      {
        $set: {
          status: 'cancelled',
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cancel battle error:', error);
    return NextResponse.json({ error: 'Failed to cancel battle' }, { status: 500 });
  }
}
