import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
export const dynamic = 'force-dynamic';

import { v4 as uuidv4 } from 'uuid';
import { Tournament } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    


    const { name, entryFee, maxParticipants, startAt } = await request.json();

    if (!name || !entryFee || !maxParticipants) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (maxParticipants !== 8 && maxParticipants !== 16) {
      return NextResponse.json({ error: 'Max participants must be 8 or 16' }, { status: 400 });
    }

    const db = await getDb();
    const tournamentId = uuidv4();

    const tournament: Tournament = {
      tournamentId,
      name,
      entryFee,
      prizePool: '0',
      maxParticipants,
      participants: [],
      bracket: [],
      status: 'registration',
      winner: null,
      startAt: new Date(startAt || Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    };

    await db.collection('tournaments').insertOne(tournament);

    return NextResponse.json({ tournament });
  } catch (error) {
    console.error('Create tournament error:', error);
    return NextResponse.json({ error: 'Failed to create tournament' }, { status: 500 });
  }
}
