export const DEFAULT_MOOD = 60;
export const MIN_MOOD = 0;
export const MAX_MOOD = 100;

export function clampMood(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MOOD;
  return Math.max(MIN_MOOD, Math.min(MAX_MOOD, Math.round(value)));
}

export function getActionMoodDelta(action: string): number {
  const a = (action || '').toLowerCase();
  if (a.includes('battle')) return -2;
  if (a.includes('rest')) return 4;
  if (a.includes('fish')) return 3;
  if (a.includes('farm')) return 3;
  if (a.includes('catch')) return 2;
  if (a.includes('explor')) return 1;
  if (a.includes('trade')) return -1;
  if (a.includes('shop')) return 1;
  if (a.includes('train')) return -1;
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

  await Promise.all([
    db.collection('agents').updateOne(
      { address: winner },
      [{ $set: { mood: { $min: [MAX_MOOD, { $max: [MIN_MOOD, { $add: [{ $ifNull: ['$mood', DEFAULT_MOOD] }, 14] }] }] } } }] as any,
    ),
    db.collection('agents').updateOne(
      { address: loser },
      [{ $set: { mood: { $min: [MAX_MOOD, { $max: [MIN_MOOD, { $add: [{ $ifNull: ['$mood', DEFAULT_MOOD] }, -12] }] }] } } }] as any,
    ),
  ]);
}
