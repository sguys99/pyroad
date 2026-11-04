'use client';

import { useEffect, useRef } from 'react';
import { m, MotionConfig, useReducedMotion } from 'framer-motion';
import { fireConfetti } from '@/lib/confetti';

export interface ConfettiBurst {
  particleCount: number;
  spread: number;
  origin: { x: number; y: number };
  delay?: number;
  colors?: string[];
}

interface CelebrationOverlayProps {
  onClose: () => void;
  autoCloseMs?: number;
  confettiBursts?: ConfettiBurst[];
  backdropClass?: string;
  /**
   * 이 값이 바뀔 때만 컨페티·자동 닫힘을 다시 시작한다 (예: 뱃지를 하나씩 넘길 때).
   * onClose·confettiBursts는 ref로 읽으므로 부모가 다시 그려져 새 함수·배열을 넘겨도
   * 컨페티가 다시 터지거나 자동 닫힘 타이머가 늘어나지 않는다 (§2.10 축하 오버레이는 셸 재렌더에서 분리)
   */
  replayKey?: string | number;
  children: React.ReactNode;
}

const springConfig = { type: 'spring' as const, damping: 15, stiffness: 300 };
const instantConfig = { duration: 0 };

export function CelebrationOverlay({
  onClose,
  autoCloseMs,
  confettiBursts,
  backdropClass = 'bg-black/50',
  replayKey,
  children,
}: CelebrationOverlayProps) {
  const shouldReduceMotion = useReducedMotion();
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const burstsRef = useRef(confettiBursts);
  burstsRef.current = confettiBursts;

  useEffect(() => {
    // Confetti 발사 (reduced-motion 시 비활성화, fireConfetti도 한 번 더 확인)
    const bursts = burstsRef.current;
    if (!shouldReduceMotion && bursts) {
      for (const burst of bursts) {
        const timer = setTimeout(() => {
          fireConfetti({
            particleCount: burst.particleCount,
            spread: burst.spread,
            origin: burst.origin,
            ticks: 90,
            gravity: 2.2,
            startVelocity: 70,
            ...(burst.colors ? { colors: burst.colors } : {}),
          });
        }, burst.delay ?? 0);
        timersRef.current.push(timer);
      }
    }

    // 자동 닫힘
    if (autoCloseMs) {
      const autoClose = setTimeout(() => onCloseRef.current(), autoCloseMs);
      timersRef.current.push(autoClose);
    }

    return () => {
      for (const t of timersRef.current) clearTimeout(t);
      timersRef.current = [];
    };
  }, [autoCloseMs, shouldReduceMotion, replayKey]);

  return (
    <m.div
      className={`fixed inset-0 z-50 flex items-center justify-center ${backdropClass}`}
      data-testid="celebration-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={shouldReduceMotion ? instantConfig : undefined}
      onClick={onClose}
    >
      <m.div
        className="mx-4 flex max-w-sm flex-col items-center gap-4 rounded-2xl bg-card p-8 shadow-xl"
        initial={shouldReduceMotion ? undefined : { scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={shouldReduceMotion ? undefined : { scale: 0.8, opacity: 0 }}
        transition={shouldReduceMotion ? instantConfig : springConfig}
        onClick={(e) => e.stopPropagation()}
      >
        {/* reduced-motion이면 안쪽 팝·점프 등 transform 연출을 즉시 끝냄 (움직임 0) */}
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </m.div>
    </m.div>
  );
}
