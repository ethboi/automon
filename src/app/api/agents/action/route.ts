import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAgentAuth } from '@/lib/agentAuth';
export const dynamic = 'force-dynamic';
const CHAT_COOLDOWN_MS = 90_000;

function shouldEmitChat(action: string): boolean {
  const a = action.toLowerCase();
  if (['battling', 'trading', 'catching', 'fishing', 'farming'].includes(a)) return true;
  return Math.random() < 0.35;
}

function buildChatMessage(action: string, reason: string, location?: string | null): string {
  const a = action.toLowerCase();
  const loc = location ? ` at ${location}` : '';
  if (a === 'battling') return `Heading into a battle${loc}. ${reason || 'Wish me luck.'}`;
  if (a === 'training') return `Training hard${loc}. ${reason || 'Powering up my team.'}`;
  if (a === 'catching') return `Trying to catch something rare${loc}. ${reason || ''}`.trim();
  if (a === 'trading') return `Open for trades${loc}. ${reason || ''}`.trim();
  if (a === 'fishing') return `Fishing run${loc}. ${reason || 'Need to recover and regroup.'}`;
  if (a === 'farming') return `Farming resources${loc}. ${reason || ''}`.trim();
  if (a === 'resting') return `Taking a short rest${loc}. ${reason || ''}`.trim();
  return `${reason || `I'm ${action}${loc}.`}`.trim();
}

// Health cost per action type
const ACTION_HEALTH_COST: Record<string, number> = {
  exploring: -3,
  training: -5,
  battling: -8,
  catching: -4,
  trading: -2,
  resting: 2,       // slight passive regen
  // Replenishing actions (location-dependent)
  fishing: 15,       // Old Pond
  farming: 12,       // Community Farm
  foraging: 8,       // Green Meadows
};

// Locations that boost replenishing actions
const HEALING_LOCATIONS: Record<string, string[]> = {
  'Old Pond': ['fishing', 'resting'],
  'Community Farm': ['farming', 'resting'],
  'Green Meadows': ['foraging', 'resting'],
  'Starter Town': ['resting'],
};

export async function POST(request: NextRequest) {
  try {
    const session = await getAgentAuth(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { address, action, reason, location, reasoning } = await request.json();

    if (!address || !action) {
      return NextResponse.json({ error: 'Address and action required' }, { status: 400 });
    }

    const db = await getDb();
    const normalizedAddress = address.toLowerCase();
    const now = new Date();

    // Calculate health change
    let healthDelta = ACTION_HEALTH_COST[action] ?? -2;

    // Bonus healing if doing a replenishing action at the right location
    const healingActions = location ? HEALING_LOCATIONS[location] : undefined;
    if (healingActions?.includes(action)) {
      healthDelta = Math.abs(healthDelta) + 5; // Extra bonus at correct location
    }

    // Get current agent health
    const agent = await db.collection('agents').findOne({ address: normalizedAddress });
    const currentHealth = typeof agent?.health === 'number' ? agent.health : 100;
    const maxHealth = typeof agent?.maxHealth === 'number' ? agent.maxHealth : 100;
    const newHealth = Math.max(0, Math.min(maxHealth, currentHealth + healthDelta));

    await db.collection('agent_actions').insertOne({
      address: normalizedAddress,
      action,
      reason: reason || '',
      reasoning: reasoning || reason || '',
      location: location || null,
      healthDelta,
      healthAfter: newHealth,
      timestamp: now,
    });

    await db.collection('agents').updateOne(
      { address: normalizedAddress },
      {
        $set: {
          health: newHealth,
          currentAction: action,
          currentReason: reason || '',
          currentReasoning: reasoning || reason || '',
          currentLocation: location || null,
          lastActionAt: now,
          lastSeen: now,
        },
      }
    );

    // Emit occasional global chat updates from active agents.
    if (shouldEmitChat(action)) {
      const lastChat = await db.collection('chat').findOne(
        { from: normalizedAddress },
        { sort: { timestamp: -1 } }
      );
      const lastTs = lastChat?.timestamp ? new Date(lastChat.timestamp).getTime() : 0;
      if (!lastTs || (now.getTime() - lastTs) >= CHAT_COOLDOWN_MS) {
        await db.collection('chat').insertOne({
          from: normalizedAddress,
          fromName: agent?.name || `Agent ${address.slice(0, 6)}`,
          to: null,
          toName: null,
          message: buildChatMessage(action, reasoning || reason || '', location || null),
          location: location || null,
          timestamp: now,
        });
      }
    }

    // Keep only last 100 actions per agent
    const count = await db.collection('agent_actions').countDocuments({
      address: normalizedAddress
    });

    if (count > 100) {
      const oldActions = await db.collection('agent_actions')
        .find({ address: normalizedAddress })
        .sort({ timestamp: 1 })
        .limit(count - 100)
        .toArray();

      const idsToDelete = oldActions.map(a => a._id);
      await db.collection('agent_actions').deleteMany({
        _id: { $in: idsToDelete }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Log action error:', error);
    return NextResponse.json({ error: 'Failed to log action' }, { status: 500 });
  }
}
