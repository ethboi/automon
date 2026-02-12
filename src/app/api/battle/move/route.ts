import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { resolveTurn, validateMove } from '@/lib/battle';
import { settleBattleOnChain } from '@/lib/blockchain';
import { getEscrowContractAddress } from '@/lib/network';
import { Battle } from '@/lib/types';
import { logTransaction } from '@/lib/transactions';
import { applyBattleMoodResult } from '@/lib/agentMood';
export const dynamic = 'force-dynamic';

function hasEscrowConfig(): boolean {
  try {
    return Boolean(getEscrowContractAddress());
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { battleId, move, address } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    if (!battleId || !move) {
      return NextResponse.json({ error: 'Battle ID and move required' }, { status: 400 });
    }

    const db = await getDb();
    const battle = await db.collection('battles').findOne({ battleId }) as Battle | null;

    if (!battle) {
      return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
    }

    if (battle.status !== 'active') {
      return NextResponse.json({ error: 'Battle not active' }, { status: 400 });
    }

    const isPlayer1 = battle.player1.address.toLowerCase() === address.toLowerCase();
    const isPlayer2 = battle.player2?.address.toLowerCase() === address.toLowerCase();

    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json({ error: 'Not a participant in this battle' }, { status: 403 });
    }

    // Validate the move
    const validation = validateMove(battle, address, move);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Get or create current round
    let currentRound = battle.rounds.find(r => r.turn === battle.currentTurn);
    const moveField = isPlayer1 ? 'player1Move' : 'player2Move';

    if (!currentRound) {
      currentRound = {
        turn: battle.currentTurn,
        player1Move: undefined,
        player2Move: undefined,
        events: [],
        timestamp: new Date(),
      };
      battle.rounds.push(currentRound);
    }

    // Check if player already submitted move this turn
    if (currentRound[moveField]) {
      return NextResponse.json({ error: 'Already submitted move for this turn' }, { status: 400 });
    }

    // Record the move
    currentRound[moveField] = move;

    // If both players have moved, resolve the turn
    if (currentRound.player1Move && currentRound.player2Move) {
      const { events, winner } = resolveTurn(
        battle,
        currentRound.player1Move,
        currentRound.player2Move
      );

      currentRound.events = events;

      if (winner) {
        // Battle is over
        battle.status = 'complete';
        battle.winner = winner;
        await applyBattleMoodResult(db, winner, battle.player1.address, battle.player2?.address);

        // Settle on-chain if escrow was used
        if (battle.escrowTxHash && hasEscrowConfig()) {
          try {
            const settleTxHash = await settleBattleOnChain(battleId, winner);
            battle.settleTxHash = settleTxHash;
            await logTransaction({
              txHash: settleTxHash,
              type: 'battle_settle',
              from: winner,
              description: `Battle settled. Winner: ${winner.slice(0, 6)}...${winner.slice(-4)}`,
              metadata: { battleId, winner, wager: battle.wager },
            });
          } catch (err) {
            console.error('Failed to settle on-chain:', err);
            // Continue anyway, can be settled manually
          }
        }
      } else {
        // Next turn
        battle.currentTurn++;
      }
    }

    // Update battle in database
    await db.collection('battles').updateOne(
      { battleId },
      {
        $set: {
          player1: battle.player1,
          player2: battle.player2,
          rounds: battle.rounds,
          currentTurn: battle.currentTurn,
          status: battle.status,
          winner: battle.winner,
          settleTxHash: battle.settleTxHash,
          updatedAt: new Date(),
        },
      }
    );

    const updatedBattle = await db.collection('battles').findOne({ battleId });

    return NextResponse.json({
      battle: updatedBattle,
      events: currentRound.events,
      turnResolved: currentRound.player1Move && currentRound.player2Move,
    });
  } catch (error) {
    console.error('Move error:', error);
    return NextResponse.json({ error: 'Failed to process move' }, { status: 500 });
  }
}
