'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fireConfetti, resetConfetti } from '@/lib/confetti';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { useSfx } from '@/components/providers/SoundProvider';
import { createCelebrationStore } from '@/lib/celebration/celebrationStore';
import { kstToday } from '@/lib/time/kst';
import type { UserProgress } from '@/lib/types/database';
import type { QuizPromptSkeleton } from './questKind';
import type {
  QuizAnswerResponse,
  QuizAnswerResult,
  QuizAnswerValue,
} from './quizAnswer';
import { buildCelebrationEvents } from './celebrationEvents';
import {
  ANSWER_CONFETTI,
  CELEBRATION_DELAY_MS,
  type QuestSessionOptions,
} from './useQuestSession';

/**
 * 퀴즈 퀘스트 세션 (P7-03, §2.3·§2.5). 코드 퀘스트의 useQuestSession 과 같은 자리: 렌더러(QuizQuest)는 화면만 그린다.
 *
 * 흐름: 답 고르기(value) → submit = POST /api/quest/answer → 결과(result)
 *   - 오답(1·2번째): 고른 답을 misses 에 쌓고 retry 로 다시 (보기는 서버가 새로 섞은 next_quiz 로 바꿈)
 *   - 정답 / 3번째 오답(revealed: 정답 공개 + ⭐1): 회차 끝. retry 는 같은 날 연습(practice, 별·XP 없음)
 * 별 판정이 나면(stars > 0) XP·레벨을 반영하고, 레벨 업은 코드 퀘스트와 같은 축하 시퀀서(celebrationStore)로.
 * 퀴즈는 보너스라 스테이지 클리어·뱃지가 없음(00026, §12-Q60). 정답 효과음은 통과 도장(PassStamp)이, 오답은 여기서 'wrong'
 */

export type QuizMode = QuizAnswerResult['mode'];
/** answering = 고르는 중 · wrong = 틀림(다시 풀 수 있음) · correct = 정답 · revealed = 3번 틀려 정답 공개 */
export type QuizStatus = 'answering' | 'wrong' | 'correct' | 'revealed';

const SUBMIT_FAILED = '앗, 답을 보내지 못했어요. 한 번 더 눌러 볼까요?';

/** 들어올 때의 모드: 별 판정 전 first · 판정이 어제 이전이면 review(복습 도전) · 오늘이면 practice (00026 과 같은 규칙) */
export function quizEntryMode(
  progress: Pick<UserProgress, 'stars_judged_on'> | null,
  today: string = kstToday(),
): QuizMode {
  const judged = progress?.stars_judged_on;
  if (!judged) return 'first';
  return judged < today ? 'review' : 'practice';
}

export function quizStatus(result: QuizAnswerResponse | null): QuizStatus {
  if (!result) return 'answering';
  if (result.correct) return 'correct';
  return result.revealed ? 'revealed' : 'wrong';
}

export function useQuizSession({
  quest,
  progress,
  initialXP,
  initialLevel,
}: QuestSessionOptions) {
  const router = useRouter();
  const play = useSfx();
  const { budget } = useMotionTier();
  const particleScaleRef = useRef(budget.particles);
  particleScaleRef.current = budget.particles;

  const skeleton = quest.prompt_skeleton as unknown as QuizPromptSkeleton;
  const [quiz, setQuiz] = useState(skeleton.quiz);
  const [value, setValue] = useState<QuizAnswerValue | null>(null);
  /** 마지막 채점 결과와 그때 낸 답 */
  const [graded, setGraded] = useState<{
    result: QuizAnswerResponse;
    submitted: QuizAnswerValue;
  } | null>(null);
  /** 이번 회차에 틀린 답 (객관식은 흐리게) */
  const [misses, setMisses] = useState<QuizAnswerValue[]>([]);
  const [mode, setMode] = useState<QuizMode>(() => quizEntryMode(progress));
  const [bestStars, setBestStars] = useState(progress?.best_stars ?? 0);
  const [userXP, setUserXP] = useState(initialXP);
  const [userLevel, setUserLevel] = useState(initialLevel);
  const [earnedXP, setEarnedXP] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [celebrationStore] = useState(createCelebrationStore);

  // 연속 클릭 막기 (ref 는 렌더 전, state 는 버튼 표시)
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 화면을 떠나면 예약한 축하를 취소하고 늦게 온 응답은 버림 (useQuestSession 과 같음)
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

  const result = graded?.result ?? null;
  const status = quizStatus(result);

  const apply = useCallback(
    (r: QuizAnswerResponse, submitted: QuizAnswerValue) => {
      setGraded({ result: r, submitted });
      setMode(r.mode);
      if (r.correct) {
        fireConfetti(ANSWER_CONFETTI, { scale: particleScaleRef.current });
      } else {
        play('wrong');
        if (!r.revealed) setMisses((m) => [...m, submitted]);
      }
      if (r.stars <= 0) return;
      // 별 판정: XP·레벨 반영, 레벨 업 축하 (스테이지 클리어·뱃지는 퀴즈에 없음)
      setBestStars(r.best_stars);
      setEarnedXP(r.xp_awarded);
      setUserXP(r.total_xp);
      setUserLevel(r.level_after);
      const events = buildCelebrationEvents(
        {
          already_completed: false,
          xp_gained: r.xp_awarded,
          total_xp: r.total_xp,
          level_before: r.level_before,
          level_after: r.level_after,
          new_badges: [],
          stage_cleared: null,
          next_quest_id: null,
          golden_keys: 0,
          hints_used: 0,
          used_golden_key: false,
        },
        { kind: 'quiz', questTitle: quest.title },
      );
      if (events.length > 0) {
        const t = setTimeout(() => {
          timersRef.current.delete(t);
          celebrationStore.push(events);
        }, CELEBRATION_DELAY_MS.quiz);
        timersRef.current.add(t);
      }
      // 월드맵·프로필의 별·XP (Router Cache, B22)
      router.refresh();
    },
    [play, quest.title, celebrationStore, router],
  );

  const submit = useCallback(async () => {
    if (submittingRef.current || value == null || graded) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/quest/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quest_id: quest.id, answer: value }),
      });
      const data = await res.json();
      if (!aliveRef.current) return;
      if (!res.ok) setError(data?.error ?? SUBMIT_FAILED);
      else apply(data as QuizAnswerResponse, value);
    } catch {
      if (aliveRef.current) setError(SUBMIT_FAILED);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [value, graded, quest.id, apply]);

  /** 다시 풀기: 서버가 새로 섞은 보기로. 회차가 끝났으면(정답·공개) 오늘은 연습이라 틀린 기록도 새로 */
  const retry = useCallback(() => {
    if (!graded) return;
    const r = graded.result;
    if (r.next_quiz) setQuiz(r.next_quiz);
    if (r.correct || r.revealed) {
      setMisses([]);
      setMode('practice');
    }
    setValue(null);
    setGraded(null);
    setError(null);
  }, [graded]);

  return {
    quest,
    quiz,
    value,
    /** 채점 결과가 보이는 동안은 바꿀 수 없음 */
    setValue: graded ? noop : setValue,
    status,
    result,
    /** 채점한 답 (결과 표시용) */
    submitted: graded?.submitted ?? null,
    misses,
    mode,
    bestStars,
    isSubmitting,
    error,
    submit,
    retry,
    userXP,
    userLevel,
    earnedXP,
    celebrationStore,
  };
}

function noop() {}

export type QuizSession = ReturnType<typeof useQuizSession>;
