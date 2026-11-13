'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { CelebrationEvent } from '@/lib/quest/celebrationEvents';
import {
  MIN_DWELL_MS,
  autoAdvanceMs,
  planCelebrations,
  type CelebrationStep,
} from './plan';

/**
 * 축하 시퀀서 상태 (P1-10). 퀘스트 엔진의 `celebrations`(받은 편지함)를 단계 목록으로 계획해
 * 한 번에 하나씩 보여 주고, 다 보거나 모두 닫으면 퇴장 연출이 끝난 뒤 `onDismiss(받은 개수)`로 비운다.
 *
 * - 넘기기: `next()` (CTA·배경 탭·Enter/Space). 등장 직후 `MIN_DWELL_MS` 동안은 무시
 * - 자동 넘김: 단계별 기본값(`autoAdvanceMs`). 카드 위에 포인터가 있거나 탭이 숨겨지거나 공유 시트가 열리면(held) 멈췄다가 남은 시간부터
 * - 모두 닫기: `skipAll()` (Esc·"모두 닫기")
 * - 보여 주는 중에 새 이벤트가 오면 뒤에 이어 붙인다
 * - 언마운트(퀘스트 이동)하면 타이머가 모두 정리된다. 퀘스트 엔진 상태도 함께 사라지므로 따로 비울 것이 없다
 *
 * 퇴장 연출 뒤에 비우는 이유: 비우면 퀘스트 셸이 다시 그려지는데, 그 일이 카드 연출과 겹치지 않게 (§2.10)
 */

interface State {
  steps: CelebrationStep[];
  index: number;
  open: boolean;
}

type Action =
  | { type: 'enqueue'; steps: CelebrationStep[] }
  | { type: 'next' }
  | { type: 'close' }
  | { type: 'reset' };

const EMPTY: State = { steps: [], index: 0, open: false };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'enqueue':
      if (action.steps.length === 0) return state;
      return state.open
        ? { ...state, steps: [...state.steps, ...action.steps] }
        : { steps: action.steps, index: 0, open: true };
    case 'next':
      if (!state.open) return state;
      return state.index + 1 < state.steps.length
        ? { ...state, index: state.index + 1 }
        : { ...state, open: false };
    case 'close':
      return state.open ? { ...state, open: false } : state;
    case 'reset':
      return EMPTY;
  }
}

export interface CelebrationSequence {
  /** 지금 보여 주는 단계 (닫히는 중이거나 없으면 null) */
  step: CelebrationStep | null;
  index: number;
  total: number;
  /** 이 단계의 자동 넘김 (ms, null이면 누를 때까지) */
  autoMs: number | null;
  /** 자동 넘김이 멈춰 있는지 (카드 위 포인터·숨겨진 탭) */
  paused: boolean;
  /** 다음 단계로 (마지막이면 닫기). 등장 직후 잠깐은 무시 */
  next: () => void;
  /** 남은 축하를 모두 닫기 */
  skipAll: () => void;
  /** 카드 위에 포인터가 있으면 자동 넘김을 멈춘다 */
  setHovering: (hovering: boolean) => void;
  /** 바깥 AnimatePresence의 퇴장 연출이 끝났을 때 */
  onExitComplete: () => void;
}

export function useCelebrationSequence({
  events,
  onDismiss,
  now = () => performance.now(),
  held = false,
}: {
  events: readonly CelebrationEvent[];
  onDismiss: (count: number) => void;
  /** 카드 위 공유 시트가 열려 있음 (P9-10) — 자동 넘김을 멈춘다 */
  held?: boolean;
  /** 테스트용 시계 */
  now?: () => number;
}): CelebrationSequence {
  const [state, dispatch] = useReducer(reducer, EMPTY);
  const seenRef = useRef(0);
  const batchRef = useRef(0);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const nowRef = useRef(now);
  nowRef.current = now;

  // 받은 편지함에 새로 온 것만 계획해서 넣는다
  useEffect(() => {
    if (events.length < seenRef.current) seenRef.current = 0;
    const fresh = events.slice(seenRef.current);
    if (fresh.length === 0) return;
    seenRef.current = events.length;
    dispatch({
      type: 'enqueue',
      steps: planCelebrations(fresh, batchRef.current++),
    });
  }, [events]);

  const step = state.open ? (state.steps[state.index] ?? null) : null;
  const stepId = step?.id ?? null;
  const autoMs = step ? autoAdvanceMs(step) : null;

  // 등장 시각 (탭 연타 방지)
  const shownAtRef = useRef(0);
  useEffect(() => {
    if (stepId) shownAtRef.current = nowRef.current();
  }, [stepId]);

  const next = useCallback(() => {
    if (nowRef.current() - shownAtRef.current < MIN_DWELL_MS) return;
    dispatch({ type: 'next' });
  }, []);
  const skipAll = useCallback(() => dispatch({ type: 'close' }), []);

  // 자동 넘김 일시정지: 카드 위 포인터, 숨겨진 탭
  const [hovering, setHovering] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!state.open || typeof document === 'undefined') return;
    const update = () => setHidden(document.visibilityState === 'hidden');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [state.open]);
  const paused = hovering || hidden || held;

  // 자동 넘김: 단계가 바뀌면 처음부터, 멈췄다 다시 가면 남은 시간부터
  const remainingRef = useRef<number | null>(null);
  useEffect(() => {
    remainingRef.current = autoMs;
  }, [stepId, autoMs]);
  useEffect(() => {
    const remaining = remainingRef.current;
    if (!stepId || remaining === null || paused) return;
    const startedAt = nowRef.current();
    const timer = setTimeout(() => {
      remainingRef.current = null;
      dispatch({ type: 'next' });
    }, remaining);
    return () => {
      clearTimeout(timer);
      if (remainingRef.current !== null) {
        remainingRef.current = Math.max(
          0,
          remaining - (nowRef.current() - startedAt),
        );
      }
    };
  }, [stepId, paused]);

  // 단계가 바뀌면 포인터 멈춤도 새로 (다음 카드는 포인터 아래에 없을 수 있음)
  useEffect(() => {
    setHovering(false);
  }, [stepId]);

  const onExitComplete = useCallback(() => {
    const seen = seenRef.current;
    seenRef.current = 0;
    dispatch({ type: 'reset' });
    if (seen > 0) onDismissRef.current(seen);
  }, []);

  return {
    step,
    index: state.index,
    total: state.steps.length,
    autoMs,
    paused,
    next,
    skipAll,
    setHovering,
    onExitComplete,
  };
}
