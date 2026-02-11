import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getAgentAuth } from '@/lib/agentAuth';
export const dynamic = 'force-dynamic';

/**
 * Accepts battle simulation results from agents.
 * Agent runs the simulation locally (no Vercel timeout), then POSTs the result here.
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check (agent-secret header)
    const auth = await getAgentAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { battleId, winner, rounds, currentTurn, battleLog } = await request.json();
    if (!battleId || !winner || !battleLog) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('automon');

    // Verify battle exists and is active
    const battle = await db.collection('battles').findOne({ battleId });
    if (!battle) {
      return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
    }
    if (battle.status === 'complete') {
      return NextResponse.json({ message: 'Battle already complete', winner: battle.winner });
    }
    if (battle.status !== 'active') {
      return NextResponse.json({ error: `Battle status is ${battle.status}, not active` }, { status: 400 });
    }

    // Update battle
    await db.collection('battles').updateOne(
      { battleId },
      {
        $set: {
          status: 'complete',
          winner,
          rounds: rounds || [],
          currentTurn: currentTurn || 0,
          updatedAt: new Date(),
        },
      }
    );

    // Save battle log for replay
    await db.collection('battleLogs').updateOne(
      { battleId },
      { $set: { ...battleLog, createdAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ success: true, winner });
  } catch (error) {
    console.error('Save battle result error:', error);
    return NextResponse.json({ error: 'Failed to save result' }, { status: 500 });
  }
}
