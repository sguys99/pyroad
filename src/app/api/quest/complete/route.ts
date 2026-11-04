import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { gradeSubmission } from '@/lib/quest/grade';
import { completeQuestRpc, rewardError } from '@/lib/quest/rewardRpc';
import type { QuestCompleteResponse } from '@/lib/quest/rewards';

/**
 * 퀘스트 완료 (P1-03, B05·B06)
 *
 * 완료·XP·레벨·뱃지·스테이지 클리어는 DB 함수 complete_quest 가 한 트랜잭션으로 처리합니다.
 * 이 라우트는 로그인 확인 → 채점(quest_answer_keys 기준) → RPC 호출만 합니다.
 * 힌트 수·황금키 사용은 DB 값을 쓰므로 요청 본문의 hints_used·used_golden_key 는 받지 않습니다.
 * 같은 퀘스트를 여러 번(동시에) 보내도 보상은 한 번이고, 그 뒤 요청은 already_completed 로 응답합니다.
 */
interface CompleteRequest {
  quest_id: string;
  code_submitted: string;
  /** 브라우저(Pyodide)에서 실행한 출력. 서버가 다시 채점함 (프로젝트는 마지막 단계 기준) */
  stdout?: string;
}

const MAX_CODE_LENGTH = 20_000;
const MAX_STDOUT_LENGTH = 100_000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: CompleteRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (
    typeof body?.quest_id !== 'string' ||
    typeof body.code_submitted !== 'string'
  ) {
    return NextResponse.json(
      { error: 'quest_id and code_submitted are required' },
      { status: 400 },
    );
  }
  const stdout = typeof body.stdout === 'string' ? body.stdout : '';
  if (
    body.code_submitted.length > MAX_CODE_LENGTH ||
    stdout.length > MAX_STDOUT_LENGTH
  ) {
    return rewardError('submission_too_large');
  }

  const adminClient = createAdminClient();

  // 채점: 통과하지 않은 제출은 완료하지 않는다. 황금키를 쓴 퀘스트는 DB 함수가 채점 없이 완료 (XP 0)
  const grade = await gradeSubmission(adminClient, body.quest_id, {
    stdout,
    studentCode: body.code_submitted,
    step: 'final',
  });
  if (grade.status === 'quest_not_found') {
    return rewardError('quest_not_found');
  }
  const passed = grade.status === 'graded' && grade.passed;
  if (grade.status !== 'graded') {
    console.error('[complete API] 채점 기준 없음:', {
      questId: body.quest_id,
      status: grade.status,
    });
  }

  const result = await completeQuestRpc<QuestCompleteResponse>(
    adminClient,
    user.id,
    body.quest_id,
    { code: body.code_submitted, passed },
  );
  if (!result.ok) return result.response;

  if (!result.data.already_completed) {
    // 월드맵·프로필 페이지의 Router Cache 무효화
    revalidatePath('/world');
    revalidatePath('/profile');
  }

  return NextResponse.json(result.data);
}
