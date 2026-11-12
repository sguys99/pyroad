'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

import { useSfx } from '@/components/providers/soundContext';
import { track } from '@/lib/analytics/track';
import { isRestHeld } from '@/lib/rest/restHold';
import {
  REST_AFTER_MS,
  REST_MS,
  TICK_MS,
  freshRestState,
  markInput,
  parseRestState,
  snoozeRest,
  tickRest,
  type RestState,
} from '@/lib/rest/restTimer';
import type { RestPhase } from './RestReminderDialog';

// 모달 모듈은 처음 뜰 때 받는다 (대부분의 방문은 40분이 안 됨)
const RestReminderDialog = dynamic(
  () => import('./RestReminderDialog').then((m) => m.RestReminderDialog),
  { ssr: false },
);

const KEY = 'pyroad:rest';
/** e2e 빨리 감기 배속 (테스트 페이지가 켜진 서버에서만 읽음) */
export const REST_SPEED_KEY = 'pyroad:rest:speed';

const read = (k: string) => {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    sessionStorage.setItem(k, v);
  } catch {
    // 저장이 막힌 브라우저: 이 페이지 안에서만 센다
  }
};

/**
 * 휴식 알림 (P8-12, §2.6). 로그인 화면 공통 레이아웃에 하나. 탭이 보이는 동안 연속 놀이 시간을 세어(`restTimer.ts`)
 * 40분이 되면 파이뱀 휴식 카드를 띄운다. 퀘스트 실행·채점 중(`useRestHold`)이거나 다른 대화 상자가 떠 있으면 끝날 때까지 미룬다.
 * 서버 저장 없음 — 탭 세션(sessionStorage)이면 새로 고침·페이지 이동에도 이어진다. 끄는 설정은 두지 않았다(막지 않는 권유라서, 보고서 참고)
 */
export function RestReminder({
  allowFastClock = false,
}: {
  allowFastClock?: boolean;
}) {
  const play = useSfx();
  const [phase, setPhase] = useState<RestPhase | null>(null);
  const [mounted, setMounted] = useState(false);
  const [restEndsAt, setRestEndsAt] = useState(0);
  const [speed] = useState(() =>
    allowFastClock && typeof window !== 'undefined'
      ? Math.max(1, Number(read(REST_SPEED_KEY)) || 1)
      : 1,
  );
  const stateRef = useRef<RestState | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const now = useCallback(() => Date.now() * speed, [speed]);
  const save = useCallback((s: RestState) => {
    stateRef.current = s;
    write(KEY, JSON.stringify(s));
  }, []);

  useEffect(() => {
    save(parseRestState(read(KEY)) ?? freshRestState(now()));
    const onInput = () => {
      if (stateRef.current)
        stateRef.current = markInput(stateRef.current, now());
    };
    const tick = () => {
      const s = stateRef.current;
      if (!s || phaseRef.current || document.visibilityState !== 'visible')
        return;
      const r = tickRest(s, now());
      save(r.state);
      // 다른 대화 상자(축하·출석 등) 위에 겹치지 않게 그것이 닫힐 때까지 기다린다
      const busy =
        isRestHeld() ||
        !!document.querySelector('[role="dialog"],[role="alertdialog"]');
      if (!r.due || busy) return;
      setMounted(true);
      setPhase('ask');
      play('blip', { gain: 0.5 });
      track('rest_reminder_shown', { snoozed: r.state.nextAt > REST_AFTER_MS });
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const e of events)
      window.addEventListener(e, onInput, { passive: true });
    document.addEventListener('visibilitychange', tick);
    const id = setInterval(tick, TICK_MS / speed);
    return () => {
      for (const e of events) window.removeEventListener(e, onInput);
      document.removeEventListener('visibilitychange', tick);
      clearInterval(id);
    };
  }, [now, save, speed, play]);

  const onRest = useCallback(() => {
    setRestEndsAt(Date.now() + REST_MS / speed);
    setPhase('rest');
    track('rest_reminder_choice', { choice: 'rest' });
  }, [speed]);

  const onMore = useCallback(() => {
    if (stateRef.current) save(snoozeRest(stateRef.current));
    setPhase(null);
    track('rest_reminder_choice', { choice: 'more' });
  }, [save]);

  const onRestEnd = useCallback(() => {
    save(freshRestState(now()));
    setPhase('back');
    play('blip', { gain: 0.5, rate: 1.26 });
    track('rest_reminder_choice', { choice: 'done' });
  }, [now, save, play]);

  const onClose = useCallback(() => {
    // 쉬다가 일찍 돌아가면 처음부터가 아니라 "조금만 더"처럼 20분 뒤 다시
    if (phaseRef.current === 'rest') {
      if (stateRef.current)
        save(
          snoozeRest({
            ...stateRef.current,
            lastSeen: now(),
            lastInput: now(),
          }),
        );
      track('rest_reminder_choice', { choice: 'stop' });
    }
    setPhase(null);
  }, [now, save]);

  if (!mounted) return null;
  return (
    <RestReminderDialog
      phase={phase}
      restEndsAt={restEndsAt}
      restMs={REST_MS / speed}
      onRest={onRest}
      onMore={onMore}
      onRestEnd={onRestEnd}
      onClose={onClose}
    />
  );
}
