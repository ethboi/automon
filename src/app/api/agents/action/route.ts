import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAgentAuth } from '@/lib/agentAuth';
export const dynamic = 'force-dynamic';

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

    // Calculate health change
    let healthDelta = ACTION_HEALTH_COST[action] ?? -2;

    // Bonus healing if doing a replenishing action at the right location
    const healingActions = location ? HEALING_LOCATIONS[location] : undefined;
    if (healingActions?.includes(action)) {
      healthDelta = Math.abs(healthDelta) + 5; // Extra bonus at correct location
    }

    // Get current agent health
    const agent = await db.collection('agents').findOne({ address: address.toLowerCase() });
    const currentHealth = typeof agent?.health === 'number' ? agent.health : 100;
    const maxHealth = typeof agent?.maxHealth === 'number' ? agent.maxHealth : 100;
    const newHealth = Math.max(0, Math.min(maxHealth, currentHealth + healthDelta));

    await db.collection('agent_actions').insertOne({
      address: address.toLowerCase(),
      action,
      reason: reason || '',
      reasoning: reasoning || reason || '',
      location: location || null,
      healthDelta,
      healthAfter: newHealth,
      timestamp: new Date(),
    });

    await db.collection('agents').updateOne(
      { address: address.toLowerCase() },
      {
        $set: {
          health: newHealth,
          currentAction: action,
          currentReason: reason || '',
          currentReasoning: reasoning || reason || '',
          currentLocation: location || null,
          lastActionAt: new Date(),
          lastSeen: new Date(),
        },
      }
    );

    // Keep only last 100 actions per agent
    const count = await db.collection('agent_actions').countDocuments({
      address: address.toLowerCase()
    });

    if (count > 100) {
      const oldActions = await db.collection('agent_actions')
        .find({ address: address.toLowerCase() })
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
