import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { validateResult } from '@/lib/quest/validation';
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
export interface Submission {
  stdout: string;
  studentCode: string;
  /**
   * 프로젝트 퀘스트의 단계 번호. 코드 퀘스트는 생략.
   * 'final'은 완료 판정: 프로젝트 퀘스트는 마지막 단계, 코드 퀘스트는 퀘스트 자체
   */
  step?: number | 'final';
}

export type GradeResult =
  | { status: 'graded'; passed: boolean }
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

  // 프로젝트 퀘스트의 개별 스텝 검증 (규칙 종류는 공개 skeleton, 기준값은 정답 테이블)
  const steps = (quest.prompt_skeleton as unknown as PromptSkeleton).steps;
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
  }

  // 기준이 비어 있으면 contains·code_check가 모든 답을 통과시키므로 채점하지 않는다
  if (!expectedOutput) return { status: 'answer_key_not_found' };

  const result = validateResult({
    validationType,
    expectedOutput,
    stdout: submission.stdout,
    studentCode: submission.studentCode,
  });
  return { status: 'graded', passed: result.passed };
}
