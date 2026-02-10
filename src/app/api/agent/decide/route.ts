import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
export const dynamic = 'force-dynamic';

import { getAgentDecision } from '@/lib/agent';
import { Battle } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { battleId, address } = await request.json();

    if (!battleId) {
      return NextResponse.json({ error: 'Battle ID required' }, { status: 400 });
    }

    const db = await getDb();
    const battle = await db.collection('battles').findOne({ battleId }) as Battle | null;

    if (!battle) {
      return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
    }

    const isParticipant =
      battle.player1.address.toLowerCase() === address.toLowerCase() ||
      battle.player2?.address.toLowerCase() === address.toLowerCase();

    if (!isParticipant) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    if (battle.status !== 'active') {
      return NextResponse.json({ error: 'Battle not active' }, { status: 400 });
    }

    const decision = await getAgentDecision(battle, address);

    return NextResponse.json({ decision });
  } catch (error) {
    console.error('Agent decide error:', error);
    return NextResponse.json({ error: 'Failed to get AI decision' }, { status: 500 });
  }
}
