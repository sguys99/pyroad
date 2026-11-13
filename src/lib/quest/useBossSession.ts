'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fireConfetti, resetConfetti } from '@/lib/confetti';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { tierDuration } from '@/lib/motion/tokens';
import { useRestHold } from '@/lib/rest/restHold';
import { useSfx } from '@/components/providers/SoundProvider';
import { createCelebrationStore } from '@/lib/celebration/celebrationStore';
import type { BossPromptSkeleton, QuizPrompt } from '@/lib/types/database';
import type { QuizAnswerValue } from './quizAnswer';
import { BOSS_HEARTS, type BossAnswerResponse, type BossMode } from './boss';
import { buildCelebrationEvents } from './celebrationEvents';
import type { QuestCompleteResponse } from './rewards';
import {
  ANSWER_CONFETTI,
  CELEBRATION_DELAY_MS,
  type QuestSessionOptions,
} from './useQuestSession';
import { quizEntryMode, WRONG_GAIN } from './useQuizSession';

/**
 * 보스 배틀 세션 (P9-12, §2.3·§2.5). 코드 퀘스트의 useQuestSession·퀴즈의 useQuizSession 과 같은 자리:
 * 렌더러(BossQuest)는 화면만 그리고, 판 진행·채점 요청·효과음·컨페티·축하는 여기서.
 *
 * 흐름: intro(보스 등장) → start = POST /api/quest/boss {round 0, answer null} → battle
 *   → 답 고르기 → submit → 정답: 파이뱀 공격(보스 HP −1) + 해설 → "다음 문제" / 오답: 피격(하트 −1) + 고른 답 해설, 같은 문제 다시
 *   → 마지막 문제 정답 = won(남은 하트 = 별, 보상·축하) · 하트 0 = lost(격려 + 다시 도전 · 복습하러 가기)
 * 하트·라운드는 서버(boss_runs)가 정하고 화면은 응답을 그대로 보여 줌. 연출 박자(공격·피격 뒤 결과 화면)는 연출 단계 배율.
 */

export type BossPhase = 'intro' | 'battle' | 'won' | 'lost';

/** 마지막 공격·피격 (fx.n 이 바뀌면 화면이 연출을 한 번 다시 그림) */
export interface BossFx {
  type: 'attack' | 'hurt';
  n: number;
}

/** 방금 채점한 답 (그 문제 화면에 해설 쪽지로) */
export interface BossVerdict {
  correct: boolean;
  explanation: string | null;
  /** 채점한 문제 번호 */
  round: number;
  submitted: QuizAnswerValue;
}

export interface BossState {
  phase: BossPhase;
  rounds: QuizPrompt[];
  /** 지금 보이는 문제 번호 (정답 쪽지가 떠 있는 동안은 방금 맞힌 문제) */
  round: number;
  /** 서버가 정한 다음 문제 번호 = 깬 문제 수 (보스 HP = total − cleared) */
  cleared: number;
  hearts: number;
  mode: BossMode;
  value: QuizAnswerValue | null;
  /** 이 문제에서 틀린 답 (객관식은 흐리게) */
  misses: QuizAnswerValue[];
  verdict: BossVerdict | null;
  fx: BossFx | null;
  reward: QuestCompleteResponse | null;
}

export type BossAction =
  | { type: 'started'; res: BossAnswerResponse }
  | { type: 'pick'; value: QuizAnswerValue }
  | { type: 'graded'; res: BossAnswerResponse; submitted: QuizAnswerValue }
  /** 정답 쪽지 뒤 다음 문제로 */
  | { type: 'next' }
  /** 공격·피격 연출 뒤 결과 화면 */
  | { type: 'finish'; phase: 'won' | 'lost' };

export function initialBossState(
  rounds: QuizPrompt[],
  mode: BossMode,
): BossState {
  return {
    phase: 'intro',
    rounds,
    round: 0,
    cleared: 0,
    hearts: BOSS_HEARTS,
    mode,
    value: null,
    misses: [],
    verdict: null,
    fx: null,
    reward: null,
  };
}

/** 판 상태 전이 (순수 함수, 단위 테스트) */
export function bossReducer(s: BossState, a: BossAction): BossState {
  switch (a.type) {
    case 'started':
      return {
        ...initialBossState(a.res.rounds ?? s.rounds, a.res.mode),
        phase: 'battle',
        hearts: a.res.hearts,
      };
    case 'pick':
      return s.phase === 'battle' && !s.verdict?.correct
        ? { ...s, value: a.value }
        : s;
    case 'graded': {
      const r = a.res;
      const correct = !!r.correct;
      return {
        ...s,
        cleared: r.round,
        hearts: r.hearts,
        mode: r.mode,
        // 틀리면 같은 문제를 다시 고르게 비움, 맞히면 맞힌 답을 그대로 보여 줌
        value: correct ? a.submitted : null,
        misses: correct ? s.misses : [...s.misses, a.submitted],
        verdict: {
          correct,
          explanation: r.explanation,
          round: s.round,
          submitted: a.submitted,
        },
        fx: { type: correct ? 'attack' : 'hurt', n: (s.fx?.n ?? 0) + 1 },
        reward: r.reward ?? s.reward,
      };
    }
    case 'next':
      if (!s.verdict?.correct || s.cleared >= s.rounds.length) return s;
      return {
        ...s,
        round: s.cleared,
        value: null,
        misses: [],
        verdict: null,
      };
    case 'finish':
      return { ...s, phase: a.phase };
  }
}

/** 공격·피격 연출을 본 뒤 결과 화면으로 넘어가는 시간 (연출 단계 배율, 동작 줄이기는 바로) */
export const BOSS_FINISH_MS = 1100;

const START_FAILED = '앗, 보스를 부르지 못했어요. 한 번 더 눌러 볼까요?';
const SUBMIT_FAILED = '앗, 답을 보내지 못했어요. 한 번 더 눌러 볼까요?';

/** 오류 코드 중 판을 새로 시작해야 하는 것 (다른 탭에서 답함·판 끝남) */
const RESTART_CODES = new Set(['boss_run_over', 'boss_round_mismatch']);

export function useBossSession({
  quest,
  progress,
  initialXP,
  initialLevel,
}: QuestSessionOptions) {
  const router = useRouter();
  const play = useSfx();
  const { budget } = useMotionTier();
  const budgetRef = useRef(budget);
  budgetRef.current = budget;

  const skeleton = quest.prompt_skeleton as unknown as BossPromptSkeleton;
  const [state, dispatch] = useReducer(bossReducer, undefined, () =>
    initialBossState(skeleton.boss.rounds, quizEntryMode(progress)),
  );
  const [bestStars, setBestStars] = useState(progress?.best_stars ?? 0);
  const [userXP, setUserXP] = useState(initialXP);
  const [userLevel, setUserLevel] = useState(initialLevel);
  const [earnedXP, setEarnedXP] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 판을 새로 시작해야 하는 오류 (다시 도전 버튼을 보여 줌) */
  const [stale, setStale] = useState(false);
  const [celebrationStore] = useState(createCelebrationStore);

  const busyRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  useRestHold(isSubmitting || state.phase === 'battle');

  const aliveRef = useRef(true);
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    aliveRef.current = true;
    const timers = timersRef.current;
    return () => {
      aliveRef.current = false;
      timers.forEach(clearTimeout);
      timers.clear();
      resetConfetti();
    };
  }, []);
  const later = useCallback((ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timersRef.current.delete(t);
      fn();
    }, ms);
    timersRef.current.add(t);
  }, []);

  const post = useCallback(
    async (round: number, answer: QuizAnswerValue | null) => {
      const res = await fetch('/api/quest/boss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quest_id: quest.id, round, answer }),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, data };
    },
    [quest.id],
  );

  const run = useCallback(async (fn: () => Promise<void>, failed: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      await fn();
    } catch {
      if (aliveRef.current) setError(failed);
    } finally {
      busyRef.current = false;
      setIsSubmitting(false);
    }
  }, []);

  /** 시작·다시 도전: 하트 3개로 새 판 (서버가 새로 섞은 문제를 줌) */
  const start = useCallback(
    () =>
      run(async () => {
        const { ok, data } = await post(0, null);
        if (!aliveRef.current) return;
        if (!ok) return setError(data?.error ?? START_FAILED);
        setStale(false);
        play('tap');
        dispatch({ type: 'started', res: data as BossAnswerResponse });
      }, START_FAILED),
    [run, post, play],
  );

  const win = useCallback(
    (reward: QuestCompleteResponse | null) => {
      const b = budgetRef.current;
      fireConfetti(ANSWER_CONFETTI, { scale: b.particles });
      if (!reward) return;
      if (reward.mode !== 'practice') {
        setBestStars(reward.best_stars);
        setEarnedXP(reward.xp_gained);
        setUserXP(reward.total_xp);
        setUserLevel(reward.level_after);
      }
      const events = buildCelebrationEvents(reward, {
        kind: 'boss',
        questTitle: quest.title,
      });
      // 스테이지 클리어 카드가 축하 소리를 냄 → 없으면(복습·연습) 여기서 한 번
      if (!events.some((e) => e.type === 'stage_clear')) play('celebrate');
      if (events.length > 0)
        later(CELEBRATION_DELAY_MS.boss, () => celebrationStore.push(events));
      router.refresh();
    },
    [quest.title, play, later, celebrationStore, router],
  );

  const submit = useCallback(
    () =>
      run(async () => {
        const submitted = state.value;
        if (
          state.phase !== 'battle' ||
          submitted == null ||
          state.verdict?.correct
        )
          return;
        const { ok, data } = await post(state.round, submitted);
        if (!aliveRef.current) return;
        if (!ok) {
          setError(data?.error ?? SUBMIT_FAILED);
          if (RESTART_CODES.has(data?.code)) setStale(true);
          return;
        }
        const res = data as BossAnswerResponse;
        dispatch({ type: 'graded', res, submitted });
        if (res.correct) play('correct');
        else play('wrong', { gain: WRONG_GAIN });
        if (res.result) {
          const phase = res.result === 'win' ? 'won' : 'lost';
          later(tierDuration(BOSS_FINISH_MS, budgetRef.current), () => {
            dispatch({ type: 'finish', phase });
            if (phase === 'won') win(res.reward);
          });
        }
      }, SUBMIT_FAILED),
    [run, post, state, play, later, win],
  );

  const next = useCallback(() => dispatch({ type: 'next' }), []);
  const setValue = useCallback(
    (value: QuizAnswerValue) => dispatch({ type: 'pick', value }),
    [],
  );

  return {
    quest,
    boss: skeleton.boss,
    ...state,
    total: state.rounds.length,
    quiz: state.rounds[state.round] ?? null,
    setValue,
    start,
    submit,
    next,
    isSubmitting,
    error,
    /** 판이 어긋나 새로 시작해야 함 (다시 도전 버튼) */
    stale,
    bestStars,
    userXP,
    userLevel,
    earnedXP,
    celebrationStore,
  };
}

export type BossSession = ReturnType<typeof useBossSession>;
