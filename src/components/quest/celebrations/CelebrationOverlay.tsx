'use client';

import { useEffect, useRef } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';

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
  children: React.ReactNode;
}

const springConfig = { type: 'spring' as const, damping: 15, stiffness: 300 };
const instantConfig = { duration: 0 };

export function CelebrationOverlay({
  onClose,
  autoCloseMs,
  confettiBursts,
  backdropClass = 'bg-black/50',
  children,
}: CelebrationOverlayProps) {
  const shouldReduceMotion = useReducedMotion();
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Confetti 발사 (reduced-motion 시 비활성화)
    if (!shouldReduceMotion && confettiBursts) {
      for (const burst of confettiBursts) {
        const timer = setTimeout(() => {
          confetti({
            particleCount: burst.particleCount,
            spread: burst.spread,
            origin: burst.origin,
            ...(burst.colors ? { colors: burst.colors } : {}),
          });
        }, burst.delay ?? 0);
        timersRef.current.push(timer);
      }
    }

    // 자동 닫힘
    if (autoCloseMs) {
      const autoClose = setTimeout(onClose, autoCloseMs);
      timersRef.current.push(autoClose);
    }

    return () => {
      for (const t of timersRef.current) clearTimeout(t);
      timersRef.current = [];
    };
  }, [onClose, autoCloseMs, confettiBursts, shouldReduceMotion]);

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
        {children}
      </m.div>
    </m.div>
  );
}
