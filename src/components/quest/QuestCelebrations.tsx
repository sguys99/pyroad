'use client';

import { memo, useEffect, useRef } from 'react';
import { AnimatePresence, MotionConfig, m } from 'framer-motion';
import { sec } from '@/lib/motion/tokens';
import { X } from 'lucide-react';
import type { CelebrationEvent } from '@/lib/quest/celebrationEvents';
import {
  STEP_SPECS,
  sfxSchedule,
  type CelebrationStep,
} from '@/lib/celebration/plan';
import {
  CONFETTI_PHYSICS,
  CONFETTI_PRESETS,
  LEVEL_POP_BURST,
  type ConfettiBurst,
} from '@/lib/celebration/confettiPresets';
import { useCelebrationSound } from '@/lib/celebration/sound';
import { useCelebrationSequence } from '@/lib/celebration/useCelebrationSequence';
import { fireConfetti, resetConfetti } from '@/lib/confetti';
import type { MotionBudget } from '@/lib/motion/tier';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { cn } from '@/lib/utils';
import { cardMotion } from './celebrations/motion';
import { StageClearCard } from './celebrations/StageClearCard';
import { ProjectCompleteCard } from './celebrations/ProjectCompleteCard';
import { LevelUpCard } from './celebrations/LevelUpCard';
import { BadgesCard } from './celebrations/BadgesCard';
import { GoldenKeyCard } from './celebrations/GoldenKeyCard';
import { RewardsCard } from './celebrations/RewardsCard';

// 모양 (P4-12: 전역 game-ui.css에서 떼어 이 컴포넌트를 쓰는 화면에만 싣는다)
import '@/components/ui/overlay.css';
interface QuestCelebrationsProps {
  /** 아직 보여 주지 않은 축하 (useQuestSession.celebrations) */
  events: CelebrationEvent[];
  questId: string;
  /** 앞에서부터 count개를 보여 줬다 */
  onDismiss: (count: number) => void;
}

/**
 * 축하 시퀀서 (P1-10): 축하 이벤트를 단계로 계획해(`planCelebrations`) 한 번에 하나씩 보여 준다.
 *
 * - 배경(어두운 막)은 시퀀스 내내 그대로이고 카드만 바뀐다 (`AnimatePresence mode="wait"`: 짧은 퇴장 → 스프링 등장).
 *   단계마다 배경이 깜빡이지 않는다.
 * - 넘기기: CTA · 배경 탭 · Enter/Space, 모두 닫기: Esc · "모두 닫기". 단계마다 자동 넘김(카드 아래 막대)
 * - 컨페티·효과음은 카드가 나타날 때 단계 사양(`STEP_SPECS`)대로. 카드가 사라지면 남은 예약도 취소
 * - 연출 단계·reduced-motion은 `useMotionTier()` (P2-15가 실제 단계 감지를 꽂음). reduced면 움직임 0·컨페티 0
 *
 * memo + 안정된 props(이벤트 배열은 다 보여 준 뒤 비울 때만 바뀜)라서 퀘스트 셸이 튜터 스트리밍 등으로
 * 다시 그려져도 오버레이는 다시 그려지지 않는다 (§2.10).
 */
export const QuestCelebrations = memo(function QuestCelebrations({
  events,
  questId,
  onDismiss,
}: QuestCelebrationsProps) {
  const seq = useCelebrationSequence({ events, onDismiss });
  const { budget, reduced } = useMotionTier();
  const { step, next, skipAll } = seq;
  const dialogRef = useRef<HTMLDivElement>(null);
  const open = step !== null;
  // 지금 보여 주는 단계. 퇴장 중인 카드는 예약해 둔 컨페티·효과음을 쏘지 않는다
  // (퇴장 연출 동안 DOM에 남아 있으므로 언마운트 정리만으로는 늦음)
  const activeStepRef = useRef<string | null>(null);
  activeStepRef.current = step?.id ?? null;

  // 키보드: Enter/Space 다음, Esc 모두 닫기, Tab은 카드 안에서만 돈다
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (e.key === 'Escape') {
        e.preventDefault();
        skipAll();
      } else if (e.key === 'Enter' || e.key === ' ') {
        // "모두 닫기" 버튼 위에서는 그 버튼이 처리
        if (target?.closest('[data-celebration-skip]')) return;
        e.preventDefault();
        next();
      } else if (e.key === 'Tab') {
        trapFocus(e, dialogRef.current);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, next, skipAll]);

  // 닫히면 열기 전 포커스로 돌려준다 (실행 버튼 등). CTA의 autoFocus보다 먼저 잡아야 하므로 렌더 중에 읽는다
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  if (open && !restoreFocusRef.current && typeof document !== 'undefined') {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) {
      restoreFocusRef.current = active;
    }
  }
  const { onExitComplete } = seq;
  const handleExitComplete = () => {
    const el = restoreFocusRef.current;
    restoreFocusRef.current = null;
    if (el?.isConnected) el.focus({ preventScroll: true });
    onExitComplete();
  };

  // 화면을 떠나면 떠 있는 컨페티도 지운다
  useEffect(() => resetConfetti, []);

  const fade = reduced ? { duration: 0 } : { duration: sec('base') };

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <AnimatePresence onExitComplete={handleExitComplete}>
        {step && (
          <m.div
            key="celebration-backdrop"
            data-testid="celebration-overlay"
            data-reduced={reduced ? 'true' : 'false'}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-scrim p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{
              opacity: 0,
              transition: reduced ? { duration: 0 } : { duration: sec('fast') },
            }}
            transition={fade}
            onClick={next}
          >
            {/* 카드 뒤를 은은하게 밝히는 정적 조명 (흐림 필터 없이, lite에서도 그대로) */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,color-mix(in_srgb,var(--on-scrim)_16%,transparent),transparent_55%)]"
            />

            <SequenceChrome
              index={seq.index}
              total={seq.total}
              onSkip={skipAll}
            />

            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="celebration-title"
              className="relative w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <AnimatePresence mode="wait">
                <StepFrame
                  key={step.id}
                  step={step}
                  activeStepRef={activeStepRef}
                  questId={questId}
                  budget={budget}
                  autoMs={seq.autoMs}
                  paused={seq.paused}
                  onNext={next}
                  onHover={seq.setHovering}
                />
              </AnimatePresence>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
});

/** 위쪽: 몇 번째 축하인지(점) + 모두 닫기. 카드가 바뀌어도 그대로 있다 */
function SequenceChrome({
  index,
  total,
  onSkip,
}: {
  index: number;
  total: number;
  onSkip: () => void;
}) {
  return (
    <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-4">
      <span className="min-w-20" aria-hidden />
      {total > 1 ? (
        <ol
          className="flex items-center gap-1.5"
          aria-label={`축하 ${total}개 중 ${index + 1}번째`}
        >
          {Array.from({ length: total }, (_, i) => (
            <li
              key={i}
              className={cn(
                'h-2 rounded-full transition-[width,background-color] duration-(--dur-base) reduced:transition-none',
                i === index ? 'w-5 bg-on-scrim' : 'w-2',
                i < index ? 'bg-on-scrim/70' : i > index && 'bg-on-scrim/35',
              )}
            />
          ))}
        </ol>
      ) : (
        <span />
      )}
      <button
        type="button"
        data-celebration-skip
        onClick={(e) => {
          e.stopPropagation();
          onSkip();
        }}
        className="flex min-h-9 min-w-20 items-center justify-end gap-1 whitespace-nowrap rounded-full px-2 text-xs font-medium text-on-scrim outline-none focus-visible:ring-2 focus-visible:ring-on-scrim/70"
      >
        {total > 1 ? '모두 닫기' : '닫기'}
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

interface StepFrameProps {
  step: CelebrationStep;
  activeStepRef: React.RefObject<string | null>;
  questId: string;
  budget: MotionBudget;
  autoMs: number | null;
  paused: boolean;
  onNext: () => void;
  onHover: (hovering: boolean) => void;
}

/** 카드 하나 (단계마다 새로 마운트). 나타날 때 컨페티·효과음을 예약하고, 사라지면 취소한다 */
function StepFrame({
  step,
  activeStepRef,
  questId,
  budget,
  autoMs,
  paused,
  onNext,
  onHover,
}: StepFrameProps) {
  const sound = useCelebrationSound();
  const motion = cardMotion(budget);
  // 마운트 때 한 번만 (연출 단계가 도중에 바뀌어도 다시 쏘지 않게 ref로 읽음)
  const effectsRef = useRef({ step, budget, sound, activeStepRef });

  useEffect(() => {
    const {
      step: s,
      budget: b,
      sound: snd,
      activeStepRef: active,
    } = effectsRef.current;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) =>
      timers.push(
        setTimeout(() => {
          if (active.current === s.id) fn();
        }, ms),
      );
    const bursts =
      b.particles > 0 ? CONFETTI_PRESETS[STEP_SPECS[s.kind].confetti] : [];
    for (const burst of bursts) {
      at(burst.delay * Math.max(b.effectDuration, 0.5), () =>
        fireBurst(burst, b),
      );
    }
    for (const cue of sfxSchedule(s)) {
      at(cue.at, () => snd.play(cue.id, { rate: cue.rate }));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  const onPop = () => {
    const { step: s, budget: b, activeStepRef: active } = effectsRef.current;
    if (active.current === s.id) fireBurst(LEVEL_POP_BURST, b);
  };
  const showCountdown = autoMs !== null && budget.effectDuration > 0;

  return (
    <m.div
      data-testid={`celebration-step-${step.kind}`}
      className={cn(
        'relative mx-auto flex flex-col items-center gap-3 overflow-hidden rounded-3xl bg-card px-6 pb-7 pt-6 text-center shadow-xl',
        step.kind === 'golden_key' ? 'max-w-xs' : 'w-full',
      )}
      initial={motion.initial}
      animate={motion.animate}
      exit={motion.exit}
      transition={motion.transition}
      onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && onHover(false)}
    >
      <StepContent
        step={step}
        questId={questId}
        budget={budget}
        onNext={onNext}
        onPop={onPop}
      />
      {showCountdown && (
        <span
          aria-hidden
          data-testid="celebration-countdown"
          className="celebration-countdown absolute inset-x-0 bottom-0 h-1 bg-primary/35"
          style={{
            animationDuration: `${autoMs}ms`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
        />
      )}
    </m.div>
  );
}

function StepContent({
  step,
  questId,
  budget,
  onNext,
  onPop,
}: {
  step: CelebrationStep;
  questId: string;
  budget: MotionBudget;
  onNext: () => void;
  onPop: () => void;
}) {
  switch (step.kind) {
    case 'golden_key':
      return (
        <GoldenKeyCard
          kind={step.event.kind}
          questTitle={step.event.questTitle}
          budget={budget}
          onNext={onNext}
        />
      );
    case 'stage_clear':
      return (
        <StageClearCard
          stage={step.stage}
          questId={questId}
          budget={budget}
          onNext={onNext}
        />
      );
    case 'project_complete':
      return (
        <ProjectCompleteCard
          questTitle={step.questTitle}
          xpGained={step.xpGained}
          stage={step.stage}
          budget={budget}
          onNext={onNext}
        />
      );
    case 'level_up':
      return (
        <LevelUpCard
          level={step.event.level}
          fromLevel={step.event.fromLevel}
          title={step.event.title}
          budget={budget}
          onNext={onNext}
          onPop={onPop}
        />
      );
    case 'badges':
      return (
        <BadgesCard badges={step.badges} budget={budget} onNext={onNext} />
      );
    case 'rewards':
      return (
        <RewardsCard
          stars={step.stars}
          coins={step.coins}
          budget={budget}
          onNext={onNext}
        />
      );
  }
}

function fireBurst(burst: ConfettiBurst, budget: MotionBudget) {
  if (budget.particles <= 0) return;
  const { delay, ...options } = burst;
  void delay;
  fireConfetti(
    { ...CONFETTI_PHYSICS, ...options },
    { scale: budget.particles },
  );
}

/** 카드 안 버튼 사이에서만 Tab이 돈다 (모두 닫기 버튼 포함) */
function trapFocus(e: KeyboardEvent, dialog: HTMLElement | null) {
  const root = dialog?.parentElement;
  if (!root) return;
  const items = Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  );
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || !root.contains(active))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (active === last || !root.contains(active))) {
    e.preventDefault();
    first.focus();
  }
}
