'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, m } from 'framer-motion';
import { sec, tierDuration } from '@/lib/motion/tokens';
import { X } from 'lucide-react';
import type { CelebrationEvent } from '@/lib/quest/celebrationEvents';
import {
  STEP_SPECS,
  introMs,
  sfxSchedule,
  stepSummary,
  type CelebrationStep,
} from '@/lib/celebration/plan';
import {
  CONFETTI_PHYSICS,
  CONFETTI_PRESETS,
  LEVEL_POP_BURST,
  type ConfettiBurst,
} from '@/lib/celebration/confettiPresets';
import { setBackdropQuiet } from '@/lib/celebration/backdropQuiet';
import { useCelebrationSound } from '@/lib/celebration/sound';
import { useCelebrationSequence } from '@/lib/celebration/useCelebrationSequence';
import { fireConfetti, resetConfetti } from '@/lib/confetti';
import type { MotionBudget } from '@/lib/motion/tier';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { cn } from '@/lib/utils';
import { SHOW_COINS } from '@/lib/world/flags';
import { cardMotion } from './celebrations/motion';
import { StageClearCard } from './celebrations/StageClearCard';
import { ProjectCompleteCard } from './celebrations/ProjectCompleteCard';
import { LevelUpCard } from './celebrations/LevelUpCard';
import { BadgesCard } from './celebrations/BadgesCard';
import { GoldenKeyCard } from './celebrations/GoldenKeyCard';
import { RewardsCard } from './celebrations/RewardsCard';
import { ChestCard } from './celebrations/ChestCard';
import './celebrations/celebration.css';

interface QuestCelebrationsProps {
  /** 아직 보여 주지 않은 축하 (useQuestSession.celebrations) */
  events: CelebrationEvent[];
  questId: string;
  /** 스테이지를 끝낸 카드의 "지도에서 새 길 보기" */
  worldHref: string;
  /** 앞에서부터 count개를 보여 줬다 */
  onDismiss: (count: number) => void;
}

/**
 * 축하 시퀀서 (P1-10 → P6-13 리디자인): 축하 이벤트를 단계로 계획해(`planCelebrations`) 한 번에 하나씩 보여 준다.
 *
 * - 퀘스트 화면은 이 컴포넌트를 받은 축하가 있을 때만 지연 로드해 그린다(`QuestWorkspace`). 평소에는 chunk도 DOM도 없다
 * - 배경(어두운 막)은 시퀀스 내내 그대로이고 카드만 바뀐다 (`AnimatePresence mode="wait"`: 짧은 퇴장 → 스프링 등장)
 * - 카드마다 등장 연출(`introMs`, full 기준·lite 70%) 동안 탭·Enter·Space·Esc는 **끝 상태로 건너뛰기**(§12-Q28).
 *   끝 상태에서는 Enter·Space·배경 탭 = 다음, Esc·"모두 닫기" = 모두 닫기. 단계마다 자동 넘김(카드 아래 막대)
 * - 컨페티·효과음은 카드가 나타날 때 단계 사양(`STEP_SPECS`)대로. 카드가 사라지거나 건너뛰면 남은 예약도 취소
 * - 떠 있는 동안 뒤 화면을 조용히(`setBackdropQuiet`: 덮개 뒤 라이브 리그 정지·책 펼침 CSS 애니메이션 멈춤, §2.10)
 * - 대화 상자: Tab은 카드 안에서만, 닫히면 열기 전 포커스로, 카드가 바뀔 때 받은 것을 한 줄로 읽어 줌(aria-live)
 *
 * memo + 안정된 props(이벤트 배열은 다 보여 준 뒤 비울 때만 바뀜)라서 퀘스트 셸이 튜터 스트리밍 등으로
 * 다시 그려져도 오버레이는 다시 그려지지 않는다 (§2.10).
 */
export const QuestCelebrations = memo(function QuestCelebrations({
  events,
  questId,
  worldHref,
  onDismiss,
}: QuestCelebrationsProps) {
  const seq = useCelebrationSequence({ events, onDismiss });
  const { budget, reduced } = useMotionTier();
  const { step, next, skipAll } = seq;
  const dialogRef = useRef<HTMLDivElement>(null);
  const open = step !== null;
  const stepId = step?.id ?? null;

  // 등장 연출이 끝났는지 (시간이 다 되었거나 건너뜀). 동작 줄이기·0초면 처음부터 끝
  const [settledId, setSettledId] = useState<string | null>(null);
  // minimal은 카드 안 연출이 없으므로(페이드만) 처음부터 끝 상태
  const playMs =
    step && budget.springs ? tierDuration(introMs(step), budget) : 0;
  const settled = !step || playMs === 0 || settledId === stepId;
  const settle = useCallback(() => setSettledId(stepId), [stepId]);
  useEffect(() => {
    if (settled) return;
    const timer = setTimeout(settle, playMs);
    return () => clearTimeout(timer);
  }, [settled, settle, playMs]);

  // 지금 보여 주는 단계. 퇴장 중이거나 건너뛴 카드는 예약해 둔 컨페티·효과음을 쏘지 않는다
  // (퇴장 연출 동안 DOM에 남아 있으므로 언마운트 정리만으로는 늦음)
  const activeStepRef = useRef<string | null>(null);
  activeStepRef.current = step && settledId !== step.id ? step.id : null;

  // 뒤 화면 조용히
  useEffect(() => {
    if (!open) return;
    setBackdropQuiet(true);
    return () => setBackdropQuiet(false);
  }, [open]);

  // 키보드: 연출 중엔 Enter·Space·Esc = 끝 상태로, 그 뒤 Enter·Space 다음, Esc 모두 닫기. Tab은 카드 안에서만
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const isAdvance = e.key === 'Enter' || e.key === ' ';
      if (e.key === 'Tab') {
        trapFocus(e, dialogRef.current);
        return;
      }
      if (e.key !== 'Escape' && !isAdvance) return;
      // 카드 안 버튼 위의 Enter·Space는 그 버튼이 처리 ("모두 닫기"·지도로·여기 있을래요)
      if (
        isAdvance &&
        target?.closest(
          '[data-celebration-root] a, [data-celebration-root] button:not([data-testid="celebration-cta"])',
        )
      )
        return;
      e.preventDefault();
      if (!settled) settle();
      else if (e.key === 'Escape') skipAll();
      else next();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, next, skipAll, settled, settle]);

  // 닫히면 열기 전 포커스로 돌려준다 (실행 버튼 등). CTA 포커스보다 먼저 잡아야 하므로 렌더 중에 읽는다
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
            data-celebration-root
            data-reduced={reduced ? 'true' : 'false'}
            className="fixed inset-0 z-50 overflow-y-auto bg-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{
              opacity: 0,
              transition: reduced ? { duration: 0 } : { duration: sec('fast') },
            }}
            transition={fade}
            onClick={() => (settled ? next() : settle())}
          >
            {/* 위 컨트롤(점·모두 닫기)은 카드 바로 위에 붙임 — 화면 맨 위에 두면 뒤 HUD·헤더 버튼과 겹쳐 보임 (B64).
                카드가 화면보다 길면 막 안에서 스크롤 */}
            <div className="flex min-h-full flex-col items-center justify-center gap-2 p-4">
              <SequenceChrome
                index={seq.index}
                total={seq.total}
                onSkip={skipAll}
              />

              {/* 받은 것을 한 줄로 (카드가 바뀔 때마다 읽힘) */}
              <p
                className="sr-only"
                aria-live="polite"
                data-testid="celebration-live"
              >
                {stepSummary(step)}
              </p>

              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="celebration-title"
                className="relative w-full max-w-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  // 카드 안 빈 곳을 눌러도 연출은 끝 상태로 (버튼은 각자 동작)
                  if (!settled && !(e.target as Element).closest('a, button'))
                    settle();
                }}
              >
                <AnimatePresence mode="wait">
                  <StepFrame
                    key={step.id}
                    step={step}
                    activeStepRef={activeStepRef}
                    questId={questId}
                    worldHref={worldHref}
                    budget={budget}
                    settled={settled}
                    autoMs={seq.autoMs}
                    paused={seq.paused}
                    onNext={next}
                    onHover={seq.setHovering}
                  />
                </AnimatePresence>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
});

/** 카드 바로 위: 몇 번째 축하인지(점) + 모두 닫기. 카드가 바뀌어도 그대로 있다 */
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
    <div className="flex w-full max-w-sm items-center justify-between gap-2">
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
        className="flex min-h-11 min-w-20 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-on-scrim/15 px-3 text-small font-medium text-on-scrim outline-none transition-colors duration-(--dur-fast) hover:bg-on-scrim/25 focus-visible:ring-2 focus-visible:ring-on-scrim/70 reduced:transition-none"
      >
        {total > 1 ? '모두 닫기' : '닫기'}
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

interface StepFrameProps {
  step: CelebrationStep;
  activeStepRef: React.RefObject<string | null>;
  questId: string;
  worldHref: string;
  budget: MotionBudget;
  settled: boolean;
  autoMs: number | null;
  paused: boolean;
  onNext: () => void;
  onHover: (hovering: boolean) => void;
}

/** 카드 하나 (단계마다 새로 마운트). 나타날 때 컨페티·효과음을 예약하고, 사라지거나 건너뛰면 취소한다 */
function StepFrame({
  step,
  activeStepRef,
  questId,
  worldHref,
  budget,
  settled,
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
    for (const cue of sfxSchedule(s, b)) {
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
      data-kind={step.kind}
      data-settled={settled || undefined}
      className="cel-card"
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
        worldHref={worldHref}
        budget={budget}
        settled={settled}
        onNext={onNext}
        onPop={onPop}
      />
      {budget.effectDuration > 0 && (
        <span className="cel-skip" aria-hidden>
          누르면 건너뛰기
        </span>
      )}
      {showCountdown && (
        <span
          aria-hidden
          data-testid="celebration-countdown"
          className="celebration-countdown"
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
  worldHref,
  budget,
  settled,
  onNext,
  onPop,
}: {
  step: CelebrationStep;
  questId: string;
  worldHref: string;
  budget: MotionBudget;
  settled: boolean;
  onNext: () => void;
  onPop: () => void;
}) {
  switch (step.kind) {
    case 'golden_key':
      return (
        <GoldenKeyCard
          kind={step.event.kind}
          questTitle={step.event.questTitle}
          onNext={onNext}
        />
      );
    case 'stage_clear':
      return (
        <StageClearCard
          stage={step.stage}
          questId={questId}
          budget={budget}
          settled={settled}
          worldHref={worldHref}
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
          settled={settled}
          worldHref={worldHref}
          onNext={onNext}
        />
      );
    case 'level_up':
      return (
        <LevelUpCard
          level={step.event.level}
          fromLevel={step.event.fromLevel}
          title={step.event.title}
          coins={SHOW_COINS ? step.event.coins : 0}
          budget={budget}
          settled={settled}
          onNext={onNext}
          onPop={onPop}
        />
      );
    case 'badges':
      return <BadgesCard badges={step.badges} onNext={onNext} />;
    case 'rewards':
      return (
        <RewardsCard
          stars={step.stars}
          coins={step.coins}
          budget={budget}
          settled={settled}
          onNext={onNext}
        />
      );
    case 'chest':
      return (
        <ChestCard
          stageTitle={step.event.stageTitle}
          goal={step.event.goal}
          contents={step.event.contents}
          note={step.event.note}
          budget={budget}
          settled={settled}
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
