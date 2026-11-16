import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  drawingReasons,
  parseStoredRule,
  validateRule,
  type RunContext,
} from '@/lib/quest/validation';
import type { GradePayload } from '@/lib/quest/gradeRuns';
import {
  fetchAnswerKeyRow,
  findStepAnswer,
  resolveAnswerKey,
} from '@/lib/quest/answerKeys';
import type {
  Database,
  PromptSkeleton,
  ValidationType,
} from '@/lib/types/database';

/**
 * 제출 채점 (서버 전용). `/api/quest/validate`(결과 보여 주기)와 `/api/quest/complete`(완료 전 확인, P1-03)가
 * 같은 규칙으로 채점하도록 한 곳에 둡니다. 기준값은 quest_answer_keys(answerKeys.ts)에서 읽습니다.
 */
export interface Submission extends GradePayload {
  studentCode: string;
  /**
   * 프로젝트 퀘스트의 단계 번호. 코드 퀘스트는 생략.
   * 'final'은 완료 판정: 프로젝트 퀘스트는 마지막 단계, 코드 퀘스트는 퀘스트 자체
   */
  step?: number | 'final';
}

export type GradeResult =
  | {
      status: 'graded';
      passed: boolean;
      /** 시험 손님마다 통과했는지 (손님이 있는 퀘스트·단계만, P11-05) */
      scenarios?: boolean[];
      /** 떨어진 그림 규칙의 이유 (아이용 한국어 문장, 튜터 힌트). 출력 규칙 이유는 정답이라 내지 않음 */
      reasons?: string[];
    }
  | { status: 'quest_not_found' }
  | { status: 'step_not_found' }
  | { status: 'answer_key_not_found' };

export async function gradeSubmission(
  admin: SupabaseClient<Database>,
  questId: string,
  submission: Submission,
): Promise<GradeResult> {
  const [{ data: quest }, answerKeyRow] = await Promise.all([
    admin
      .from('quests')
      .select('validation_type, expected_output, prompt_skeleton')
      .eq('id', questId)
      .maybeSingle(),
    fetchAnswerKeyRow(admin, questId),
  ]);
  if (!quest) return { status: 'quest_not_found' };

  // expected_output·prompt_skeleton은 quest_answer_keys가 없을 때의 폴백용 (P1-02)
  const answerKey = resolveAnswerKey(answerKeyRow, quest);
  if (!answerKey) return { status: 'answer_key_not_found' };

  let validationType = quest.validation_type as ValidationType;
  let expectedOutput = answerKey.expectedOutput;
  const skeleton = quest.prompt_skeleton as unknown as PromptSkeleton;
  let scenarioCount = skeleton.scenarios?.length ?? 0;

  // 프로젝트 퀘스트의 개별 스텝 검증 (규칙 종류는 공개 skeleton, 기준값은 정답 테이블)
  const steps = skeleton.steps;
  const isFinalOfCodeQuest = submission.step === 'final' && !steps?.length;
  if (submission.step != null && !isFinalOfCodeQuest) {
    const stepNumber =
      submission.step === 'final'
        ? Math.max(...steps!.map((s) => s.step_number))
        : submission.step;
    const step = steps?.find((s) => s.step_number === stepNumber);
    const stepAnswer = findStepAnswer(answerKey, stepNumber);
    if (!step || !stepAnswer) return { status: 'step_not_found' };
    validationType = step.validation_type;
    expectedOutput = stepAnswer.expected_output;
    scenarioCount = step.scenarios?.length ?? 0;
  }

  // 기준이 비어 있으면 contains·code_check가 모든 답을 통과시키므로 채점하지 않는다
  if (!expectedOutput) return { status: 'answer_key_not_found' };
  const rule = parseStoredRule(validationType, expectedOutput);
  if (!rule) return { status: 'graded', passed: false };

  // 시험 손님이 있으면 손님마다 한 번씩 실행한 결과가 모두 와야 한다 (P11-05). 없으면 한 번 실행
  const runs: RunContext[] =
    scenarioCount > 0
      ? (submission.runs ?? []).map((r, scenario) => ({
          stdout: r.stdout,
          turtle: r.turtle,
          studentCode: submission.studentCode,
          scenario,
        }))
      : [
          {
            stdout: submission.stdout,
            turtle: submission.turtle,
            studentCode: submission.studentCode,
          },
        ];
  if (scenarioCount > 0 && runs.length !== scenarioCount)
    return { status: 'graded', passed: false, scenarios: [] };

  const results = runs.map((ctx) => validateRule(rule, ctx));
  const failed = runs.find((_, i) => !results[i]);
  return {
    status: 'graded',
    passed: results.every(Boolean),
    ...(scenarioCount > 0 && { scenarios: results }),
    ...(failed && { reasons: drawingReasons(rule, failed) }),
  };
}
