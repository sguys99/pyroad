import 'server-only';

import { NextResponse } from 'next/server';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/types/database';
import type { RewardErrorResponse } from './rewards';
import { STAGE_LOCKED_MESSAGE } from '@/lib/world/stageLock';
import { reportServerError } from '@/lib/api/serverError';
import type {
  ClaimMissionResult,
  DailyMissionsRpcResult,
} from '@/lib/world/missions';
import type {
  StampAttendanceResult,
  WorldDailyStatus,
} from '@/lib/world/attendance';
import type { AchievementInfo, ClaimAchievementResult } from './achievements';

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
  code_quest_needed: {
    status: 409,
    error: '이 스테이지 코드 퀘스트를 먼저 하나 풀어요.',
  },
  mission_not_found: { status: 404, error: '오늘의 미션이 아니에요.' },
  mission_not_done: { status: 409, error: '아직 미션을 다 하지 않았어요.' },
  mission_expired: { status: 410, error: '받을 수 있는 날이 지났어요.' },
  achievement_not_earned: { status: 409, error: '아직 얻지 않은 업적이에요.' },
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
    | 'open_stage_chest'
    | 'daily_missions_today'
    | 'claim_daily_mission'
    | 'world_daily_status'
    | 'stamp_attendance'
    | 'claim_achievement',
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
  submission: {
    code: string;
    passed: boolean;
    retry?: boolean;
    had_error?: boolean;
  },
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
export async function submitQuizAnswerRpc<T extends object>(
  admin: AdminClient,
  userId: string,
  questId: string,
  answer: Json,
) {
  return withAchievements(
    admin,
    userId,
    await callRpc<T>('submit_quiz_answer', () =>
      admin.rpc('submit_quiz_answer', {
        p_user_id: userId,
        p_quest_id: questId,
        p_answer: answer,
      }),
    ),
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
export async function openStageChestRpc(
  admin: AdminClient,
  userId: string,
  stageId: string,
) {
  return withAchievements(
    admin,
    userId,
    await callRpc<OpenChestResult>('open_stage_chest', () =>
      admin.rpc('open_stage_chest', {
        p_user_id: userId,
        p_stage_id: stageId,
      }),
    ),
  );
}

/**
 * 오늘(KST) 데일리 미션 (P8-07, 00034). quizIds 없이 부르면 읽기만(오늘 배정 전이면 assigned false),
 * 주면 배정이 없을 때 결정적으로 3개를 고르고 그 오늘의 퀴즈 목록을 저장(§12-Q61). 이미 있으면 저장된 것
 */
export function dailyMissionsRpc(
  admin: AdminClient,
  userId: string,
  quizIds?: string[],
) {
  return callRpc<DailyMissionsRpcResult>('daily_missions_today', () =>
    admin.rpc('daily_missions_today', {
      p_user_id: userId,
      ...(quizIds && { p_quiz_ids: quizIds }),
    }),
  );
}

/** 데일리 미션 보상 받기 (P8-07). 서버가 진행을 다시 세어 미달이면 mission_not_done, 원장 키로 한 번 */
export async function claimDailyMissionRpc(
  admin: AdminClient,
  userId: string,
  day: string,
  missionId: string,
) {
  return withAchievements(
    admin,
    userId,
    await callRpc<ClaimMissionResult>('claim_daily_mission', () =>
      admin.rpc('claim_daily_mission', {
        p_user_id: userId,
        p_day: day,
        p_mission_id: missionId,
      }),
    ),
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

/** 월드맵 하루 상태 (P8-08, 00035): 스트릭 방패 정산 뒤 스트릭·방패·출석 사이클. 월드맵 로더가 확인한 id 로 */
export function worldDailyStatusRpc(admin: AdminClient, userId: string) {
  return callRpc<WorldDailyStatus>('world_daily_status', () =>
    admin.rpc('world_daily_status', { p_user_id: userId }),
  );
}

/** 출석 도장 (P8-08). 하루 한 번(원장 attendance/<KST 날짜>), 7일째 방패 +1(최대 2) */
export async function stampAttendanceRpc(admin: AdminClient, userId: string) {
  return withAchievements(
    admin,
    userId,
    await callRpc<StampAttendanceResult>('stamp_attendance', () =>
      admin.rpc('stamp_attendance', { p_user_id: userId }),
    ),
  );
}

/**
 * 업적 판정 (P8-09, 00036 `evaluate_achievements`): 이번에 새로 얻은 업적. complete_quest 는 안에서 부르고, 퀴즈·상자·미션·출석은
 * 그 RPC 바로 뒤에 여기서 (`withAchievements`). 실패해도 보상은 그대로 두고 빈 목록 — 판정은 멱등이라 다음 보상 때 다시 잡힘
 */
export async function evaluateAchievements(
  admin: AdminClient,
  userId: string,
): Promise<AchievementInfo[]> {
  const { data, error } = await admin.rpc('evaluate_achievements', {
    p_user_id: userId,
  });
  if (error) {
    reportServerError(error, {
      area: 'rewardRpc',
      op: 'evaluate_achievements',
    });
    return [];
  }
  return (data as unknown as AchievementInfo[] | null) ?? [];
}

async function withAchievements<T extends object>(
  admin: AdminClient,
  userId: string,
  result: RpcResult<T>,
): Promise<RpcResult<T & { new_achievements: AchievementInfo[] }>> {
  if (!result.ok) return result;
  return {
    ok: true,
    data: {
      ...result.data,
      new_achievements: await evaluateAchievements(admin, userId),
    },
  };
}

/** 업적 코인 받기 (P8-09). 안 얻었으면 achievement_not_earned, 이미 받았으면 already_claimed(0) */
export function claimAchievementRpc(
  admin: AdminClient,
  userId: string,
  achievementId: string,
) {
  return callRpc<ClaimAchievementResult>('claim_achievement', () =>
    admin.rpc('claim_achievement', {
      p_user_id: userId,
      p_achievement_id: achievementId,
    }),
  );
}
