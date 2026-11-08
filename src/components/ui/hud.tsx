'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { DURATION, springTiming } from '@/lib/motion/tokens';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { ProgressBar } from '@/components/ui/progress-bar';
import { RewardIcon } from '@/components/ui/reward-icon';
import { useCountUp } from '@/components/ui/use-count-up';

// 모양 (P4-12: 전역 game-ui.css에서 떼어 이 컴포넌트를 쓰는 화면에만 싣는다)
import './hud.css';
/**
 * 재화 HUD (P2-11, docs/design/components.md §8). 최종 시안 `Hud`: 레벨 도장 · XP 바 · 코인 · 별 · (퀘스트에서만) 황금키 · 소리 토글 자리.
 *
 * - 숫자는 `hud-num`(고정 폭 숫자 + 최소 폭, 오른쪽 정렬) → 카운트업 중에 칩 폭이 흔들리지 않는다
 * - 값이 오르면: 숫자 카운트업(`useCountUp`) + 칩 팝(prop 스프링, full·lite). minimal·동작 줄이기는 숫자를 바로 바꾸고
 *   칩을 금색 틴트 면으로 잠깐 칠한다(움직임 없이 색으로)
 * - 640px 미만: 칸 사이를 좁히고 "경험치" 글자는 화면 낭독기에만, 1만 이상은 "1.2만"처럼 줄여 쓴다(낭독기는 전체 수)
 * - 낭독기는 칩마다 "코인 1,234개"를 한 번에 읽는다(보이는 숫자는 `aria-hidden`이라 카운트업 중간값을 읽지 않음)
 */

/** 큰 수를 줄여 쓰기: 9,999까지 그대로, 1만 이상은 "1.2만", 1억 이상은 "1.2억" */
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  const trim = (v: number) => v.toFixed(1).replace(/\.0$/, '');
  if (abs >= 100_000_000) return `${trim(n / 100_000_000)}억`;
  if (abs >= 10_000) return `${trim(n / 10_000)}만`;
  return n.toLocaleString('ko-KR');
}

/** 값이 오를 때 한 번 반응: full·lite = 팝, minimal·동작 줄이기 = 색 (data-flash) */
function useBump(value: number) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  const { budget } = useMotionTier();

  useEffect(() => {
    const up = value > prev.current;
    prev.current = value;
    if (!up) return;
    const el = ref.current;
    if (budget.springs && el?.animate) {
      el.animate(
        [{ transform: 'scale(1.25) rotate(-4deg)', offset: 0 }],
        springTiming('prop'),
      );
      return;
    }
    setFlash(true);
    const t = setTimeout(() => setFlash(false), DURATION.progress);
    return () => clearTimeout(t);
  }, [value, budget.springs]);

  return { ref, flash };
}

interface LevelSealProps {
  level: number;
  size?: 'md' | 'sm';
  className?: string;
}

/** 레벨 도장: 주색 원 + "Lv" + 숫자. 낭독기는 "레벨 3" */
export function LevelSeal({ level, size = 'md', className }: LevelSealProps) {
  const { ref } = useBump(level);
  return (
    <span
      ref={ref}
      data-size={size}
      className={cn('g-seal', className)}
      data-testid="level-seal"
    >
      <span className="sr-only">레벨 {level}</span>
      <span aria-hidden className="g-seal-k font-sans font-semibold">
        Lv
      </span>
      <span aria-hidden className="g-seal-n font-display">
        {level}
      </span>
    </span>
  );
}

export type HudKind = 'coin' | 'star' | 'key';

const KIND_LABEL: Record<HudKind, string> = {
  coin: '코인',
  star: '별',
  key: '황금키',
};

interface HudCounterProps {
  kind: HudKind;
  value: number;
  /** 낭독기 이름 (기본: 코인·별·황금키) */
  label?: string;
  /** 단위 (낭독기용, 기본 "개") */
  unit?: string;
  /** 1만 이상 줄여 쓰기를 화면 폭과 상관없이 끄기 (황금키처럼 작은 수) */
  noCompact?: boolean;
  className?: string;
}

/** 재화 칩: 보상 아이콘 + 고정 폭 숫자 */
export function HudCounter({
  kind,
  value,
  label = KIND_LABEL[kind],
  unit = '개',
  noCompact = false,
  className,
}: HudCounterProps) {
  const shown = useCountUp(value);
  const { ref, flash } = useBump(value);
  const full = shown.toLocaleString('ko-KR');
  const short = noCompact ? full : formatCompact(shown);
  return (
    <span
      ref={ref}
      className={cn('g-chip', className)}
      data-kind={kind}
      data-flash={flash || undefined}
      data-testid={`hud-${kind}`}
    >
      <RewardIcon kind={kind} size={26} />
      <span className="sr-only">
        {label} {value.toLocaleString('ko-KR')}
        {unit}
      </span>
      <span
        aria-hidden
        className={cn(
          'g-hud-num hud-num font-display',
          kind === 'key' && 'min-w-[1.2ch]',
        )}
      >
        {short === full ? (
          full
        ) : (
          <>
            <span className="max-sm:hidden">{full}</span>
            <span className="sm:hidden">{short}</span>
          </>
        )}
      </span>
    </span>
  );
}

interface CurrencyHudProps {
  level: number;
  /** 이번 레벨 안에서의 경험치 */
  xp: { value: number; max: number };
  coins?: number;
  stars?: number;
  /** 황금키 (퀘스트 화면에서만 넘긴다, §12-Q29) */
  keys?: number;
  /** 끝 자리 (소리 토글) */
  end?: ReactNode;
  className?: string;
}

/** HUD 한 줄: 레벨 도장 · XP 바 · 재화 칩 · 끝 자리. 없는 재화는 넘기지 않으면 그리지 않는다 */
export function CurrencyHud({
  level,
  xp,
  coins,
  stars,
  keys,
  end,
  className,
}: CurrencyHudProps) {
  return (
    <div
      role="group"
      aria-label="내 레벨과 보물"
      className={cn('g-hud', className)}
      data-slot="hud"
    >
      <span className="flex items-center gap-2">
        <LevelSeal level={level} />
        <span className="g-hud-xp">
          <span className="text-caption text-muted-foreground max-sm:sr-only">
            경험치
          </span>
          <ProgressBar
            value={xp.value}
            max={xp.max}
            size="sm"
            label="다음 레벨까지 경험치"
            valueText={`${xp.value} / ${xp.max}`}
          />
        </span>
      </span>
      {coins !== undefined && <HudCounter kind="coin" value={coins} />}
      {stars !== undefined && <HudCounter kind="star" value={stars} />}
      {keys !== undefined && <HudCounter kind="key" value={keys} noCompact />}
      {end && <span className="ml-auto flex items-center">{end}</span>}
    </div>
  );
}
