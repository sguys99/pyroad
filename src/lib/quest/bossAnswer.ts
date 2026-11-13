import { z } from 'zod/v4';

import { QUIZ_ANSWER_MAX_BYTES, QuizAnswerValueSchema } from './quizAnswer';

/**
 * 보스 배틀 API `/api/quest/boss` 요청 스키마 (P9-12, 00046 boss_answer). 서버 전용 — 화면은 zod 없는 `./boss` 의 값·타입만 씀.
 *
 * - 시작·재도전: `{ quest_id, round: 0, answer: null }` → 판을 하트 3개로 새로. 응답에 새로 섞은 문제(rounds)
 * - 답: `{ quest_id, round, answer }` — round 는 지금 풀고 있는 문제 번호(0부터), answer 는 퀴즈와 같은 정규형
 * 채점·하트·보상은 모두 DB 함수가 정하고, 응답에는 정답이 없음 (오답이면 고른 보기의 해설만)
 */
export const BossAnswerRequestSchema = z.strictObject({
  quest_id: z.guid(),
  round: z.int().min(0).max(20),
  answer: QuizAnswerValueSchema.refine(
    (a) =>
      new TextEncoder().encode(JSON.stringify(a)).length <=
      QUIZ_ANSWER_MAX_BYTES,
  ).nullable(),
});

export type { BossAnswerResponse, BossAnswerResult, BossMode } from './boss';
