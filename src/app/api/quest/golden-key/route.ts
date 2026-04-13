import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { QuestWithStageServer } from '@/lib/types/database';

interface GoldenKeyRequest {
  quest_id: string;
  current_step?: number;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: GoldenKeyRequest;
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

  // 1. 유저 황금키 잔여 수 확인 + 퀘스트 조회 — 병렬
  const adminClient = createAdminClient();
  const [profileResult, questResult] = await Promise.all([
    supabase
      .from('users')
      .select('golden_keys')
      .eq('id', user.id)
      .single(),
    adminClient
      .from('quests')
      .select('id, prompt_skeleton, stage_id')
      .eq('id', body.quest_id)
      .single(),
  ]);

  const goldenKeys = profileResult.data?.golden_keys ?? 0;
  if (goldenKeys <= 0) {
    return NextResponse.json(
      { error: '황금키가 부족합니다', golden_keys: 0 },
      { status: 400 },
    );
  }

  const quest = questResult.data;
  if (!quest) {
    return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
  }

  const skeleton = (quest as unknown as QuestWithStageServer).prompt_skeleton;

  // 2. solution_code 추출
  let solutionCode: string | undefined;
  const currentStep = body.current_step ?? 0;

  if (skeleton.steps && currentStep > 0) {
    // 프로젝트 퀘스트: 현재 단계의 solution_code
    const stepDef = skeleton.steps[currentStep - 1];
    solutionCode = stepDef?.solution_code;
  } else {
    solutionCode = skeleton.solution_code;
  }

  if (!solutionCode) {
    return NextResponse.json(
      { error: '이 퀘스트에는 정답 코드가 준비되지 않았습니다' },
      { status: 404 },
    );
  }

  // 3. 기존 진행 상태 확인 (completed 강등 방지)
  const { data: existingProgress } = await supabase
    .from('user_progress')
    .select('status')
    .eq('user_id', user.id)
    .eq('quest_id', body.quest_id)
    .maybeSingle();

  const progressStatus =
    existingProgress?.status === 'completed'
      ? ('completed' as const)
      : ('in_progress' as const);

  // 4. 황금키 1개 차감 + user_progress 기록 — 병렬
  await Promise.all([
    supabase
      .from('users')
      .update({ golden_keys: goldenKeys - 1 })
      .eq('id', user.id),
    supabase.from('user_progress').upsert(
      {
        user_id: user.id,
        quest_id: body.quest_id,
        used_golden_key: true,
        status: progressStatus,
      },
      { onConflict: 'user_id,quest_id' },
    ),
  ]);

  return NextResponse.json({
    solution_code: solutionCode,
    golden_keys: goldenKeys - 1,
  });
}
