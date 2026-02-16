import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAgentAuth } from '@/lib/agentAuth';
import { getSession } from '@/lib/auth';
export const dynamic = 'force-dynamic';


export async function POST(request: NextRequest) {
  try {
    const { tournamentId, address } = await request.json();
    const normalizedBodyAddress = typeof address === 'string' ? address.toLowerCase() : '';
    const session = await getSession();
    const agentAuth = await getAgentAuth(request);
    const authAddress = session?.address || agentAuth?.address;
    const effectiveAddress = authAddress || normalizedBodyAddress;

    if (!authAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (normalizedBodyAddress && normalizedBodyAddress !== authAddress) {
      return NextResponse.json({ error: 'Address does not match authenticated user' }, { status: 403 });
    }

    if (!tournamentId) {
      return NextResponse.json({ error: 'Tournament ID required' }, { status: 400 });
    }

    const db = await getDb();
    const tournament = await db.collection('tournaments').findOne({ tournamentId });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    if (tournament.status !== 'registration') {
      return NextResponse.json({ error: 'Registration closed' }, { status: 400 });
    }

    if (tournament.participants.length >= tournament.maxParticipants) {
      return NextResponse.json({ error: 'Tournament full' }, { status: 400 });
    }

    if (tournament.participants.includes(effectiveAddress.toLowerCase())) {
      return NextResponse.json({ error: 'Already registered' }, { status: 400 });
    }

    // Calculate new prize pool
    const currentPool = BigInt(tournament.prizePool || '0');
    const entryFee = BigInt(tournament.entryFee);
    const newPool = currentPool + entryFee;

    const result = await db.collection('tournaments').updateOne(
      {
        tournamentId,
        status: 'registration',
        [`participants.${tournament.maxParticipants - 1}`]: { $exists: false },
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        $push: { participants: effectiveAddress.toLowerCase() } as any,
        $set: {
          prizePool: newPool.toString(),
        },
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: 'Failed to register' }, { status: 400 });
    }

    const updatedTournament = await db.collection('tournaments').findOne({ tournamentId });

    return NextResponse.json({ tournament: updatedTournament });
  } catch (error) {
    console.error('Enter tournament error:', error);
    return NextResponse.json({ error: 'Failed to enter tournament' }, { status: 500 });
  }
}
