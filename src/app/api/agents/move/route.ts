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

    const { address, position, name, activity, balance, tokenBalance } = await request.json();

    if (!address || !position) {
      return NextResponse.json({ error: 'Address and position required' }, { status: 400 });
    }

    const db = await getDb();

    const updateFields: Record<string, unknown> = {
      position,
      lastSeen: new Date(),
    };

    if (name) updateFields.name = name;
    if (activity) updateFields.currentAction = activity;
    if (balance) updateFields.balance = balance;
    if (tokenBalance !== undefined) updateFields.tokenBalance = tokenBalance;

    await db.collection('agents').updateOne(
      { address: address.toLowerCase() },
      { $set: updateFields }
    );

    return NextResponse.json({ success: true, position });
  } catch (error) {
    console.error('Agent move error:', error);
    return NextResponse.json({ error: 'Failed to update position' }, { status: 500 });
  }
}
