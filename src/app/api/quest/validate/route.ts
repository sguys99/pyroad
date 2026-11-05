import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { gradeSubmission } from '@/lib/quest/grade';

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

  // 채점 기준은 quest_answer_keys에서 읽는다 (P1-02). 완료 API와 같은 채점 함수 (P1-03)
  const result = await gradeSubmission(createAdminClient(), body.quest_id, {
    stdout: body.stdout ?? '',
    studentCode: body.student_code ?? '',
    step: body.step_number ?? undefined,
  });

  if (result.status === 'quest_not_found') {
    return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
  }
  if (result.status === 'step_not_found') {
    return NextResponse.json({ error: 'Step not found' }, { status: 404 });
  }
  if (result.status === 'answer_key_not_found') {
    return NextResponse.json(
      { error: 'Answer key not found' },
      { status: 404 },
    );
  }

  return NextResponse.json({ passed: result.passed });
}
