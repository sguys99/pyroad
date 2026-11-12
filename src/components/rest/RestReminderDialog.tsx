'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye, GlassWater, PersonStanding } from 'lucide-react';

import { Modal } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { PybaemRig } from '@/components/characters/rig/MascotRig';
import { REST_MS } from '@/lib/rest/restTimer';
import './restReminder.css';

export type RestPhase = 'ask' | 'rest' | 'back';

export interface RestReminderDialogProps {
  /** null이면 닫힘 */
  phase: RestPhase | null;
  /** 쉬기 카운트다운이 끝나는 시각 (epoch ms, phase가 rest일 때) */
  restEndsAt?: number;
  /** 카운트다운 길이 (진행바 분모, e2e 빨리 감기면 짧음) */
  restMs?: number;
  /** ask에서 "5분 쉬기" */
  onRest: () => void;
  /** ask에서 "조금만 더 할래요"·Esc */
  onMore: () => void;
  /** rest 카운트다운이 0이 됨 */
  onRestEnd: () => void;
  /** rest 중 "그만 쉬고 돌아가기"·back의 "다시 모험하기"·Esc */
  onClose: () => void;
}

const TIPS = [
  { Icon: Eye, text: '창밖 먼 곳을 20초 바라봐요' },
  { Icon: PersonStanding, text: '일어나서 기지개를 쭉 켜요' },
  { Icon: GlassWater, text: '물 한 잔 마셔요' },
] as const;

const COPY = {
  ask: {
    title: '40분이나 모험했어요!',
    description: '눈과 몸을 잠깐 쉬어요. 파이뱀이 기다릴게요.',
    pose: 'proud',
  },
  rest: {
    title: '쉬는 중이에요',
    description: '화면에서 눈을 떼고 몸을 움직여 봐요.',
    pose: 'sleep',
  },
  back: {
    title: '다 쉬었어요!',
    description: '개운해졌죠? 다시 모험하러 가요.',
    pose: 'cheer',
  },
} as const;

const mmss = (ms: number) => {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * 휴식 알림 카드 (P8-12, §2.6). 40분 연속 모험 뒤 파이뱀이 쉬자고 권한다 — 막지 않고 고르게 한다.
 * ask(권유·스트레칭 제안) → rest(5분 카운트다운, 파이뱀 잠) → back(다 쉬었어요). 공통 `Modal`(초점 가두기·Esc·덮개, 연출 단계·동작 줄이기는 `.g-modal`) 위에 그림. Esc·덮개 = ask면 "조금만 더", 그 밖은 돌아가기.
 * 상태·시간 계산은 `RestReminder`(타이머)가 하고 여기는 그리기만 → 카탈로그가 같은 컴포넌트로 견본을 띄운다
 */
export function RestReminderDialog({
  phase,
  restEndsAt = 0,
  restMs = REST_MS,
  onRest,
  onMore,
  onRestEnd,
  onClose,
}: RestReminderDialogProps) {
  const restRef = useRef<HTMLButtonElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const left = restEndsAt - now;

  useEffect(() => {
    if (phase !== 'rest') return;
    const tick = () => setNow(Date.now());
    tick(); // 시작 시각이 지난 값이면 첫 화면이 5:00보다 크게 보이므로 바로 맞춘다
    const id = setInterval(tick, Math.min(1000, restMs / 20));
    return () => clearInterval(id);
  }, [phase, restMs]);

  // 카운트다운이 끝나면 한 번 알림 (탭이 숨어 있었어도 돌아온 첫 틱에)
  const ended = phase === 'rest' && left <= 0;
  useEffect(() => {
    if (ended) onRestEnd();
  }, [ended, onRestEnd]);

  const shown = phase ?? 'ask';
  const copy = COPY[shown];
  return (
    <Modal
      open={phase !== null}
      onOpenChange={(open) => {
        if (open) return;
        if (shown === 'ask') onMore();
        else onClose();
      }}
      title={copy.title}
      description={copy.description}
      align="center"
      showClose={false}
      className="rr"
      data-testid="rest-reminder"
      initialFocus={shown === 'ask' ? restRef : undefined}
      media={
        <div className="rr-hero" data-phase={shown} aria-hidden>
          <PybaemRig
            state={copy.pose}
            size={112}
            framing="avatar"
            label=""
            lookAt={false}
            pokeable={false}
            paused={phase === null}
          />
        </div>
      }
      footer={
        shown === 'ask' ? (
          <>
            <Button
              variant="secondary"
              onClick={onMore}
              data-testid="rest-more"
            >
              조금만 더 할래요
            </Button>
            <Button ref={restRef} onClick={onRest} data-testid="rest-start">
              5분 쉬기
            </Button>
          </>
        ) : shown === 'rest' ? (
          <Button variant="ghost" onClick={onClose} data-testid="rest-stop">
            그만 쉬고 돌아가기
          </Button>
        ) : (
          <Button onClick={onClose} data-testid="rest-back">
            다시 모험하기
          </Button>
        )
      }
    >
      {shown === 'ask' && (
        <ul className="rr-tips">
          {TIPS.map(({ Icon, text }) => (
            <li key={text}>
              <Icon aria-hidden strokeWidth={2.2} />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      )}
      {shown === 'rest' && (
        <div className="rr-count">
          <p
            className="rr-clock font-display tabular-nums"
            role="timer"
            aria-label="남은 쉬는 시간"
            data-testid="rest-clock"
          >
            {mmss(left)}
          </p>
          <ProgressBar
            value={restMs - Math.max(0, left)}
            max={restMs}
            label="쉬는 시간"
            valueText={`${mmss(left)} 남음`}
            tone="reward"
          />
        </div>
      )}
    </Modal>
  );
}
