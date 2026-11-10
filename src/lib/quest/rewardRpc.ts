import 'server-only';

import { NextResponse } from 'next/server';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/types/database';
import type { RewardErrorResponse } from './rewards';
import { STAGE_LOCKED_MESSAGE } from '@/lib/world/stageLock';
import { reportServerError } from '@/lib/api/serverError';

/**
 * 보상 RPC 호출 (서버 전용, P1-03)
 *
 * complete_quest · use_golden_key · reset_progress 는 service_role 만 실행할 수 있습니다(00006).
 * API Route 는 `auth.getUser()`로 확인한 사용자 id 만 넘기고, 클라이언트가 보낸 user id·힌트 수·황금키 사용 여부는
 * 넘기지 않습니다(§2.3, B05).
 */
type AdminClient = SupabaseClient<Database>;

export type RpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse<RewardErrorResponse> };

/** DB 함수가 RAISE 하는 message → HTTP 상태 + 아이에게 보여 줄 문구 */
const RPC_ERRORS: Record<string, { status: number; error: string }> = {
  invalid_arguments: { status: 400, error: '요청이 올바르지 않아요.' },
  invalid_step: { status: 400, error: '단계 정보가 올바르지 않아요.' },
  submission_too_large: { status: 413, error: '코드가 너무 길어요.' },
  answer_too_large: { status: 413, error: '답이 너무 길어요.' },
  not_quiz: { status: 400, error: '퀴즈 문제가 아니에요.' },
  quest_not_found: { status: 404, error: '퀘스트를 찾을 수 없어요.' },
  stage_not_found: { status: 404, error: '해당 스테이지를 찾을 수 없어요.' },
  user_not_found: { status: 404, error: '사용자 정보를 찾을 수 없어요.' },
  stage_locked: { status: 403, error: STAGE_LOCKED_MESSAGE },
  not_passed: {
    status: 422,
    error: '아직 정답이 아니에요. 코드를 다시 돌려 볼까요?',
  },
  already_completed: { status: 409, error: '이미 완료한 퀘스트예요!' },
  no_golden_keys: { status: 400, error: '황금키가 부족해요.' },
};

export function rewardError(
  code: string,
  status?: number,
  message?: string,
): NextResponse<RewardErrorResponse> {
  const known = RPC_ERRORS[code];
  return NextResponse.json(
    {
      error:
        message ??
        known?.error ??
        '앗, 잠깐 문제가 생겼어요. 잠시 후 다시 해 볼까요?',
      code,
    },
    { status: status ?? known?.status ?? 500 },
  );
}

function fromRpcError(
  fn: string,
  error: PostgrestError,
): NextResponse<RewardErrorResponse> {
  if (RPC_ERRORS[error.message]) return rewardError(error.message);
  reportServerError(error, { area: 'rewardRpc', op: fn });
  return rewardError('server_error', 500);
}

async function callRpc<T>(
  fn:
    | 'complete_quest'
    | 'use_golden_key'
    | 'reset_progress'
    | 'submit_quiz_answer',
  run: () => PromiseLike<{ data: Json | null; error: PostgrestError | null }>,
): Promise<RpcResult<T>> {
  const { data, error } = await run();
  if (error) return { ok: false, response: fromRpcError(fn, error) };
  return { ok: true, data: data as T };
}

export function completeQuestRpc<T>(
  admin: AdminClient,
  userId: string,
  questId: string,
  submission: { code: string; passed: boolean },
) {
  return callRpc<T>('complete_quest', () =>
    admin.rpc('complete_quest', {
      p_user_id: userId,
      p_quest_id: questId,
      p_submission: submission,
    }),
  );
}

export function spendGoldenKeyRpc<T>(
  admin: AdminClient,
  userId: string,
  questId: string,
  step: number | null,
) {
  return callRpc<T>('use_golden_key', () =>
    admin.rpc('use_golden_key', {
      p_user_id: userId,
      p_quest_id: questId,
      ...(step != null && { p_step: step }),
    }),
  );
}

export function resetProgressRpc<T>(
  admin: AdminClient,
  userId: string,
  scope: { type: 'all' } | { type: 'stage'; stageId: string },
) {
  return callRpc<T>('reset_progress', () =>
    admin.rpc('reset_progress', {
      p_user_id: userId,
      p_scope: scope.type,
      ...(scope.type === 'stage' && { p_stage_id: scope.stageId }),
    }),
  );
}

/** 퀴즈 채점 (P7-02, 00026). answer 는 API 가 zod 로 확인한 정규형 그대로 */
export function submitQuizAnswerRpc<T>(
  admin: AdminClient,
  userId: string,
  questId: string,
  answer: Json,
) {
  return callRpc<T>('submit_quiz_answer', () =>
    admin.rpc('submit_quiz_answer', {
      p_user_id: userId,
      p_quest_id: questId,
      p_answer: answer,
    }),
  );
}
