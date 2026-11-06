'use client';

import { m } from 'framer-motion';
import { sec } from '@/lib/motion/tokens';
import { Map } from 'lucide-react';
import { LottieCharacter } from '@/components/characters/LottieCharacter';
import { useCountUp } from '@/lib/celebration/ticker';
import { withObjectParticle } from '@/lib/korean';
import type { MotionBudget } from '@/lib/motion/tier';
import type { StageClearInfo } from '@/lib/quest/rewards';
import { CelebrationCta, ConceptChips, Kicker } from './parts';
import { popIn } from './motion';

interface ProjectCompleteCardProps {
  questTitle: string;
  xpGained: number;
  /** 스테이지 마지막 프로젝트(7-1)면 스테이지 클리어도 이 카드 하나에 */
  stage: StageClearInfo | null;
  budget: MotionBudget;
  onNext: () => void;
}

/**
 * 프로젝트 완성. 스테이지의 마지막 퀘스트였으면 스테이지 클리어를 아래 띠로 함께 보여 준다
 * (따로 카드를 하나 더 띄우면 같은 순간을 두 번 축하하게 됨. 파이뱀 선생님의 격려는 대화창으로 옴)
 */
export function ProjectCompleteCard({
  questTitle,
  xpGained,
  stage,
  budget,
  onNext,
}: ProjectCompleteCardProps) {
  const xp = useCountUp<HTMLSpanElement>({
    from: 0,
    to: xpGained,
    durationMs: 800 * budget.effectDuration,
    delayMs: 350,
    animate: budget.effectDuration > 0,
  });

  return (
    <>
      <LottieCharacter
        character="pybaem"
        animation="project-complete"
        size={96}
        expression="celebrating"
      />

      <div className="flex flex-col items-center gap-1">
        <Kicker>프로젝트 완성!</Kicker>
        <m.h2
          id="celebration-title"
          {...popIn(budget, 0.12, { scale: 0.8, y: 8 })}
          className="text-center text-xl font-black leading-snug text-primary-text"
        >
          {withObjectParticle(questTitle)}
          <br />
          완성했어요!
        </m.h2>
      </div>

      {xpGained > 0 && (
        <m.p
          {...popIn(budget, 0.3, { scale: 0.8 })}
          className="rounded-full bg-accent-soft px-4 py-1 text-sm font-bold text-accent-text"
        >
          +<span ref={xp.ref}>{xp.initial}</span> XP
        </m.p>
      )}

      {stage && (
        <m.div
          {...popIn(budget, 0.45, { y: 10, scale: 0.98 })}
          className="flex w-full flex-col items-center gap-2 rounded-2xl bg-primary/10 p-3"
        >
          <p className="flex items-center gap-1.5 text-sm font-bold text-primary-text">
            <Map className="h-4 w-4" aria-hidden />
            Stage {stage.order} · {stage.title} 완료!
          </p>
          <p className="text-xs text-muted-foreground">
            이 스테이지의 퀘스트를 모두 끝냈어요
          </p>
          <ConceptChips
            concepts={stage.concepts}
            budget={budget}
            delay={sec('slow') + sec('fast')}
          />
        </m.div>
      )}

      <CelebrationCta onClick={onNext}>대단해요!</CelebrationCta>
    </>
  );
}
