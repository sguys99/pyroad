import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { reportServerError } from '@/lib/api/serverError';
import { consumeRateLimit, type RateLimit } from '@/lib/tutor/rateLimit';
import { rewardError, submitQuizAnswerRpc } from '@/lib/quest/rewardRpc';
import { shuffleQuiz } from '@/lib/quest/quizShuffle';
import {
  QUIZ_ANSWER_MAX_BYTES,
  QuizAnswerRequestSchema,
  type QuizAnswerResponse,
  type QuizAnswerResult,
} from '@/lib/quest/quizAnswer';
import type { QuizPromptSkeleton } from '@/lib/types/database';

/**
 * 퀴즈 채점 (P7-02, §2.3)
 *
 * 로그인 확인 → 요청 한도 → 입력 모양·크기(zod) → service_role 로 submit_quiz_answer 1회.
 * 채점·시도 기록·별·XP 는 DB 함수가 한 트랜잭션으로 하고(00026), 정답은 DB 밖으로 나오지 않음
 * (오답 응답에는 정답이 없고, 3번째 오답의 revealed 만 예외). 다시 풀 때 쓸 보기 순서를 새로 섞어 next_quiz 로 줌.
 */

/** 한 문제 3번 + 데일리 3문제를 몇 번 빠르게 풀어도 넉넉한 값. 시도는 모두 기록되므로 오라클 방지가 아니라 부하 방지 */
const QUIZ_ANSWER_LIMIT: RateLimit = { perMinute: 20, perDay: 300 };
/** 요청 본문 상한 (answer 4096 바이트 + quest_id·키 여유) */
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
    'quiz:answer',
    QUIZ_ANSWER_LIMIT,
    'quiz',
  );
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `조금 천천히 풀어 볼까요? ${quota.retryAfter < 60 ? `${quota.retryAfter}초` : `${Math.ceil(quota.retryAfter / 60)}분`} 뒤에 다시 해 봐요.`,
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
  const parsed = QuizAnswerRequestSchema.safeParse(json);
  if (!parsed.success) return rewardError('invalid_arguments');
  const { quest_id, answer } = parsed.data;

  const [result, quiz] = await Promise.all([
    submitQuizAnswerRpc<QuizAnswerResult>(admin, user.id, quest_id, answer),
    admin
      .from('quests')
      .select('prompt_skeleton')
      .eq('id', quest_id)
      .maybeSingle(),
  ]);
  if (!result.ok) return result.response;

  // 별 판정이 났으면 월드맵·프로필의 별·완료 수가 바뀜
  if (result.data.stars > 0) {
    revalidatePath('/world', 'layout');
    revalidatePath('/worlds');
    revalidatePath('/profile');
  }

  if (quiz.error)
    reportServerError(quiz.error, { area: 'quiz', op: 'next_quiz' });
  const prompt = (quiz.data?.prompt_skeleton ??
    null) as Partial<QuizPromptSkeleton> | null;

  const body: QuizAnswerResponse = {
    correct: result.data.correct,
    attempt_no: result.data.attempt_no,
    mode: result.data.mode,
    stars: result.data.stars,
    best_stars: result.data.best_stars,
    xp_awarded: result.data.xp_awarded,
    total_xp: result.data.total_xp,
    level_before: result.data.level_before,
    level_after: result.data.level_after,
    explanation: result.data.explanation,
    revealed: result.data.revealed,
    next_review_on: result.data.next_review_on,
    next_quiz: prompt?.quiz ? shuffleQuiz(prompt.quiz) : null,
  };
  return NextResponse.json(body);
}
