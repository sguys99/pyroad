// XP·레벨 규칙. 실제 지급은 DB 함수 complete_quest(00006 의 quest_xp·level_for_xp)가 하고,
// 이 파일과 SQL 은 supabase/tests/fixtures/reward-rules.json 한 표로 대조합니다 (P1-03).
// 규칙을 바꾸면 SQL·이 파일·표를 함께 고칩니다.
export const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000] as const;

export const LEVEL_TITLES: Record<number, string> = {
  1: '코딩 새싹',
  2: '코딩 탐험가',
  3: '코딩 모험가',
  4: '코딩 용사',
  5: '코딩 마법사',
};

export function calculateXP(
  baseXP: number,
  hintsUsed: number,
  usedGoldenKey?: boolean,
): number {
  if (usedGoldenKey) return 0;
  if (hintsUsed === 0) return Math.round(baseXP * 1.5);
  if (hintsUsed === 1) return Math.round(baseXP * 1.25);
  return baseXP;
}

/**
 * 코드·프로젝트 퀘스트의 별 (F3·§12-Q17, 최종 시안 Quest.tsx maxStars): 황금키 1 / 힌트 0회 3 / 1회 2 / 그 외 1.
 * 지금은 힌트·황금키 안내의 미리 보기에만 쓴다(SHOW_STARS가 꺼져 있어 화면엔 XP). 서버 판정은 P8-05에서 같은 규칙으로
 */
export function codeQuestStars(
  hintsUsed: number,
  usedGoldenKey: boolean,
): 1 | 2 | 3 {
  if (usedGoldenKey) return 1;
  if (hintsUsed === 0) return 3;
  return hintsUsed === 1 ? 2 : 1;
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

export function getXPProgress(totalXP: number): {
  currentLevel: number;
  currentLevelXP: number;
  nextLevelXP: number | null;
  progressPercent: number;
} {
  const currentLevel = calculateLevel(totalXP);
  const currentLevelXP = LEVEL_THRESHOLDS[currentLevel - 1];
  const nextLevelXP =
    currentLevel < LEVEL_THRESHOLDS.length
      ? LEVEL_THRESHOLDS[currentLevel]
      : null;

  if (nextLevelXP === null) {
    return { currentLevel, currentLevelXP, nextLevelXP, progressPercent: 100 };
  }

  const progress = totalXP - currentLevelXP;
  const required = nextLevelXP - currentLevelXP;
  const progressPercent = Math.round((progress / required) * 100);

  return { currentLevel, currentLevelXP, nextLevelXP, progressPercent };
}
