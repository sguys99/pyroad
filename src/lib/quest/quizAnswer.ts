import { z } from 'zod/v4';

import { QUIZ_ID_PATTERN } from '@/lib/content/schema';
import type { QuizPrompt } from '@/lib/types/database';
import type { LevelUpCoins } from './coins';
import type { AchievementInfo } from './achievements';

/**
 * 퀴즈 채점 API `/api/quest/answer` 요청·응답 (P7-02). 클라이언트(렌더러, P7-03)는 타입만 import 합니다.
 *
 * answer 는 P7-01 `accepted` 정규형과 같은 모양 (content/README.md 퀴즈 절):
 *   multiple_choice `"opt-k7qz"` · fill_blank `{"bk-r2fa": "tok-m4xe"}` (모든 빈칸)
 *   parsons `["ln-q8wd", …]` 또는 indent 퀴즈면 `[{"id": "ln-q8wd", "indent": 1}, …]` · bug_hunt `{"line": "ln-x5pc", "fix": "fx-b7nd"}`
 * 퀴즈 종류와 맞는 모양인지는 DB 함수가 한 번 더 봄 (아니면 400 invalid_arguments)
 */
export const QUIZ_ANSWER_MAX_BYTES = 4096;

const quizId = z.string().regex(QUIZ_ID_PATTERN);

export const QuizAnswerValueSchema = z.union([
  quizId,
  z.strictObject({ line: quizId, fix: quizId }),
  z.array(quizId).min(1).max(20),
  z
    .array(z.strictObject({ id: quizId, indent: z.int().min(0).max(4) }))
    .min(1)
    .max(20),
  z
    .record(quizId, quizId)
    .refine((o) => Object.keys(o).length >= 1 && Object.keys(o).length <= 20),
]);

export const QuizAnswerRequestSchema = z.strictObject({
  quest_id: z.guid(),
  answer: QuizAnswerValueSchema.refine(
    (a) =>
      new TextEncoder().encode(JSON.stringify(a)).length <=
      QUIZ_ANSWER_MAX_BYTES,
  ),
});

export type QuizAnswerValue = z.infer<typeof QuizAnswerValueSchema>;

/** submit_quiz_answer 반환 (00026 머리 주석) */
export interface QuizAnswerResult {
  correct: boolean;
  /** 이번 회차 안에서 몇 번째 시도인지 (1~3) */
  attempt_no: number;
  /** first: 처음 별 판정 · review: 다음 날부터 복습 도전 · practice: 같은 날 다시 풀기(별·XP 없음) */
  mode: 'first' | 'review' | 'practice';
  /** 이번 판정의 별 (판정이 없으면 0: 오답 1·2번째, 연습) */
  stars: number;
  best_stars: number;
  /** 이번에 받은 XP (늘어난 best_stars × 10) */
  xp_awarded: number;
  total_xp: number;
  level_before: number;
  level_after: number;
  /** 정답이면 정답 해설, 오답이면 고른 보기의 해설(없으면 null). 오답에는 정답이 없음 */
  explanation: string | null;
  /** 3번째 오답일 때만: 정답(accepted[0] 정규형)과 정답 해설 */
  revealed: { answer: QuizAnswerValue; explanation: string } | null;
  /** 별을 다시 받을 수 있는 날 (KST YYYY-MM-DD). 아직 판정 전이면 null */
  next_review_on: string | null;
  /** 이번 요청에서 늘어난 코인 전부 (새로 얻은 별 × 5 + 레벨 업, P8-04 00031). 연습·판정 없음은 0 */
  coins_earned: number;
  /** 코인 잔액 */
  coins_balance: number;
  /** 이번에 지나간 레벨마다 받은 코인 */
  level_ups: LevelUpCoins[];
}

export interface QuizAnswerResponse extends QuizAnswerResult {
  /** 이번 답으로 새로 얻은 업적 (P8-09, API 가 RPC 뒤에 판정) */
  new_achievements?: AchievementInfo[];
  /** 다시 풀 때 쓸, 새로 섞은 퀴즈 공개 부분 (shuffleQuiz). 읽지 못하면 null → 지금 순서 그대로 */
  next_quiz: QuizPrompt | null;
}
