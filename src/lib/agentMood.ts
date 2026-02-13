export const DEFAULT_MOOD = 60;
export const MIN_MOOD = 0;
export const MAX_MOOD = 100;

export function clampMood(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MOOD;
  return Math.max(MIN_MOOD, Math.min(MAX_MOOD, Math.round(value)));
}

export function getActionMoodDelta(action: string): number {
  const a = (action || '').toLowerCase();
  if (a.includes('battle_result')) return 0; // explicit win/loss deltas are logged separately
  if (a.includes('battle')) return -3;
  if (a.includes('rest')) return 10;
  if (a.includes('fish')) return 8;
  if (a.includes('farm')) return 8;
  if (a.includes('forag')) return 6;
  if (a.includes('catch')) return 5;
  if (a.includes('explor')) return 4;
  if (a.includes('wander') || a.includes('move')) return 3;
  if (a.includes('trading_token')) return -3;
  if (a.includes('trade')) return -1;
  if (a.includes('shop')) return 1;
  if (a.includes('train')) return -2;
  if (a.includes('online')) return 1;
  return 0;
}

export function getBattleMoodMultiplier(mood: number): number {
  const normalized = (clampMood(mood) - 50) / 50;
  return 1 + normalized * 0.12;
}

export function getMoodTier(mood: number): string {
  const m = clampMood(mood);
  if (m >= 85) return 'ecstatic';
  if (m >= 70) return 'hyped';
  if (m >= 55) return 'steady';
  if (m >= 40) return 'tense';
  if (m >= 25) return 'tilted';
  return 'doom';
}

export async function applyBattleMoodResult(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  winnerAddress: string | null | undefined,
  player1Address: string | null | undefined,
  player2Address: string | null | undefined,
): Promise<void> {
  const p1 = player1Address?.toLowerCase();
  const p2 = player2Address?.toLowerCase();
  const winner = winnerAddress?.toLowerCase();
  if (!p1 || !p2 || !winner || winner === 'draw') return;

  const loser = winner === p1 ? p2 : p1;
  const now = new Date();
  const [winnerAgent, loserAgent] = await Promise.all([
    db.collection('agents').findOne({ address: winner }),
    db.collection('agents').findOne({ address: loser }),
  ]);

  const winnerBefore = clampMood(typeof winnerAgent?.mood === 'number' ? winnerAgent.mood : DEFAULT_MOOD);
  const loserBefore = clampMood(typeof loserAgent?.mood === 'number' ? loserAgent.mood : DEFAULT_MOOD);
  const winnerDelta = 18;
  const loserDelta = -16;
  const winnerAfter = clampMood(winnerBefore + winnerDelta);
  const loserAfter = clampMood(loserBefore + loserDelta);

  await Promise.all([
    db.collection('agents').updateOne(
      { address: winner },
      {
        $set: {
          mood: winnerAfter,
          moodLabel: getMoodTier(winnerAfter),
          currentAction: 'battle_result',
          currentReason: 'Won a battle',
          currentReasoning: 'Won battle and got a confidence boost.',
          currentLocation: winnerAgent?.currentLocation || 'Town Arena',
          lastActionAt: now,
          lastSeen: now,
        },
      },
    ),
    db.collection('agents').updateOne(
      { address: loser },
      {
        $set: {
          mood: loserAfter,
          moodLabel: getMoodTier(loserAfter),
          currentAction: 'battle_result',
          currentReason: 'Lost a battle',
          currentReasoning: 'Lost battle and took a morale hit.',
          currentLocation: loserAgent?.currentLocation || 'Town Arena',
          lastActionAt: now,
          lastSeen: now,
        },
      },
    ),
    db.collection('agent_actions').insertMany([
      {
        address: winner,
        action: 'battle_result',
        reason: 'Won a battle',
        reasoning: 'Won battle and got a confidence boost.',
        location: winnerAgent?.currentLocation || 'Town Arena',
        healthDelta: 0,
        healthAfter: typeof winnerAgent?.health === 'number' ? winnerAgent.health : undefined,
        moodDelta: winnerDelta,
        moodAfter: winnerAfter,
        timestamp: now,
      },
      {
        address: loser,
        action: 'battle_result',
        reason: 'Lost a battle',
        reasoning: 'Lost battle and took a morale hit.',
        location: loserAgent?.currentLocation || 'Town Arena',
        healthDelta: 0,
        healthAfter: typeof loserAgent?.health === 'number' ? loserAgent.health : undefined,
        moodDelta: loserDelta,
        moodAfter: loserAfter,
        timestamp: now,
      },
    ]),
  ]);
}
