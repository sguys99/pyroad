import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { gradeSubmission } from '@/lib/quest/grade';
import { parseGradePayload } from '@/lib/quest/gradeRuns';

/** + stdout·turtle(한 번 실행) 또는 runs(시험 손님마다, P11-05) — src/lib/quest/gradeRuns.ts */
interface ValidateRequest {
  quest_id: string;
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

  if (!body?.quest_id) {
    return NextResponse.json(
      { error: 'quest_id is required' },
      { status: 400 },
    );
  }
  const parsed = parseGradePayload(body as unknown as Record<string, unknown>);
  if (!parsed.ok) {
    return parsed.error === 'too_large'
      ? NextResponse.json({ error: 'Submission too large' }, { status: 413 })
      : NextResponse.json({ error: 'Invalid runs' }, { status: 400 });
  }

  // 채점 기준은 quest_answer_keys에서 읽는다 (P1-02). 완료 API와 같은 채점 함수 (P1-03)
  const result = await gradeSubmission(createAdminClient(), body.quest_id, {
    ...parsed.payload,
    studentCode: typeof body.student_code === 'string' ? body.student_code : '',
    step: typeof body.step_number === 'number' ? body.step_number : undefined,
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

  // 손님별 통과·그림 이유는 정답을 드러내지 않는 것만 (출력 기준값은 서버 밖으로 안 나감)
  return NextResponse.json({
    passed: result.passed,
    ...(result.scenarios && { scenarios: result.scenarios }),
    ...(result.reasons?.length && { reasons: result.reasons }),
  });
}
