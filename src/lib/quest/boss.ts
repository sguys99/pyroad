import type { QuizPrompt } from '@/lib/types/database';
import type { QuestCompleteResponse } from './rewards';

/**
 * 보스 배틀 공용 값·응답 타입 (P9-12, 00046 boss_answer). 화면(useBossSession·BossArena)이 import 하므로 zod 없이 —
 * 요청 스키마는 서버 전용 `./bossAnswer` (zod v4 는 브라우저에서 eval 검사를 해 CSP 위반이 남음)
 */
export const BOSS_HEARTS = 3;

/** 보스 외형 (P9-13): 스테이지마다 버그버그 등딱지 색·모자가 다름. 콘텐츠 `prompt.boss.look`, 그림은 리그 `bugbug/looks.ts` */
export const BOSS_LOOKS = [
  'village',
  'forest',
  'crossroad',
  'cave',
  'lake',
  'tower',
  'kingdom',
  // 2월드 코드 바다 (P10-04): 바다 소품을 단 버그버그. 2-1 ~ 2-6, 2-F 선장
  'workshop',
  'library',
  'maze',
  'pirate',
  'hospital',
  'ridge',
  'captain',
] as const;
export type BossLook = (typeof BOSS_LOOKS)[number];

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
