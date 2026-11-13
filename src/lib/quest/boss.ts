import type { QuizPrompt } from '@/lib/types/database';
import type { QuestCompleteResponse } from './rewards';

/**
 * 보스 배틀 공용 값·응답 타입 (P9-12, 00046 boss_answer). 화면(useBossSession·BossArena)이 import 하므로 zod 없이 —
 * 요청 스키마는 서버 전용 `./bossAnswer` (zod v4 는 브라우저에서 eval 검사를 해 CSP 위반이 남음)
 */
export const BOSS_HEARTS = 3;

export type BossMode = 'first' | 'review' | 'practice';

/** boss_answer 반환 (00046 머리 주석) */
export interface BossAnswerResult {
  /** 시작 응답은 null */
  correct: boolean | null;
  /** 다음에 풀 문제 번호 = 깬 문제 수 (보스 HP = total − round) */
  round: number;
  hearts: number;
  total: number;
  mode: BossMode;
  result: 'win' | 'lose' | null;
  /** 정답 → 그 문제 해설 · 오답 → 고른 보기의 해설(없으면 null). 정답은 없음 */
  explanation: string | null;
  /** 이겼을 때만 (complete_quest 와 같은 모양 — 축하 시퀀서가 그대로 씀) */
  reward: QuestCompleteResponse | null;
}

export interface BossAnswerResponse extends BossAnswerResult {
  /** 시작·재도전 때만: 새로 섞은 문제 (shuffleQuiz). 답 응답은 null */
  rounds: QuizPrompt[] | null;
}

/** 보스 HP (남은 문제 수) */
export const bossHp = (s: Pick<BossAnswerResult, 'round' | 'total'>) =>
  Math.max(0, s.total - s.round);
