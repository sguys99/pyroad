// 실력 확인 퀴즈 (P10-03, §12-Q2·Q72 ②, docs/curriculum/world2.md §7). 화면·서버가 같이 쓰는 순수 함수·타입.
// 채점·하루 1번·합격은 DB 함수(00052 skill_check_start·skill_check_submit)만 정하고, 정답은 서버 밖으로 나오지 않음.
import type { QuizPrompt } from '@/lib/types/database';

import type { WorldWithStatus } from './getStageStatuses';

/** 본인 도전 기록 (skill_check_attempts, 00052 본인 SELECT). attempt_on 은 KST 'YYYY-MM-DD' */
export interface SkillCheckAttemptRow {
  user_id: string;
  world_id: string;
  attempt_on: string;
  passed: boolean;
  submitted_at: string | null;
}

/** 틀린 문제의 복습 스테이지 (스테이지마다 하나, 정답·문제 번호 없음) */
export interface SkillCheckPractice {
  quest_id: string;
  stage_id: string;
  stage_order: number;
  stage_title: string;
  world_slug: string;
}

/** 채점 결과 (skill_check_submit 반환) */
export interface SkillCheckResult {
  score: number;
  total: number;
  pass_score: number;
  passed: boolean;
  practice: SkillCheckPractice[];
  /** 합격이면 열린 월드의 첫 스테이지 */
  first_stage_id: string | null;
}

/** skill_check_start 반환 */
export interface SkillCheckStartRpc {
  status: 'ready' | 'done' | 'open';
  set_no: number | null;
  attempt_on: string;
  score: number | null;
  total: number | null;
  passed: boolean | null;
  practice: SkillCheckPractice[];
}

/** `/api/world/skill-check` 시작 응답. ready 면 오늘 묶음 문제(보기는 서버가 섞음, 정답 없음) */
export type SkillCheckStartResponse =
  | { status: 'ready'; questions: QuizPrompt[] }
  | { status: 'done'; result: Omit<SkillCheckResult, 'first_stage_id'> }
  | { status: 'open' };

/** 합격 기준 (SQL 00052 와 같은 셈): 문제의 80% 이상 → 10문제면 8 */
export const skillCheckPassScore = (total: number) => Math.ceil(total * 0.8);

/** 지금 묶음 문제 수 (설계서 §7, content SKILL_CHECK.questions) */
export const SKILL_CHECK_QUESTIONS = 10;

/** 합격한 월드 id → getStageStatuses 의 skillPassWorldIds */
export function skillPassWorldIds(
  rows: readonly Pick<SkillCheckAttemptRow, 'world_id' | 'passed'>[],
): Set<string> {
  return new Set(rows.filter((r) => r.passed).map((r) => r.world_id));
}

/**
 * 잠긴 월드 중 실력 확인 퀴즈가 있는 월드에 진입점 상태를 붙인다 (책장·잠긴 표지·다음 권).
 * 오늘(KST) 이미 제출했으면 triedToday — "오늘은 이미 도전했어요, 내일 다시". 시작만 하고 안 냈으면 이어 풀 수 있음
 */
export function attachSkillChecks(
  worlds: WorldWithStatus[],
  rows: readonly SkillCheckAttemptRow[],
  today: string,
): void {
  for (const w of worlds) {
    const worldId = w.stages[0]?.world_id;
    if (!w.world.skill_check || w.status !== 'locked' || !worldId) continue;
    w.skillCheck = {
      triedToday: rows.some(
        (r) =>
          r.world_id === worldId &&
          r.attempt_on === today &&
          r.submitted_at !== null,
      ),
    };
  }
}

/** 실력 확인 퀴즈 화면 주소 */
export const skillCheckPath = (slug: string) => `/world/${slug}/skill-check`;
