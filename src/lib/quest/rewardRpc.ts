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
  not_enough_coins: { status: 400, error: '코인이 부족해요.' },
  not_enough_stars: { status: 409, error: '별이 아직 모자라요.' },
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
    | 'submit_quiz_answer'
    | 'grant_coins'
    | 'spend_coins'
    | 'open_stage_chest',
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
  submission: { code: string; passed: boolean; retry?: boolean },
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

/** 코인 원장 출처 (00030 coin_ledger_source_check 와 같은 목록). spend 는 spendCoinsRpc 만 */
export const COIN_SOURCES = [
  'quest',
  'star',
  'quiz',
  'mission',
  'attendance',
  'achievement',
  'chest',
  'level_up',
  'retro',
  'spend',
] as const;
export type CoinSource = (typeof COIN_SOURCES)[number];

/** grant_coins·spend_coins 반환 (P8-03). 같은 (source, ref) 를 다시 부르면 applied false, delta 0 */
export interface CoinRpcResult {
  applied: boolean;
  delta: number;
  coins: number;
  source: CoinSource;
  ref: string;
}

/** 코인 지급 (P8-03, 00030). ref 는 멱등 키 — 형식은 00030 머리 주석 */
export function grantCoinsRpc(
  admin: AdminClient,
  userId: string,
  source: Exclude<CoinSource, 'spend'>,
  ref: string,
  amount: number,
) {
  return callRpc<CoinRpcResult>('grant_coins', () =>
    admin.rpc('grant_coins', {
      p_user_id: userId,
      p_source: source,
      p_ref: ref,
      p_amount: amount,
    }),
  );
}

/** 코인 차감 (P8-03, 상점은 Phase 9). 잔액이 모자라면 not_enough_coins */
export function spendCoinsRpc(
  admin: AdminClient,
  userId: string,
  ref: string,
  amount: number,
) {
  return callRpc<CoinRpcResult>('spend_coins', () =>
    admin.rpc('spend_coins', {
      p_user_id: userId,
      p_ref: ref,
      p_amount: amount,
    }),
  );
}

/** 스테이지 보물상자 열기 반환 (P8-06, 00033). 이미 열었으면 already_opened, coins_earned 0 */
export interface OpenChestResult {
  opened: true;
  already_opened: boolean;
  coins_earned: number;
  coins_balance: number;
  stars: number;
  goal: number;
}

/** 스테이지 보물상자 열기 (P8-06). 서버가 별 합계를 다시 세어 목표 미달이면 not_enough_stars */
export function openStageChestRpc(
  admin: AdminClient,
  userId: string,
  stageId: string,
) {
  return callRpc<OpenChestResult>('open_stage_chest', () =>
    admin.rpc('open_stage_chest', {
      p_user_id: userId,
      p_stage_id: stageId,
    }),
  );
}

/** 코인 잔액 (users.coins, 원장 합의 캐시). 본인 세션 클라이언트(RLS)나 admin 으로 읽음. 행이 없으면 null */
export async function getCoinBalance(
  client: AdminClient,
  userId: string,
): Promise<number | null> {
  const { data, error } = await client
    .from('users')
    .select('coins')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    reportServerError(error, { area: 'rewardRpc', op: 'coin balance' });
    return null;
  }
  return data?.coins ?? null;
}
