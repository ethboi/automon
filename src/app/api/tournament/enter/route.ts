import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';


export async function POST(request: NextRequest) {
  try {
    const { tournamentId, address } = await request.json();


    

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

    if (tournament.participants.includes(address.toLowerCase())) {
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
        $push: { participants: address.toLowerCase() } as any,
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
