import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { Battle, BattleLog, Card, BattleMove } from '@/lib/types';
import { initializeBattleCard, simulateAIBattle } from '@/lib/battle';
import { getAgentDecision } from '@/lib/agent';
import { settleBattleOnChain } from '@/lib/blockchain';
import { getEscrowContractAddress } from '@/lib/network';
import { applyBattleMoodResult } from '@/lib/agentMood';
export const dynamic = 'force-dynamic';

function hasEscrowConfig(): boolean {
  try {
    return Boolean(getEscrowContractAddress());
  } catch {
    return false;
  }
}

/**
 * AI vs AI Battle Simulation
 *
 * This endpoint handles the complete flow:
 * 1. Player 1 creates battle with wager and selected cards
 * 2. Player 2 joins with matching wager and selected cards
 * 3. Server immediately runs full AI vs AI battle simulation
 * 4. Both AIs make decisions using Claude, predicting opponent moves
 * 5. Full battle log is saved including reasoning for every move
 * 6. Escrow is settled and winner gets pot minus 5% fee
 * 7. Returns complete battle log for replay
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { battleId, action } = body;

    const client = await clientPromise;
    const db = client.db('automon');

    if (action === 'start_simulation') {
      // This is called after player 2 joins and both have selected cards
      // Run the complete AI vs AI battle

      const battle = await db.collection<Battle>('battles').findOne({ battleId });
      if (!battle) {
        return NextResponse.json({ error: 'Battle not found' }, { status: 404 });
      }

      if (battle.status !== 'active') {
        return NextResponse.json({ error: 'Battle is not active' }, { status: 400 });
      }

      if (!battle.player2) {
        return NextResponse.json({ error: 'Player 2 has not joined' }, { status: 400 });
      }

      console.log('\n========================================');
      console.log('STARTING AI VS AI BATTLE SIMULATION');
      console.log(`Battle ID: ${battleId}`);
      console.log(`Player 1: ${battle.player1.address.slice(0, 10)}...`);
      console.log(`Player 2: ${battle.player2.address.slice(0, 10)}...`);
      console.log(`Wager: ${battle.wager} MON`);
      console.log('========================================\n');

      // Initialize battle cards with HP, status effects, etc.
      const battleCopy: Battle = {
        ...battle,
        player1: {
          ...battle.player1,
          cards: battle.player1.cards.map(c => initializeBattleCard(c as unknown as Card)),
        },
        player2: {
          ...battle.player2,
          cards: battle.player2.cards.map(c => initializeBattleCard(c as unknown as Card)),
        },
        rounds: [],
        currentTurn: 0,
      };

      // Run the AI battle with different personalities for variety
      const personalities = ['aggressive', 'defensive', 'balanced', 'unpredictable'];
      const p1Personality = personalities[Math.floor(Math.random() * personalities.length)];
      const p2Personality = personalities[Math.floor(Math.random() * personalities.length)];

      console.log(`Player 1 AI Personality: ${p1Personality}`);
      console.log(`Player 2 AI Personality: ${p2Personality}\n`);

      // AI move getter function
      const getAIMove = async (b: Battle, playerAddress: string): Promise<BattleMove> => {
        const isP1 = b.player1.address.toLowerCase() === playerAddress.toLowerCase();
        const personality = isP1 ? p1Personality : p2Personality;
        return getAgentDecision(b, playerAddress, personality);
      };

      // Run the simulation
      const battleLog = await simulateAIBattle(battleCopy, getAIMove);

      // Enrich with agent names
      const agents = await db.collection('agents').find({
        address: { $in: [battle.player1.address, battle.player2!.address].map(a => a.toLowerCase()) }
      }).toArray();
      const nameMap = new Map(agents.map(a => [a.address?.toLowerCase(), a.name]));
      battleLog.player1.name = nameMap.get(battle.player1.address.toLowerCase()) || undefined;
      battleLog.player2.name = nameMap.get(battle.player2!.address.toLowerCase()) || undefined;
      // Attach card selection reasoning if stored
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawBattle = battle as any;
      if (rawBattle.player1?.cardSelectionReasoning) {
        (battleLog.player1 as any).cardSelectionReasoning = rawBattle.player1.cardSelectionReasoning;
      }
      if (rawBattle.player2?.cardSelectionReasoning) {
        (battleLog.player2 as any).cardSelectionReasoning = rawBattle.player2.cardSelectionReasoning;
      }

      console.log('\n========================================');
      console.log('BATTLE COMPLETE');
      console.log(`Winner: ${battleLog.winner}`);
      console.log(`Total Turns: ${battleLog.turns.length}`);
      console.log(`Duration: ${battleLog.duration}ms`);
      console.log(`Damage Dealt - P1: ${battleLog.totalDamageDealt.player1}, P2: ${battleLog.totalDamageDealt.player2}`);
      console.log(`Cards Fainted - P1: ${battleLog.cardsFainted.player1}, P2: ${battleLog.cardsFainted.player2}`);
      console.log('========================================\n');

      // Update battle in database
      await db.collection<Battle>('battles').updateOne(
        { battleId },
        {
          $set: {
            status: 'complete',
            winner: battleLog.winner,
            rounds: battleCopy.rounds,
            currentTurn: battleCopy.currentTurn,
            updatedAt: new Date(),
          },
        }
      );
      await applyBattleMoodResult(db, battleLog.winner, battleCopy.player1.address, battleCopy.player2?.address);

      // Save full battle log for replay
      await db.collection('battleLogs').insertOne({
        ...battleLog,
        createdAt: new Date(),
      });

      // Settle on-chain if there's a valid winner
      let settleTxHash = null;
      if (battleLog.winner && battleLog.winner !== 'draw') {
        try {
          console.log('Settling battle on-chain...');
          console.log('Escrow configured:', hasEscrowConfig());
          console.log('Winner:', battleLog.winner, 'BattleId:', battleId);
          settleTxHash = await settleBattleOnChain(battleId, battleLog.winner);
          console.log(`Settlement tx: ${settleTxHash}`);

          await db.collection<Battle>('battles').updateOne(
            { battleId },
            { $set: { settleTxHash } }
          );
        } catch (error) {
          console.error('On-chain settlement failed:', error);
          // Continue anyway - can retry settlement later
        }
      }

      return NextResponse.json({
        success: true,
        battleLog,
        settleTxHash,
        message: `Battle complete! Winner: ${battleLog.winner}`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Battle simulation error:', error);
    return NextResponse.json(
      { error: 'Failed to simulate battle' },
      { status: 500 }
    );
  }
}

/**
 * Quick simulation for testing - creates and runs a battle with random cards
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const battleId = searchParams.get('battleId');

  if (!battleId) {
    return NextResponse.json({ error: 'Battle ID required' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db('automon');

    // Get battle log
    const battleLog = await db.collection<BattleLog>('battleLogs').findOne({ battleId });

    if (!battleLog) {
      return NextResponse.json({ error: 'Battle log not found' }, { status: 404 });
    }

    // Enrich with agent/user names if missing
    if (!battleLog.player1.name || !battleLog.player2.name) {
      const addresses = [battleLog.player1.address, battleLog.player2.address].map(a => a.toLowerCase());
      const [agents, users] = await Promise.all([
        db.collection('agents').find({ address: { $in: addresses } }).toArray(),
        db.collection('users').find({ address: { $in: addresses } }).toArray(),
      ]);
      const nameMap = new Map([
        ...agents.map(a => [a.address?.toLowerCase(), a.name] as [string, string]),
        ...users.map(u => [u.address?.toLowerCase(), u.name] as [string, string]),
      ]);
      if (!battleLog.player1.name) battleLog.player1.name = nameMap.get(battleLog.player1.address.toLowerCase()) || undefined;
      if (!battleLog.player2.name) battleLog.player2.name = nameMap.get(battleLog.player2.address.toLowerCase()) || undefined;
    }

    // Attach card selection reasoning from battles collection
    const battle = await db.collection('battles').findOne({ battleId });
    if (battle) {
      if (battle.player1?.cardSelectionReasoning) {
        (battleLog.player1 as any).cardSelectionReasoning = battle.player1.cardSelectionReasoning;
      }
      if (battle.player2?.cardSelectionReasoning) {
        (battleLog.player2 as any).cardSelectionReasoning = battle.player2.cardSelectionReasoning;
      }
    }

    return NextResponse.json({ battleLog });

  } catch (error) {
    console.error('Error fetching battle log:', error);
    return NextResponse.json({ error: 'Failed to fetch battle log' }, { status: 500 });
  }
}
