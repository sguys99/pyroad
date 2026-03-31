const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000] as const;

export const LEVEL_TITLES: Record<number, string> = {
  1: '코딩 새싹',
  2: '코딩 탐험가',
  3: '코딩 모험가',
  4: '코딩 용사',
  5: '코딩 마법사',
};

export function calculateXP(baseXP: number, hintsUsed: number): number {
  if (hintsUsed === 0) return Math.round(baseXP * 1.5);
  if (hintsUsed === 1) return Math.round(baseXP * 1.25);
  return baseXP;
}

export function calculateLevel(totalXP: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function getLevelTitle(level: number): string {
  return LEVEL_TITLES[level] ?? '코딩 새싹';
}
