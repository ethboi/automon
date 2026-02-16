import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAgentAuth } from '@/lib/agentAuth';
import { v4 as uuidv4 } from 'uuid';
import { logTransaction } from '@/lib/transactions';
import { Battle } from '@/lib/types';
import { clampMood, DEFAULT_MOOD, getMoodTier } from '@/lib/agentMood';
import { ethers } from 'ethers';
import { getProvider } from '@/lib/blockchain';
import { getSession } from '@/lib/auth';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { wager, txHash, address: bodyAddress, battleId: requestedBattleId } = await request.json();

    const session = await getSession();
    const agentAuth = await getAgentAuth(request);
    const authAddress = session?.address || agentAuth?.address;
    const normalizedBodyAddress = typeof bodyAddress === 'string' ? bodyAddress.toLowerCase() : '';
    const address = authAddress || normalizedBodyAddress;

    if (!authAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (normalizedBodyAddress && normalizedBodyAddress !== authAddress) {
      return NextResponse.json({ error: 'Address does not match authenticated user' }, { status: 403 });
    }

    if (!wager) {
      return NextResponse.json({ error: 'Wager amount required' }, { status: 400 });
    }
    const wagerValue = Number(wager);
    if (!Number.isFinite(wagerValue) || wagerValue <= 0) {
      return NextResponse.json({ error: 'Invalid wager amount' }, { status: 400 });
    }

    // Enforce on-chain affordability so 0 MON agents cannot create battles.
    const provider = getProvider();
    const balanceWei = await provider.getBalance(address);
    const wagerWei = ethers.parseEther(String(wager));
    if (balanceWei < wagerWei) {
      return NextResponse.json({ error: 'Insufficient MON balance for wager' }, { status: 400 });
    }

    const db = await getDb();
    const battleId = requestedBattleId || uuidv4();
    const playerAgent = await db.collection('agents').findOne({ address: address.toLowerCase() });
    const p1Mood = clampMood(typeof playerAgent?.mood === 'number' ? playerAgent.mood : DEFAULT_MOOD);

    const battle: Battle = {
      battleId,
      player1: {
        address: address.toLowerCase(),
        cards: [],
        activeCardIndex: 0,
        ready: false,
        mood: p1Mood,
        moodLabel: playerAgent?.moodLabel || getMoodTier(p1Mood),
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
