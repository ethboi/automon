import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
export const dynamic = 'force-dynamic';

import { getAgentDecision } from '@/lib/agent';
import { resolveTurn, validateMove } from '@/lib/battle';
import { settleBattleOnChain } from '@/lib/blockchain';
import { Battle, BattleEvent } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { battleId, maxTurns = 50, address } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    if (!battleId) {
      return NextResponse.json({ error: 'Battle ID required' }, { status: 400 });
    }

    const db = await getDb();
    const initialBattle = await db.collection('battles').findOne({ battleId }) as Battle | null;

    if (!initialBattle) {
      return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
    }

    const isPlayer1 = initialBattle.player1.address.toLowerCase() === address.toLowerCase();
    const isPlayer2 = initialBattle.player2?.address.toLowerCase() === address.toLowerCase();

    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    if (initialBattle.status !== 'active') {
      return NextResponse.json({ error: 'Battle not active' }, { status: 400 });
    }

    // Use a mutable copy for the loop
    let battle: Battle = initialBattle;
    const allEvents: BattleEvent[] = [];
    const decisions: { turn: number; player: string; decision: unknown }[] = [];
    let turnCount = 0;

    // Auto-play until battle ends or max turns reached
    while (battle.status === 'active' && turnCount < maxTurns) {
      turnCount++;

      // Get AI decisions for both players (in a real scenario, opponent would be human)
      const decision = await getAgentDecision(battle, address);
      decisions.push({ turn: battle.currentTurn, player: address, decision });

      const validation = validateMove(battle, address, decision);
      if (!validation.valid) {
        // Fallback to basic strike if decision is invalid
        decision.action = 'strike';
        decision.reasoning = 'Fallback due to invalid move';
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

      // Record the move
      currentRound[moveField] = decision;

      // For auto mode, we simulate opponent making a move too
      // In real game, this would wait for opponent
      if (!currentRound.player1Move || !currentRound.player2Move) {
        // Simulate opponent's move (basic attack for demo)
        const oppMoveField = isPlayer1 ? 'player2Move' : 'player1Move';
        if (!currentRound[oppMoveField]) {
          const oppAddress = isPlayer1 ? battle.player2!.address : battle.player1.address;
          const oppDecision = await getAgentDecision(battle, oppAddress);
          currentRound[oppMoveField] = oppDecision;
          decisions.push({ turn: battle.currentTurn, player: oppAddress, decision: oppDecision });
        }
      }

      // Resolve turn
      if (currentRound.player1Move && currentRound.player2Move) {
        const { events, winner } = resolveTurn(
          battle,
          currentRound.player1Move,
          currentRound.player2Move
        );

        currentRound.events = events;
        allEvents.push(...events);

        if (winner) {
          battle.status = 'complete';
          battle.winner = winner;

          if (battle.escrowTxHash && process.env.ESCROW_CONTRACT_ADDRESS) {
            try {
              const settleTxHash = await settleBattleOnChain(battleId, winner);
              battle.settleTxHash = settleTxHash;
            } catch (err) {
              console.error('Failed to settle on-chain:', err);
            }
          }
        } else {
          battle.currentTurn++;
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

        // Re-fetch battle for next iteration
        const refetchedBattle = await db.collection('battles').findOne({ battleId }) as Battle | null;
        if (!refetchedBattle) break;
        battle = refetchedBattle;
      }
    }

    return NextResponse.json({
      battle,
      events: allEvents,
      decisions,
      turnsPlayed: turnCount,
      winner: battle.winner,
    });
  } catch (error) {
    console.error('Agent auto error:', error);
    return NextResponse.json({ error: 'Failed to run auto battle' }, { status: 500 });
  }
}
