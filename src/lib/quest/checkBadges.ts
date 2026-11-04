import type { BadgeType } from './badges';

/**
 * 뱃지 판정 규칙 (참조 구현)
 *
 * 실제 지급은 DB 함수 `complete_quest`가 같은 트랜잭션에서 합니다(P1-03,
 * `supabase/migrations/00006_quest_reward_rpc.sql`의 `decide_new_badges`·`has_three_day_streak`).
 * 이 파일은 규칙을 TS로 적어 둔 것으로, 두 구현은 `supabase/tests/fixtures/reward-rules.json`
 * 한 표로 대조합니다(vitest `rewardRules.test.ts` + `npm run test:rls`의 RW-1).
 * 규칙을 바꾸면 SQL·이 파일·표를 함께 고칩니다.
 */
export interface BadgeFacts {
  /** 이미 가진 뱃지 */
  earned: readonly string[];
  /** 이번 완료를 포함한 완료 퀘스트 수 */
  completedCount: number;
  /** 이번 완료로 이 퀘스트의 스테이지를 모두 완료했는지 */
  stageCleared: boolean;
  /** 이 퀘스트가 최종 프로젝트(is_final) 스테이지인지 */
  isFinalStage: boolean;
  /** DB의 힌트 사용 수 (요청 본문 값이 아님, B05) */
  hintsUsed: number;
  /** DB의 황금키 사용 여부 (B11) */
  usedGoldenKey: boolean;
  /** 3일 연속 완료 여부 (hasThreeDayStreak) */
  streak3: boolean;
}

/** 새로 줄 뱃지. 순서는 축하 연출 순서 */
export function decideNewBadges(facts: BadgeFacts): BadgeType[] {
  const earned = new Set(facts.earned);
  const badges: BadgeType[] = [];

  // first_code: 첫 퀘스트 완료
  if (!earned.has('first_code') && facts.completedCount === 1) {
    badges.push('first_code');
  }
  // hint_master: 힌트 0회 + 황금키 미사용 (B11: 황금키로 정답을 받았으면 힌트 없이 푼 것이 아님)
  if (
    !earned.has('hint_master') &&
    facts.hintsUsed === 0 &&
    !facts.usedGoldenKey
  ) {
    badges.push('hint_master');
  }
  // stage_clear: 스테이지 전체 완료
  if (!earned.has('stage_clear') && facts.stageCleared) {
    badges.push('stage_clear');
  }
  // project_builder: 최종 프로젝트 완료
  if (!earned.has('project_builder') && facts.isFinalStage) {
    badges.push('project_builder');
  }
  // streak_3: 3일 연속 완료
  if (!earned.has('streak_3') && facts.streak3) {
    badges.push('streak_3');
  }

  return badges;
}

const kstDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 'YYYY-MM-DD' (KST) → 그 날의 UTC 자정 기준 일 수 */
function kstDayNumber(iso: string): number {
  const [y, m, d] = kstDateFormat.format(new Date(iso)).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/**
 * 3일 연속: 완료한 날(KST)을 최근 순으로 3개 뽑아 하루씩 이어지는지.
 * 이번 완료가 가장 최근이므로 "오늘·어제·그제 모두 완료"와 같습니다.
 */
export function hasThreeDayStreak(
  completedAt: readonly (string | null)[],
): boolean {
  const days = [
    ...new Set(completedAt.filter((c): c is string => !!c).map(kstDayNumber)),
  ].sort((a, b) => b - a);
  if (days.length < 3) return false;
  return days[0] - days[1] === 1 && days[1] - days[2] === 1;
}
