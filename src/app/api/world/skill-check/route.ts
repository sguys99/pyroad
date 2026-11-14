import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod/v4';

import { reportServerError } from '@/lib/api/serverError';
import {
  rewardError,
  skillCheckStartRpc,
  skillCheckSubmitRpc,
} from '@/lib/quest/rewardRpc';
import {
  QUIZ_ANSWER_MAX_BYTES,
  QuizAnswerValueSchema,
} from '@/lib/quest/quizAnswer';
import { shuffleQuiz } from '@/lib/quest/quizShuffle';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { consumeRateLimit, type RateLimit } from '@/lib/tutor/rateLimit';
import type { Json, QuizPrompt } from '@/lib/types/database';
import {
  skillCheckPassScore,
  type SkillCheckResult,
  type SkillCheckStartResponse,
  type SkillCheckStartRpc,
} from '@/lib/world/skillCheck';

/**
 * 실력 확인 퀴즈 (P10-03, §12-Q2·Q72 ②, docs/curriculum/world2.md §7)
 *
 * - 시작 `{ world }`: service_role `skill_check_start` 가 오늘(KST) 도전을 쓰고 오늘 묶음 번호를 줌 → 그 묶음 문제의 공개 모양만
 *   (보기는 시도마다 섞음). 이미 냈으면 오늘 결과, 이미 열린 월드면 open
 * - 제출 `{ world, answers }`: `skill_check_submit` 가 서버에서 채점·하루 1번·합격 기록. 응답은 점수와 복습 스테이지뿐
 *   (정답·해설·어느 문제를 틀렸는지는 주지 않음 — 하루 1번이라도 정답을 보면 다음에 외워서 통과할 수 있음)
 * 보상(XP·코인)은 없음. 합격하면 그 월드의 첫 스테이지가 열려(is_stage_unlocked 00052) 지도·책장을 무효화
 */

/** 시작·제출은 하루 몇 번뿐이라 넉넉한 값 (부하 방지) */
const SKILL_CHECK_LIMIT: RateLimit = { perMinute: 10, perDay: 60 };
const MAX_QUESTIONS = 20;
const MAX_BODY_BYTES = MAX_QUESTIONS * QUIZ_ANSWER_MAX_BYTES + 512;

const RequestSchema = z.strictObject({
  world: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(64),
  answers: z.array(QuizAnswerValueSchema).min(1).max(MAX_QUESTIONS).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) return rewardError('invalid_arguments');
  const { world: slug, answers } = parsed.data;

  const admin = createAdminClient();
  const quota = await consumeRateLimit(
    admin,
    user.id,
    'skill_check',
    SKILL_CHECK_LIMIT,
    'skill_check',
  );
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: '잠깐 쉬었다가 다시 해 볼까요?',
        code: 'rate_limited',
        retry_after: quota.retryAfter,
      },
      { status: 429, headers: { 'Retry-After': String(quota.retryAfter) } },
    );
  }

  const world = await admin
    .from('worlds')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (world.error) {
    reportServerError(world.error, { area: 'skill_check', op: 'world' });
    return rewardError('server_error', 500);
  }
  if (!world.data) return rewardError('world_not_found');
  const worldId = world.data.id;

  if (answers) {
    const result = await skillCheckSubmitRpc<SkillCheckResult>(
      admin,
      user.id,
      worldId,
      answers as Json,
    );
    if (!result.ok) return result.response;
    if (result.data.passed) {
      revalidatePath('/world', 'layout');
      revalidatePath('/worlds');
      revalidatePath('/profile');
    }
    return NextResponse.json(result.data);
  }

  const start = await skillCheckStartRpc<SkillCheckStartRpc>(
    admin,
    user.id,
    worldId,
  );
  if (!start.ok) return start.response;
  const s = start.data;
  if (s.status === 'open')
    return NextResponse.json<SkillCheckStartResponse>({ status: 'open' });
  if (s.status === 'done')
    return NextResponse.json<SkillCheckStartResponse>({
      status: 'done',
      result: {
        score: s.score ?? 0,
        total: s.total ?? 0,
        pass_score: skillCheckPassScore(s.total ?? 0),
        passed: !!s.passed,
        practice: s.practice ?? [],
      },
    });

  // 공개 모양(quiz)만 읽음 — answer 열은 고르지 않음
  const questions = await admin
    .from('skill_check_questions')
    .select('no, quiz')
    .eq('world_id', worldId)
    .eq('set_no', s.set_no ?? 0)
    .order('no');
  if (questions.error || !questions.data?.length) {
    if (questions.error)
      reportServerError(questions.error, {
        area: 'skill_check',
        op: 'questions',
      });
    return rewardError('skill_check_missing');
  }
  return NextResponse.json<SkillCheckStartResponse>({
    status: 'ready',
    questions: questions.data.map((q) =>
      shuffleQuiz(q.quiz as unknown as QuizPrompt),
    ),
  });
}
