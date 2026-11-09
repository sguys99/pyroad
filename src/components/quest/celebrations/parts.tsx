'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { m } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import type { MotionBudget } from '@/lib/motion/tier';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { RewardIcon } from '@/components/ui/reward-icon';
import { useCountUp } from '@/lib/celebration/ticker';
import { PybaemStatic } from '@/components/characters/rig';
import { popIn } from './motion';

/**
 * 축하 카드의 다음으로 버튼. 모든 축하 카드가 같은 모양·같은 testid(`celebration-cta`, §2.10 측정 하네스)를 쓴다.
 * 단계가 바뀔 때마다 포커스를 받는다 (스크린 리더·Tab 사용자). Enter/Space·Esc는 시퀀서가 창 전체에서 받으므로
 * 포커스 전에도 키보드로 넘길 수 있다.
 *
 * `autoFocus`를 쓰지 않는 이유: 커밋 중의 `focus()`가 스크롤·레이아웃을 강제로 계산해, CPU 4배에서 카드 등장 첫 프레임에
 * 수 초짜리 긴 작업이 생겼다 (P1-10 측정). 등장 스프링이 거의 끝난 뒤 `preventScroll`로 옮긴다.
 */
export const CTA_FOCUS_DELAY_MS = 320;

export function CelebrationCta({
  children,
  onClick,
  wide = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const timer = setTimeout(
      () => ref.current?.focus({ preventScroll: true }),
      CTA_FOCUS_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, []);

  return (
    // 게임 버튼 (P2-11): 눌림 피드백은 버튼이, 소리는 시퀀서가 낸다
    <Button
      ref={ref}
      data-testid="celebration-cta"
      sfx={false}
      className={cn('mt-1', wide && 'w-full')}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/** 카드 맨 위 작은 머리글 ("레벨 업!", "뱃지 획득!") */
export function Kicker({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'text-xs font-bold tracking-wide text-muted-foreground',
        className,
      )}
    >
      {children}
    </p>
  );
}

/** 배운 개념 칩: 하나씩 톡톡 (transform만) */
export function ConceptChips({
  concepts,
  budget,
  delay,
}: {
  concepts: string[];
  budget: MotionBudget;
  delay: number;
}) {
  if (concepts.length === 0) return null;
  return (
    <ul
      className="flex flex-wrap justify-center gap-1.5"
      aria-label="배운 개념"
    >
      {concepts.map((concept, i) => (
        <m.li
          key={concept}
          {...popIn(budget, delay + i * 0.05, { y: 6, scale: 0.85 })}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary-text"
        >
          <CheckCircle className="h-3 w-3" aria-hidden />
          {concept}
        </m.li>
      ))}
    </ul>
  );
}

/**
 * 별 1→3 스프링 팝 (P6-08, Q52: 화면에서는 `SHOW_STARS`가 켜질 때만 — 지금은 카탈로그에서 확인).
 * 받은 별은 빈 별 자리 위로 하나씩 톡(prop 스프링, 회전하며), 못 받은 별은 빈 별 그대로. `settled`면 움직임 없이 끝 모습.
 * 효과음 자리(P6-14): 별이 톡 튈 때마다 `useSfx` 'star' — rate `STAR_RATES[i]`(1 → 1.26 → 1.5)
 */
export function StarRow({
  stars,
  budget,
  delay = 0,
  size = 44,
  settled = false,
}: {
  stars: 1 | 2 | 3;
  budget: MotionBudget;
  /** 첫 별이 튀는 시각 (초, 부모 등장 기준) */
  delay?: number;
  size?: number;
  settled?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1"
      role="img"
      aria-label={`별 ${stars}개 / 3개`}
      data-testid="reward-stars"
    >
      {[0, 1, 2].map((i) => (
        <span key={i} className="relative inline-grid">
          <RewardIcon kind="starEmpty" size={size} />
          {i < stars && (
            <m.span
              // 건너뛰면 새로 그려 끝 모습으로 (진행 중인 스프링을 멈추지 않고 갈아 끼움)
              key={settled ? 'settled' : 'pop'}
              className="absolute inset-0"
              {...(settled
                ? { initial: false, animate: { scale: 1, rotate: 0 } }
                : popIn(budget, delay + i * 0.15, { scale: 0.2, rotate: -40 }))}
            >
              <RewardIcon kind="star" size={size} />
            </m.span>
          )}
        </span>
      ))}
    </span>
  );
}

/**
 * 숫자 카운트업 (XP·코인). span 글자만 바꾸므로 프레임마다 다시 그리지 않는다(`useCountUp`).
 * 화면 낭독기에는 끝 값만 읽히도록 바뀌는 숫자는 숨기고 끝 값을 따로 둔다.
 * `animate`가 false가 되면(건너뛰기·minimal·동작 줄이기) 바로 끝 값
 */
export function CountUp({
  to,
  durationMs,
  delayMs = 0,
  animate,
  testId,
}: {
  to: number;
  durationMs: number;
  delayMs?: number;
  animate: boolean;
  testId?: string;
}) {
  const count = useCountUp<HTMLSpanElement>({
    from: 0,
    to,
    durationMs,
    delayMs,
    animate,
  });
  return (
    <>
      <span
        ref={count.ref}
        aria-hidden
        className="tabular-nums"
        data-testid={testId}
      >
        {count.initial}
      </span>
      <span className="sr-only">{to}</span>
    </>
  );
}

// 축하 카드의 파이뱀: 첫 그림은 같은 모습의 정지 그림, 라이브 리그는 카드가 뜰 때 받는다 (rig.md 지연 로드)
const PybaemRig = dynamic(
  () =>
    import('@/components/characters/rig/MascotRig').then((m) => m.PybaemRig),
  {
    ssr: false,
    loading: () => <PybaemStatic state="proud" size={96} label="" />,
  },
);

/**
 * 축하 카드의 파이뱀 (P6-08, B32 `LottieCharacter` 대체): 뿌듯한 얼굴(`proud`)로 나타났다가
 * `jumpAtMs`에 기쁨 점프(`happy`: 웅크림 → 점프 두 번 + 착지 젤리). 반복 점프(`cheer`)는 오버레이에서 쓰지 않는다(§2.10).
 * 연출 단계는 리그가 따른다: minimal은 자세 전환만, 동작 줄이기는 움직임 0(표정만, §12-Q26). 화면 밖·숨긴 탭이면 리그가 멈춤
 */
export function CelebrationMascot({
  size = 96,
  jumpAtMs = 600,
  budget,
}: {
  size?: number;
  /** 카드 등장 기준 점프 시작 (ms, full 기준 — lite는 70%) */
  jumpAtMs?: number;
  budget: MotionBudget;
}) {
  const at = Math.round(jumpAtMs * budget.effectDuration);
  const [jumped, setJumped] = useState(at === 0);
  useEffect(() => {
    if (jumped) return;
    const t = setTimeout(() => setJumped(true), at);
    return () => clearTimeout(t);
  }, [at, jumped]);
  return (
    <span
      className="inline-grid"
      style={{ width: size, height: size }}
      data-testid="celebration-mascot"
      data-rig-state={jumped ? 'happy' : 'proud'}
      aria-hidden
    >
      <PybaemRig
        state={jumped ? 'happy' : 'proud'}
        size={size}
        label=""
        lookAt={false}
      />
    </span>
  );
}
