import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { reportServerError } from '@/lib/api/serverError';
import { consumeRateLimit, type RateLimit } from '@/lib/tutor/rateLimit';
import { bossAnswerRpc, rewardError } from '@/lib/quest/rewardRpc';
import { shuffleQuiz } from '@/lib/quest/quizShuffle';
import { QUIZ_ANSWER_MAX_BYTES } from '@/lib/quest/quizAnswer';
import {
  BossAnswerRequestSchema,
  type BossAnswerResponse,
  type BossAnswerResult,
} from '@/lib/quest/bossAnswer';
import type { BossPromptSkeleton } from '@/lib/types/database';

/**
 * 보스 배틀 (P9-12, §2.3)
 *
 * 로그인 확인 → 요청 한도 → 입력 모양·크기(zod) → service_role 로 boss_answer 1회.
 * 채점·하트·진행·승리 보상은 DB 함수가 한 트랜잭션으로 하고(00046), 정답은 DB 밖으로 나오지 않음.
 * 시작·재도전(answer null)이면 문제 보기 순서를 새로 섞어 rounds 로 줌.
 */

/** 문제 5개 × 하트 3 판을 몇 번 빠르게 다시 해도 넉넉한 값 (부하 방지) */
const BOSS_ANSWER_LIMIT: RateLimit = { perMinute: 30, perDay: 400 };
const MAX_BODY_BYTES = QUIZ_ANSWER_MAX_BYTES + 512;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const quota = await consumeRateLimit(
    admin,
    user.id,
    'boss:answer',
    BOSS_ANSWER_LIMIT,
    'boss',
  );
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `숨 한 번 고르고 다시 해 볼까요? ${quota.retryAfter < 60 ? `${quota.retryAfter}초` : `${Math.ceil(quota.retryAfter / 60)}분`} 뒤에 다시 해 봐요.`,
        code: 'rate_limited',
        retry_after: quota.retryAfter,
      },
      { status: 429, headers: { 'Retry-After': String(quota.retryAfter) } },
    );
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return rewardError('answer_too_large');
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return rewardError('invalid_arguments');
  }
  const parsed = BossAnswerRequestSchema.safeParse(json);
  if (!parsed.success) return rewardError('invalid_arguments');
  const { quest_id, round, answer } = parsed.data;
  const starting = answer === null;

  const [result, quest] = await Promise.all([
    bossAnswerRpc<BossAnswerResult>(admin, user.id, quest_id, round, answer),
    starting
      ? admin
          .from('quests')
          .select('prompt_skeleton')
          .eq('id', quest_id)
          .maybeSingle()
      : null,
  ]);
  if (!result.ok) return result.response;

  // 이긴 판이 별을 바꿨으면 월드맵·프로필의 별·완료 수가 바뀜
  if (result.data.result === 'win' && result.data.reward?.mode !== 'practice') {
    revalidatePath('/world', 'layout');
    revalidatePath('/worlds');
    revalidatePath('/profile');
  }

  if (quest?.error)
    reportServerError(quest.error, { area: 'boss', op: 'rounds' });
  const rounds =
    (quest?.data?.prompt_skeleton as Partial<BossPromptSkeleton> | null)?.boss
      ?.rounds ?? null;

  const body: BossAnswerResponse = {
    ...result.data,
    rounds: rounds ? rounds.map((q) => shuffleQuiz(q)) : null,
  };
  return NextResponse.json(body);
}
