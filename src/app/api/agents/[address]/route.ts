import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ethers } from 'ethers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    const db = await getDb();

    // Get agent data
    const agent = await db.collection('agents').findOne({
      address: address.toLowerCase()
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Get action history
    const actions = await db.collection('agent_actions')
      .find({ address: address.toLowerCase() })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    // Get balance from Monad
    let balance = '0';
    try {
      const provider = new ethers.JsonRpcProvider(
        process.env.NEXT_PUBLIC_MONAD_RPC || 'https://testnet-rpc.monad.xyz'
      );
      const balanceWei = await provider.getBalance(address);
      balance = ethers.formatEther(balanceWei);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }

    // Get battle stats
    const battles = await db.collection('battles').find({
      $or: [
        { 'player1.address': address.toLowerCase() },
        { 'player2.address': address.toLowerCase() }
      ],
      status: 'complete'
    }).toArray();

    const wins = battles.filter(b => b.winner?.toLowerCase() === address.toLowerCase()).length;
    const losses = battles.length - wins;

    // Get cards
    const cardsData = await db.collection('cards')
      .find({ owner: address.toLowerCase() })
      .sort({ rarity: -1, createdAt: -1 })
      .limit(50)
      .toArray();

    const cardsCount = cardsData.length;
    const latestAction = actions[0];
    const rawAction = agent.currentAction || latestAction?.action || null;
    const currentAction = rawAction?.toLowerCase() === 'came online' ? 'wandering' : rawAction;
    const currentReason = agent.currentReason || latestAction?.reason || null;
    const currentReasoning = agent.currentReasoning || latestAction?.reasoning || null;
    const currentLocation = agent.currentLocation || latestAction?.location || null;
    const lastActionAt = agent.lastActionAt || latestAction?.timestamp || null;
    const maxHealth = typeof agent.maxHealth === 'number' && agent.maxHealth > 0 ? agent.maxHealth : 100;
    const health = typeof agent.health === 'number' ? Math.max(0, Math.min(agent.health, maxHealth)) : maxHealth;

    return NextResponse.json({
      agent: {
        address: agent.address,
        name: agent.name,
        personality: agent.personality,
        isAI: agent.isAI,
        position: agent.position,
        health,
        maxHealth,
        currentAction,
        currentReason,
        currentReasoning,
        currentLocation,
        lastActionAt,
        lastSeen: agent.lastSeen,
        createdAt: agent.createdAt,
      },
      stats: {
        balance,
        cards: cardsCount,
        battles: battles.length,
        wins,
        losses,
        winRate: battles.length > 0 ? Math.round((wins / battles.length) * 100) : 0,
        healthPercent: Math.round((health / maxHealth) * 100),
      },
      cards: cardsData.map(c => ({
        id: c.id || c._id?.toString(),
        tokenId: c.tokenId,
        automonId: c.automonId,
        name: c.name,
        element: c.element,
        rarity: c.rarity,
        stats: c.stats,
        ability: c.ability ? { name: c.ability.name, effect: c.ability.effect } : null,
      })),
      actions: actions.map(a => ({
        action: a.action,
        reason: a.reason,
        reasoning: a.reasoning || a.reason,
        timestamp: a.timestamp,
        location: a.location,
        healthDelta: a.healthDelta,
      })),
    });
  } catch (error) {
    console.error('Get agent details error:', error);
    return NextResponse.json({ error: 'Failed to get agent details' }, { status: 500 });
  }
}
