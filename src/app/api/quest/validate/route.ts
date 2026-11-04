import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateResult } from '@/lib/quest/validation';
import {
  fetchAnswerKeyRow,
  findStepAnswer,
  resolveAnswerKey,
} from '@/lib/quest/answerKeys';
import type { PromptSkeleton } from '@/lib/types/database';

interface ValidateRequest {
  quest_id: string;
  stdout: string;
  student_code: string;
  step_number?: number;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ValidateRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.quest_id) {
    return NextResponse.json(
      { error: 'quest_id is required' },
      { status: 400 },
    );
  }

  // 채점 기준은 quest_answer_keys에서 읽는다 (P1-02). expected_output·prompt_skeleton은 폴백용
  const adminClient = createAdminClient();
  const [{ data: quest }, answerKeyRow] = await Promise.all([
    adminClient
      .from('quests')
      .select('validation_type, expected_output, prompt_skeleton')
      .eq('id', body.quest_id)
      .single(),
    fetchAnswerKeyRow(adminClient, body.quest_id),
  ]);

  if (!quest) {
    return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
  }

  const answerKey = resolveAnswerKey(answerKeyRow, quest);
  if (!answerKey) {
    return NextResponse.json(
      { error: 'Answer key not found' },
      { status: 404 },
    );
  }

  let validationType = quest.validation_type as
    | 'output_match'
    | 'contains'
    | 'code_check';
  let expectedOutput = answerKey.expectedOutput;

  // 프로젝트 퀘스트의 개별 스텝 검증 (규칙 종류는 공개 skeleton, 기준값은 정답 테이블)
  if (body.step_number != null) {
    const skeleton = quest.prompt_skeleton as unknown as PromptSkeleton;
    const step = skeleton.steps?.find(
      (s) => s.step_number === body.step_number,
    );
    const stepAnswer = findStepAnswer(answerKey, body.step_number);
    if (!step || !stepAnswer) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }
    validationType = step.validation_type;
    expectedOutput = stepAnswer.expected_output;
  }

  // 기준이 비어 있으면 contains·code_check가 모든 답을 통과시키므로 채점하지 않는다
  if (!expectedOutput) {
    return NextResponse.json(
      { error: 'Answer key not found' },
      { status: 404 },
    );
  }

  const result = validateResult({
    validationType,
    expectedOutput,
    stdout: body.stdout ?? '',
    studentCode: body.student_code ?? '',
  });

  return NextResponse.json({ passed: result.passed });
}
