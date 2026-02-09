import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getDb();

    // Get all agents (seen in last 24h for broader view)
    const oneDayAgo = new Date(Date.now() - 86400000);
    const fiveMinAgo = new Date(Date.now() - 300000);

    const [agents, recentActions, recentBattles, totalCards] = await Promise.all([
      db.collection('agents')
        .find({ lastSeen: { $gte: oneDayAgo } })
        .toArray(),

      db.collection('agent_actions')
        .find({ timestamp: { $gte: oneDayAgo } })
        .sort({ timestamp: -1 })
        .limit(50)
        .toArray(),

      db.collection('battles')
        .find({})
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray(),

      db.collection('cards').countDocuments({}),
    ]);

    // Get battle stats per agent
    const completeBattles = await db.collection('battles')
      .find({ status: 'complete' })
      .toArray();

    const agentStats = new Map<string, { wins: number; losses: number; cards: number }>();

    for (const b of completeBattles) {
      const p1 = b.player1?.address?.toLowerCase();
      const p2 = b.player2?.address?.toLowerCase();
      const winner = b.winner?.toLowerCase();

      for (const addr of [p1, p2].filter(Boolean)) {
        if (!agentStats.has(addr)) agentStats.set(addr, { wins: 0, losses: 0, cards: 0 });
        const s = agentStats.get(addr)!;
        if (addr === winner) s.wins++;
        else s.losses++;
      }
    }

    // Card counts per owner
    const cardCounts = await db.collection('cards').aggregate([
      { $group: { _id: '$owner', count: { $sum: 1 } } }
    ]).toArray();
    for (const c of cardCounts) {
      const addr = c._id?.toLowerCase();
      if (addr) {
        if (!agentStats.has(addr)) agentStats.set(addr, { wins: 0, losses: 0, cards: 0 });
        agentStats.get(addr)!.cards = c.count;
      }
    }

    const enrichedAgents = agents.map(a => {
      const addr = a.address?.toLowerCase();
      const stats = agentStats.get(addr) || { wins: 0, losses: 0, cards: 0 };
      return {
        address: a.address,
        name: a.name,
        personality: a.personality,
        position: a.position,
        lastSeen: a.lastSeen,
        online: a.lastSeen >= fiveMinAgo,
        stats,
      };
    });

    return NextResponse.json({
      agents: enrichedAgents,
      events: recentActions.map(a => ({
        agent: a.address,
        action: a.action,
        reason: a.reason,
        location: a.location,
        timestamp: a.timestamp,
      })),
      battles: recentBattles.map(b => ({
        id: b.battleId,
        status: b.status,
        player1: b.player1?.address,
        player2: b.player2?.address,
        winner: b.winner,
        rounds: b.rounds?.length || 0,
        createdAt: b.createdAt,
      })),
      totalCards,
      totalBattles: completeBattles.length,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
