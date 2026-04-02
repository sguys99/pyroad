import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateResult } from '@/lib/quest/validation';
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

  const { data: quest } = await supabase
    .from('quests')
    .select('validation_type, expected_output, prompt_skeleton')
    .eq('id', body.quest_id)
    .single();

  if (!quest) {
    return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
  }

  let validationType = quest.validation_type as
    | 'output_match'
    | 'contains'
    | 'code_check';
  let expectedOutput = quest.expected_output as string;

  // 프로젝트 퀘스트의 개별 스텝 검증
  if (body.step_number != null) {
    const skeleton = quest.prompt_skeleton as unknown as PromptSkeleton;
    const step = skeleton.steps?.find(
      (s) => s.step_number === body.step_number,
    );
    if (!step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }
    validationType = step.validation_type;
    expectedOutput = step.expected_output;
  }

  const result = validateResult({
    validationType,
    expectedOutput,
    stdout: body.stdout ?? '',
    studentCode: body.student_code ?? '',
  });

  return NextResponse.json({ passed: result.passed });
}
