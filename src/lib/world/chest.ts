import { coinReward } from '@/lib/quest/coins';
import type { StageWithStatus } from '@/lib/types/database';

/**
 * 스테이지 보물상자 (P8-06, §3 F11). 판정·지급은 서버 `open_stage_chest`(00033)만, 여기는 화면용 사본.
 *
 * 목표 별 = ceil(코드 퀘스트 수 × 3 × 0.7) — SQL `stage_chest_goal`과 같은 식(대조 `reward-rules.json` "chest_goal").
 * 코드 퀘스트(퀴즈 제외, 스테이지 클리어와 같은 `totalQuestCount`)만으로 정해 코드 퀘스트만으로도 닿고, 합계에는 퀴즈 별도
 * 들어가(월드맵 `stage.stars`) 보너스 퀴즈 복습이 상자를 앞당긴다. 콘텐츠 필드가 아니라 자동 계산이라 퀘스트를 더해도 따라온다.
 * 예: 코드 퀘스트 7개 → 15⭐(최대 21의 약 70%)
 */
export function chestGoal(codeQuests: number): number {
  return codeQuests > 0 ? Math.floor((codeQuests * 21 + 9) / 10) : 0;
}

/** 상자 안 코인 (내용 공개형 §2.6 — 열기 전에 보여 줌). 마지막 스테이지(is_final)는 50, 그 밖 30 */
export function chestCoins(isFinal: boolean): number {
  return coinReward('chest', isFinal ? 2 : 1);
}

/** none: 상자 없음(코드 퀘스트 0) · locked: 별 모으는 중 · ready: 열 수 있음 · opened: 열었음 */
export type ChestState = 'none' | 'locked' | 'ready' | 'opened';

export function chestState(
  stage: Pick<
    StageWithStatus,
    'status' | 'stars' | 'totalQuestCount' | 'chestOpened'
  >,
): ChestState {
  const goal = chestGoal(stage.totalQuestCount);
  if (goal === 0 || stage.status === 'locked') return 'none';
  if (stage.chestOpened) return 'opened';
  return stage.stars >= goal ? 'ready' : 'locked';
}
