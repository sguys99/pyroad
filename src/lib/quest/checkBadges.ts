import { kstDayNumberOf } from '@/lib/time/kst';
import type { BadgeType } from './badges';

/**
 * 뱃지 판정 규칙 (참조 구현)
 *
 * 실제 지급은 DB 함수 `complete_quest`가 같은 트랜잭션에서 합니다(P1-03,
 * `supabase/migrations/00006_quest_reward_rpc.sql`의 `has_three_day_streak`,
 * `00019_golden_key_no_badges.sql`의 `decide_new_badges`·`complete_quest`).
 * 이 파일은 규칙을 TS로 적어 둔 것으로, 두 구현은 `supabase/tests/fixtures/reward-rules.json`
 * 한 표로 대조합니다(vitest `rewardRules.test.ts` + `npm run test:rls`의 RW-1).
 * 규칙을 바꾸면 SQL·이 파일·표를 함께 고칩니다.
 *
 * 황금키(정답 보기)로 완료한 퀘스트는 뱃지를 주지 않습니다(§12-Q25, §2.6 "보상은 학습 행동에만").
 * 그래서 `completedCount`·`streak3`도 직접 푼 완료만 셉니다. 스테이지 클리어(`stageCleared`)는 진행이므로
 * 황금키 퀘스트도 완료로 셉니다.
 */
export interface BadgeFacts {
  /** 이미 가진 뱃지 */
  earned: readonly string[];
  /** 이번 완료를 포함한, 황금키 없이 직접 푼 완료 퀘스트 수 (Q25) */
  completedCount: number;
  /** 이번 완료로 이 퀘스트의 스테이지를 모두 완료했는지 (황금키로 완료한 퀘스트도 완료로 셈) */
  stageCleared: boolean;
  /** 이 퀘스트가 최종 프로젝트(is_final) 스테이지인지 */
  isFinalStage: boolean;
  /** DB의 힌트 사용 수 (요청 본문 값이 아님, B05) */
  hintsUsed: number;
  /** DB의 황금키 사용 여부 (프로젝트는 한 단계라도). true면 어떤 뱃지도 주지 않음 (B11, Q25) */
  usedGoldenKey: boolean;
  /** 직접 푼 완료일 기준 3일 연속 여부 (hasThreeDayStreak, Q25) */
  streak3: boolean;
}

/** 새로 줄 뱃지. 순서는 축하 연출 순서 */
export function decideNewBadges(facts: BadgeFacts): BadgeType[] {
  // 황금키로 정답을 받아 완료했으면 뱃지 없음 (Q25. B11의 hint_master 제외를 모든 뱃지로 넓힘)
  if (facts.usedGoldenKey) return [];

  const earned = new Set(facts.earned);
  const badges: BadgeType[] = [];

  // first_code: 처음 직접 푼 퀘스트 (황금키로 먼저 완료한 퀘스트가 있어도)
  if (!earned.has('first_code') && facts.completedCount === 1) {
    badges.push('first_code');
  }
  // hint_master: 힌트 0회 (황금키는 위에서 제외, B11)
  if (!earned.has('hint_master') && facts.hintsUsed === 0) {
    badges.push('hint_master');
  }
  // stage_clear: 스테이지 전체 완료 (앞서 황금키로 연 퀘스트가 있어도, 이번 퀘스트를 직접 풀어 클리어했으면)
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

/**
 * 3일 연속: 완료한 날(KST, `src/lib/time/kst.ts`)을 최근 순으로 3개 뽑아 하루씩 이어지는지.
 * 이번 완료가 가장 최근이므로 "오늘·어제·그제 모두 완료"와 같습니다.
 */
export function hasThreeDayStreak(
  completedAt: readonly (string | null)[],
): boolean {
  const days = [
    ...new Set(completedAt.filter((c): c is string => !!c).map(kstDayNumberOf)),
  ].sort((a, b) => b - a);
  if (days.length < 3) return false;
  return days[0] - days[1] === 1 && days[1] - days[2] === 1;
}
