'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { checkNicknameRules } from '@/lib/profile/nicknameRules';
import {
  NICKNAME_CHECK_ENDPOINT,
  type NicknameAvailability,
} from '@/lib/onboarding/api';

/**
 * 닉네임 입력 중 확인 (P3-11).
 * - 글자 규칙은 화면에서 바로(`checkNicknameRules`, 금칙어 목록은 번들에 넣지 않음) → 통과하면 디바운스 뒤 서버
 *   (`GET /api/profile/nickname`: 금칙어 + 중복). 이전 요청은 취소한다
 * - 고치는 중에 "2글자 이상" 같은 안내가 깜빡이지 않게 규칙 안내도 잠깐 기다렸다 보인다. 한글 조합 중(IME)에는 판단하지 않는다
 * - 요청 한도·서버 오류면 `unknown`: 막지 않는다(저장할 때 서버가 다시 확인)
 */
export type NicknameStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; nickname: string }
  | { kind: 'invalid'; message: string }
  | { kind: 'taken'; message: string; suggestion?: string }
  | { kind: 'unknown'; message: string };

/** 입력이 멈춘 뒤 서버에 묻기까지 (ms) */
export const NICKNAME_CHECK_DEBOUNCE_MS = 450;
/** 글자 규칙 안내를 보이기까지 (ms) */
const RULE_HINT_DELAY_MS = 350;

export function useNicknameCheck(value: string, composing: boolean) {
  const [status, setStatus] = useState<NicknameStatus>({ kind: 'idle' });
  const abort = useRef<AbortController | null>(null);
  const cache = useRef(new Map<string, NicknameStatus>());

  useEffect(() => {
    if (composing) return;
    abort.current?.abort();
    const rules = checkNicknameRules(value);
    if (!rules.ok) {
      const t = window.setTimeout(
        () => setStatus({ kind: 'invalid', message: rules.message }),
        RULE_HINT_DELAY_MS,
      );
      return () => window.clearTimeout(t);
    }
    const known = cache.current.get(rules.key);
    if (known) {
      setStatus(known);
      return;
    }
    setStatus({ kind: 'checking' });
    const controller = new AbortController();
    abort.current = controller;
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `${NICKNAME_CHECK_ENDPOINT}?name=${encodeURIComponent(rules.nickname)}`,
          { signal: controller.signal, cache: 'no-store' },
        );
        const data = (await res.json()) as NicknameAvailability;
        const next: NicknameStatus = data.ok
          ? { kind: 'ok', nickname: data.nickname }
          : data.reason === 'taken'
            ? {
                kind: 'taken',
                message: data.message,
                suggestion: data.suggestion,
              }
            : data.reason === 'rate_limited' || data.reason === 'error'
              ? { kind: 'unknown', message: data.message }
              : { kind: 'invalid', message: data.message };
        // 확정된 결과만 기억 (한도·오류는 다음에 다시 물음)
        if (next.kind === 'ok' || next.kind === 'invalid') {
          cache.current.set(rules.key, next);
        }
        if (!controller.signal.aborted) setStatus(next);
      } catch {
        if (!controller.signal.aborted) {
          setStatus({
            kind: 'unknown',
            message: '지금은 확인하지 못했어요. 저장할 때 한 번 더 볼게요.',
          });
        }
      }
    }, NICKNAME_CHECK_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [value, composing]);

  /** 저장할 때 서버가 중복이라고 알려 준 경우 (그사이 다른 친구가 먼저 씀) */
  const markTaken = useCallback(
    (nickname: string, message: string, suggestion?: string) => {
      const rules = checkNicknameRules(nickname);
      const next: NicknameStatus = { kind: 'taken', message, suggestion };
      if (rules.ok) cache.current.set(rules.key, next);
      setStatus(next);
    },
    [],
  );

  /** 저장할 때 서버가 글자·금칙어로 거부한 경우 */
  const markInvalid = useCallback((nickname: string, message: string) => {
    const rules = checkNicknameRules(nickname);
    const next: NicknameStatus = { kind: 'invalid', message };
    if (rules.ok) cache.current.set(rules.key, next);
    setStatus(next);
  }, []);

  return { status, markTaken, markInvalid };
}
