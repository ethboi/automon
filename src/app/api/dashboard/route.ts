import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { explorerUrl } from '@/lib/transactions';
import { clampMood, DEFAULT_MOOD, getActionMoodDelta, getMoodTier } from '@/lib/agentMood';

export const dynamic = 'force-dynamic';

function formatWeiToMon(weiRaw: unknown): string | null {
  if (weiRaw == null) return null;
  const s = String(weiRaw).trim();
  if (!/^\d+$/.test(s)) return null;
  try {
    const wei = BigInt(s);
    const base = BigInt('1000000000000000000');
    const whole = wei / base;
    const frac = wei % base;
    if (frac === BigInt(0)) return whole.toString();
    const fracStr = frac.toString().padStart(18, '0').replace(/0+$/, '');
    return `${whole.toString()}.${fracStr}`;
  } catch {
    return null;
  }
}

function normalizeMonAmount(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const fromWei = formatWeiToMon(s);
  return fromWei || s;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export async function GET() {
  try {
    const db = await getDb();

    const oneDayAgo = new Date(Date.now() - 86400000);
    const fiveMinAgo = new Date(Date.now() - 300000);

    const [agents, users, recentActions, recentBattles, totalCards, recentTxs] = await Promise.all([
      db.collection('agents')
        .find({ lastSeen: { $gte: oneDayAgo } })
        .toArray(),

      db.collection('users')
        .find({ lastSeen: { $gte: fiveMinAgo } })
        .sort({ lastSeen: -1 })
        .limit(50)
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
        .limit(50)
        .toArray(),
    ]);

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

    const latestActionByAgent = new Map<string, { action?: string; reason?: string; reasoning?: string; location?: string; moodDelta?: number }>();
    for (const action of recentActions) {
      const addr = action.address?.toLowerCase?.();
      if (!addr || latestActionByAgent.has(addr)) continue;
      latestActionByAgent.set(addr, {
        action: action.action,
        reason: action.reason,
        reasoning: action.reasoning,
        location: action.location,
        moodDelta: typeof action.moodDelta === 'number' ? action.moodDelta : undefined,
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
      const currentMoodDelta = typeof latest.moodDelta === 'number'
        ? latest.moodDelta
        : getActionMoodDelta(currentAction || '');
      const mood = clampMood(typeof a.mood === 'number' ? a.mood : DEFAULT_MOOD);
      return {
        address: a.address,
        name: a.name,
        personality: a.personality,
        model: a.model || null,
        position: a.position,
        health,
        maxHealth,
        currentAction,
        currentMoodDelta,
        currentReason: a.currentReason || latest.reason || null,
        currentReasoning: a.currentReasoning || latest.reasoning || null,
        currentLocation: a.currentLocation || latest.location || null,
        mood,
        moodLabel: a.moodLabel || getMoodTier(mood),
        lastSeen: a.lastSeen,
        online: isOnline,
        balance: a.balance || null,
        tokenBalance: a.tokenBalance || '0',
        stats,
      };
    });

    const agentAddresses = new Set(
      enrichedAgents
        .map((a) => a.address?.toLowerCase?.())
        .filter(Boolean)
    );

    const onlinePlayers = users
      .filter((u) => {
        const addr = u.address?.toLowerCase?.();
        return !!addr && !agentAddresses.has(addr);
      })
      .map((u) => ({
        address: u.address,
        name: (u.name && String(u.name).trim()) || shortAddr(u.address),
        lastSeen: u.lastSeen,
      }));

    return NextResponse.json({
      onlineAgents: enrichedAgents,
      agents: enrichedAgents,
      onlinePlayers,
      events: recentActions.map(a => ({
        agent: a.address,
        action: a.action,
        reason: a.reason,
        reasoning: a.reasoning || a.reason,
        location: a.location,
        healthDelta: a.healthDelta,
        healthAfter: a.healthAfter,
        moodDelta: a.moodDelta,
        moodAfter: a.moodAfter,
        timestamp: a.timestamp,
      })),
      battles: recentBattles.map(b => ({
        id: b.battleId,
        status: b.status,
        player1: b.player1?.address,
        player2: b.player2?.address,
        player1Cards: (b.player1?.cards || []).map((c: { name: string }) => c.name),
        player2Cards: (b.player2?.cards || []).map((c: { name: string }) => c.name),
        player1Reasoning: b.player1?.cardSelectionReasoning || null,
        player2Reasoning: b.player2?.cardSelectionReasoning || null,
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
        from: tx.from || tx.address,
        agentName: tx.agentName,
        description: tx.description || '',
        explorerUrl: explorerUrl(tx.txHash),
        timestamp: tx.timestamp || tx.createdAt,
        amount: normalizeMonAmount(tx.amount) || normalizeMonAmount(tx.metadata?.wager) || normalizeMonAmount(tx.metadata?.price),
        details: tx.details,
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
