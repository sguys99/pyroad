import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchAnswerKeyRow,
  findStepAnswer,
  resolveAnswerKey,
} from '@/lib/quest/answerKeys';
import { rewardError, spendGoldenKeyRpc } from '@/lib/quest/rewardRpc';
import type { GoldenKeyResponse } from '@/lib/quest/rewards';
import type { PromptSkeleton } from '@/lib/types/database';

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

  // 1. 퀘스트 + 정답 조회 (정답이 없으면 황금키를 차감하지 않고 404)
  //    정답 코드는 quest_answer_keys에서 읽는다 (P1-02). quests의 prompt_skeleton은 폴백용
  const adminClient = createAdminClient();
  const [questResult, answerKeyRow] = await Promise.all([
    adminClient
      .from('quests')
      .select('id, prompt_skeleton, stage_id')
      .eq('id', body.quest_id)
      .maybeSingle(),
    fetchAnswerKeyRow(adminClient, body.quest_id),
  ]);

  const quest = questResult.data;
  if (!quest) {
    return rewardError('quest_not_found');
  }

  const skeleton = quest.prompt_skeleton as unknown as PromptSkeleton;
  const answerKey = resolveAnswerKey(answerKeyRow, quest);
  const isProject = Array.isArray(skeleton.steps);
  const currentStep = isProject ? (body.current_step ?? 0) : null;

  // 2. solution_code 추출 (프로젝트 퀘스트는 현재 단계의 정답)
  const solutionCode = isProject
    ? answerKey && currentStep
      ? findStepAnswer(answerKey, currentStep)?.solution_code
      : undefined
    : (answerKey?.solutionCode ?? undefined);

  if (!solutionCode) {
    return NextResponse.json(
      {
        error: '이 퀘스트에는 정답 코드가 준비되지 않았어요',
        code: 'no_solution',
      },
      { status: 404 },
    );
  }

  // 3. 황금키 차감 + used_golden_key 기록 (DB 함수가 잔여 수·스테이지 잠금·완료 여부를 잠금 아래에서 확인, P1-03)
  const result = await spendGoldenKeyRpc<{
    golden_keys: number;
    charged: boolean;
  }>(adminClient, user.id, body.quest_id, currentStep);
  if (!result.ok) return result.response;

  const response: GoldenKeyResponse = {
    solution_code: solutionCode,
    golden_keys: result.data.golden_keys,
    charged: result.data.charged,
  };
  return NextResponse.json(response);
}
