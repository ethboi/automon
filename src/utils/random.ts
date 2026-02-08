export const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const sample = <T>(list: T[]): T => list[randInt(0, list.length - 1)];

export const weightedChoice = <T extends { weight: number }>(list: T[]): T | null => {
  if (!list.length) return null;
  const total = list.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of list) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return list[list.length - 1];
};

export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
