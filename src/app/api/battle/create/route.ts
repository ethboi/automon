import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAgentAuth } from '@/lib/agentAuth';
import { v4 as uuidv4 } from 'uuid';
import { logTransaction } from '@/lib/transactions';
import { Battle } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { wager, txHash, address: bodyAddress } = await request.json();

    // Accept address from body (wallet-connected) or agent secret auth
    const agentAuth = await getAgentAuth(request);
    const address = bodyAddress || agentAuth?.address;

    if (!address) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    if (!wager) {
      return NextResponse.json({ error: 'Wager amount required' }, { status: 400 });
    }

    const db = await getDb();
    const battleId = uuidv4();

    const battle: Battle = {
      battleId,
      player1: {
        address: address.toLowerCase(),
        cards: [],
        activeCardIndex: 0,
        ready: false,
      },
      player2: null,
      wager,
      status: 'pending',
      currentTurn: 0,
      rounds: [],
      winner: null,
      escrowTxHash: txHash || null,
      settleTxHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('battles').insertOne(battle);

    if (txHash) {
      await logTransaction({
        txHash,
        type: 'escrow_deposit',
        from: address,
        description: `Battle created with ${wager || '0'} MON wager`,
        metadata: { battleId: battle.battleId, wager },
      });
    }

    return NextResponse.json({ battle });
  } catch (error) {
    console.error('Create battle error:', error);
    return NextResponse.json({ error: 'Failed to create battle' }, { status: 500 });
  }
}
