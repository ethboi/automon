import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { initializeBattleCard, simulateAIBattle } from '@/lib/battle';
import { getAgentDecision } from '@/lib/agent';
import { settleBattleOnChain } from '@/lib/blockchain';
import { Card, Battle, BattleMove, BattleLog } from '@/lib/types';
import { ObjectId } from 'mongodb';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { battleId, cardIds, address, cardSelectionReasoning } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    if (!battleId || !cardIds || !Array.isArray(cardIds) || cardIds.length !== 3) {
      return NextResponse.json({ error: 'Battle ID and exactly 3 card IDs required' }, { status: 400 });
    }

    const db = await getDb();

    // Verify cards belong to player
    const cards = await db
      .collection('cards')
      .find({
        _id: { $in: cardIds.map((id: string) => new ObjectId(id)) },
        owner: address.toLowerCase(),
      })
      .toArray();

    if (cards.length !== 3) {
      return NextResponse.json({ error: 'Invalid cards selected' }, { status: 400 });
    }

    const battle = await db.collection('battles').findOne({ battleId });

    if (!battle) {
      return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
    }

    // Allow card selection in 'pending' (for player1) or 'selecting' (both players)
    if (battle.status !== 'pending' && battle.status !== 'selecting') {
      return NextResponse.json({ error: 'Cannot select cards at this time' }, { status: 400 });
    }

    const isPlayer1 = battle.player1.address.toLowerCase() === address.toLowerCase();
    const isPlayer2 = battle.player2?.address.toLowerCase() === address.toLowerCase();

    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json({ error: 'Not a participant in this battle' }, { status: 403 });
    }

    // Initialize battle cards with currentHp, buffs, debuffs
    const battleCards = cards.map(card => initializeBattleCard(card as unknown as Card));

    const playerField = isPlayer1 ? 'player1' : 'player2';
    const updateQuery: Record<string, unknown> = {
      [`${playerField}.cards`]: battleCards,
      [`${playerField}.ready`]: true,
      ...(cardSelectionReasoning ? { [`${playerField}.cardSelectionReasoning`]: cardSelectionReasoning } : {}),
      updatedAt: new Date(),
    };

    await db.collection('battles').updateOne({ battleId }, { $set: updateQuery });

    // Check if both players are ready
    const updatedBattle = await db.collection('battles').findOne({ battleId });

    if (updatedBattle?.player1.ready && updatedBattle?.player2?.ready) {
      // Set battle to active
      await db.collection('battles').updateOne(
        { battleId },
        {
          $set: {
            status: 'active',
            currentTurn: 0,
            updatedAt: new Date(),
          },
        }
      );

      // Run AI vs AI simulation immediately
      console.log('\n========================================');
      console.log('BOTH PLAYERS READY - STARTING AI SIMULATION');
      console.log(`Battle ID: ${battleId}`);
      console.log('========================================\n');

      try {
        // Prepare battle for simulation
        const battleForSim: Battle = {
          ...updatedBattle,
          battleId: updatedBattle.battleId,
          player1: {
            ...updatedBattle.player1,
            cards: updatedBattle.player1.cards.map((c: Card) => initializeBattleCard(c)),
          },
          player2: {
            ...updatedBattle.player2!,
            cards: updatedBattle.player2!.cards.map((c: Card) => initializeBattleCard(c)),
          },
          rounds: [],
          currentTurn: 0,
          wager: updatedBattle.wager,
          status: 'active',
          winner: null,
          escrowTxHash: updatedBattle.escrowTxHash || null,
          settleTxHash: null,
          createdAt: updatedBattle.createdAt,
          updatedAt: new Date(),
        };

        // Use real AI decisioning so replay reflects actual model reasoning
        const getAIMove = async (b: Battle, playerAddress: string): Promise<BattleMove> => {
          return getAgentDecision(b, playerAddress, 'balanced');
        };

        // Run the battle simulation
        const battleLog = await simulateAIBattle(battleForSim, getAIMove);

        console.log('\n========================================');
        console.log('SIMULATION COMPLETE');
        console.log(`Winner: ${battleLog.winner}`);
        console.log(`Turns: ${battleLog.turns.length}`);
        console.log('========================================\n');

        // Update battle with results
        await db.collection('battles').updateOne(
          { battleId },
          {
            $set: {
              status: 'complete',
              winner: battleLog.winner,
              rounds: battleForSim.rounds,
              currentTurn: battleForSim.currentTurn,
              updatedAt: new Date(),
            },
          }
        );

        // Save battle log for replay
        await db.collection<BattleLog>('battleLogs').insertOne({
          ...battleLog,
          createdAt: new Date(),
        } as BattleLog & { createdAt: Date });

        // Settle on-chain
        let settleTxHash = null;
        if (battleLog.winner && battleLog.winner !== 'draw') {
          try {
            settleTxHash = await settleBattleOnChain(battleId, battleLog.winner);
            console.log(`Settlement tx: ${settleTxHash}`);
            await db.collection('battles').updateOne(
              { battleId },
              { $set: { settleTxHash } }
            );
          } catch (settleError) {
            console.error('Settlement failed:', settleError);
          }
        }

        const finalBattle = await db.collection('battles').findOne({ battleId });
        return NextResponse.json({
          battle: finalBattle,
          battleLog,
          simulationComplete: true,
          winner: battleLog.winner,
        });

      } catch (simError) {
        console.error('Simulation error:', simError);
        // Return battle anyway, simulation can be retried
        const finalBattle = await db.collection('battles').findOne({ battleId });
        return NextResponse.json({
          battle: finalBattle,
          simulationError: true,
        });
      }
    }

    const finalBattle = await db.collection('battles').findOne({ battleId });

    return NextResponse.json({ battle: finalBattle });
  } catch (error) {
    console.error('Select cards error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to select cards', detail: msg }, { status: 500 });
  }
}
