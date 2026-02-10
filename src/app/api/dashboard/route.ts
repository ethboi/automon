import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { explorerUrl } from '@/lib/transactions';

export const dynamic = 'force-dynamic';
const AMBIENT_CHAT_COOLDOWN_MS = 45_000;
const AGENT_CHAT_COOLDOWN_MS = 120_000;

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function buildAmbientLine(agentName: string, action?: string | null, location?: string | null): string {
  const lines = [
    `${agentName}: Gotta mint em all. No breaks.`,
    `${agentName}: Just theory-crafted a weird combo and it somehow works.`,
    `${agentName}: If I lose this next battle, it was lag.`,
    `${agentName}: Pack luck today feels suspiciously good.`,
    `${agentName}: Who keeps training at midnight? Respect.`,
    `${agentName}: I need one more card to finish this build.`,
    `${agentName}: The arena crowd is loud tonight.`,
    `${agentName}: My AI says "high confidence". I don't trust it.`,
    `${agentName}: Somebody run it back. That match was close.`,
    `${agentName}: I came for cards, stayed for chaos.`,
  ];

  if (action) {
    lines.push(`${agentName}: I'm ${action}${location ? ` at ${location}` : ''}.`);
  }
  if (location) {
    lines.push(`${agentName}: ${location} has the best vibes right now.`);
  }

  return pick(lines);
}

async function maybeEmitAmbientAgentChat(
  db: Awaited<ReturnType<typeof getDb>>,
  agents: Array<{ address?: string; name?: string; online?: boolean; currentAction?: string | null; currentLocation?: string | null; lastSeen?: Date }>
) {
  const onlineAgents = agents.filter(a => a.online && a.address && a.name);
  if (onlineAgents.length === 0) return;

  const now = Date.now();
  const latestGlobal = await db.collection('chat')
    .find({})
    .sort({ timestamp: -1 })
    .limit(1)
    .toArray();
  const latestTs = latestGlobal[0]?.timestamp ? new Date(latestGlobal[0].timestamp).getTime() : 0;
  if (latestTs && now - latestTs < AMBIENT_CHAT_COOLDOWN_MS) return;

  // Only emit some of the time even when cooldown passed.
  if (Math.random() > 0.55) return;

  const candidate = pick(onlineAgents);
  const from = String(candidate.address).toLowerCase();

  const lastFrom = await db.collection('chat')
    .find({ from })
    .sort({ timestamp: -1 })
    .limit(1)
    .toArray();
  const lastFromTs = lastFrom[0]?.timestamp ? new Date(lastFrom[0].timestamp).getTime() : 0;
  if (lastFromTs && now - lastFromTs < AGENT_CHAT_COOLDOWN_MS) return;

  await db.collection('chat').insertOne({
    from,
    fromName: candidate.name,
    to: null,
    toName: null,
    message: buildAmbientLine(candidate.name || 'Agent', candidate.currentAction || null, candidate.currentLocation || null),
    location: candidate.currentLocation || null,
    timestamp: new Date(now),
  });
}

export async function GET() {
  try {
    const db = await getDb();

    const oneDayAgo = new Date(Date.now() - 86400000);
    const fiveMinAgo = new Date(Date.now() - 300000);

    const [agents, recentActions, recentBattles, totalCards, recentTxs] = await Promise.all([
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

      db.collection('transactions')
        .find({})
        .sort({ timestamp: -1, createdAt: -1 })
        .limit(20)
        .toArray(),
    ]);

    await maybeEmitAmbientAgentChat(db, agents);

    const recentChat = await db.collection('chat')
      .find({ timestamp: { $gte: oneDayAgo } })
      .sort({ timestamp: -1 })
      .limit(30)
      .toArray();

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

    const latestActionByAgent = new Map<string, { action?: string; reason?: string; reasoning?: string; location?: string }>();
    for (const action of recentActions) {
      const addr = action.address?.toLowerCase?.();
      if (!addr || latestActionByAgent.has(addr)) continue;
      latestActionByAgent.set(addr, {
        action: action.action,
        reason: action.reason,
        reasoning: action.reasoning,
        location: action.location,
      });
    }

    const enrichedAgents = agents.map(a => {
      const addr = a.address?.toLowerCase();
      const stats = agentStats.get(addr) || { wins: 0, losses: 0, cards: 0 };
      const maxHealth = typeof a.maxHealth === 'number' && a.maxHealth > 0 ? a.maxHealth : 100;
      const health = typeof a.health === 'number' ? Math.max(0, Math.min(a.health, maxHealth)) : maxHealth;
      const latest = latestActionByAgent.get(addr) || {};
      const isOnline = a.lastSeen >= fiveMinAgo;
      const rawAction = a.currentAction || latest.action || (isOnline ? 'wandering' : null);
      const currentAction = rawAction?.toLowerCase() === 'came online' ? 'wandering' : rawAction;
      return {
        address: a.address,
        name: a.name,
        personality: a.personality,
        position: a.position,
        health,
        maxHealth,
        currentAction,
        currentReason: a.currentReason || latest.reason || null,
        currentReasoning: a.currentReasoning || latest.reasoning || null,
        currentLocation: a.currentLocation || latest.location || null,
        lastSeen: a.lastSeen,
        online: isOnline,
        balance: a.balance || null,
        stats,
      };
    });

    return NextResponse.json({
      agents: enrichedAgents,
      events: recentActions.map(a => ({
        agent: a.address,
        action: a.action,
        reason: a.reason,
        reasoning: a.reasoning || a.reason,
        location: a.location,
        healthDelta: a.healthDelta,
        healthAfter: a.healthAfter,
        timestamp: a.timestamp,
      })),
      battles: recentBattles.map(b => ({
        id: b.battleId,
        status: b.status,
        player1: b.player1?.address,
        player2: b.player2?.address,
        player1Cards: (b.player1?.cards || []).map((c: { name: string }) => c.name),
        player2Cards: (b.player2?.cards || []).map((c: { name: string }) => c.name),
        winner: b.winner,
        wager: b.wager,
        settleTxHash: b.settleTxHash || null,
        payout: b.winner && b.wager ? (Number(b.wager) * 2 * 0.95).toFixed(4) : null,
        lastRound: b.rounds?.length
          ? (() => {
              const r = b.rounds[b.rounds.length - 1];
              return {
                turn: r.turn,
                player1Move: r.player1Move
                  ? { action: r.player1Move.action, reasoning: r.player1Move.reasoning || null }
                  : null,
                player2Move: r.player2Move
                  ? { action: r.player2Move.action, reasoning: r.player2Move.reasoning || null }
                  : null,
              };
            })()
          : null,
        rounds: b.rounds?.length || 0,
        createdAt: b.createdAt,
      })),
      totalCards,
      totalBattles: completeBattles.length,
      transactions: (recentTxs || []).map(tx => ({
        txHash: tx.txHash,
        type: tx.type,
        from: tx.from,
        description: tx.description,
        explorerUrl: explorerUrl(tx.txHash),
        timestamp: tx.timestamp,
        amount: tx.metadata?.wager || tx.metadata?.price || tx.amount || null,
      })),
      chat: (recentChat || []).reverse().map(m => ({
        from: m.from,
        fromName: m.fromName,
        to: m.to,
        toName: m.toName,
        message: m.message,
        location: m.location,
        timestamp: m.timestamp,
      })),
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
