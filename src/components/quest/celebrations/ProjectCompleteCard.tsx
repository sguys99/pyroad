'use client';

import { Map } from 'lucide-react';
import { withObjectParticle } from '@/lib/korean';
import type { MotionBudget } from '@/lib/motion/tier';
import type { StageClearInfo } from '@/lib/quest/rewards';
import {
  CelebrationCta,
  CelebrationMascot,
  ConceptChips,
  CountUp,
  Kicker,
  delayStyle,
} from './parts';
import { MapActions } from './StageClearCard';

interface ProjectCompleteCardProps {
  questTitle: string;
  xpGained: number;
  /** 스테이지 마지막 프로젝트(7-1)면 스테이지 클리어도 이 카드 하나에 */
  stage: StageClearInfo | null;
  budget: MotionBudget;
  settled: boolean;
  worldHref: string;
  onNext: () => void;
}

/**
 * 프로젝트 완성 (P6-13). 스테이지의 마지막 퀘스트였으면 스테이지 클리어를 아래 쪽지로 함께 보여 주고
 * (같은 순간을 두 번 축하하지 않게), 그때는 스테이지 클리어 카드처럼 맨 뒤에 와서 "지도에서 새 길 보기"가 주 버튼
 */
export function ProjectCompleteCard({
  questTitle,
  xpGained,
  stage,
  budget,
  settled,
  worldHref,
  onNext,
}: ProjectCompleteCardProps) {
  return (
    <>
      <CelebrationMascot size={88} budget={budget} settled={settled} />

      <div className="cel-head">
        <Kicker>프로젝트 완성!</Kicker>
        <h2
          id="celebration-title"
          className="cel-t font-display cel-rise"
          style={delayStyle(120)}
        >
          {withObjectParticle(questTitle)} 완성했어요!
        </h2>
      </div>

      {xpGained > 0 && (
        <ul className="cel-gains" aria-label="받은 보상">
          <li className="cel-gain cel-pop" style={delayStyle(300)}>
            <span className="cel-xp" aria-hidden>
              XP
            </span>
            <b>
              +
              <CountUp
                to={xpGained}
                durationMs={800 * budget.effectDuration}
                delayMs={350 * budget.effectDuration}
                animate={budget.effectDuration > 0 && !settled}
              />
            </b>
            <span className="sr-only">XP</span>
          </li>
        </ul>
      )}

      {stage && (
        <div className="cel-slip cel-rise" style={delayStyle(450)}>
          <p className="cel-slip-k flex items-center gap-1.5">
            <Map className="size-4" aria-hidden />
            스테이지 {stage.order} · {stage.title} 클리어!
          </p>
          <ConceptChips concepts={stage.concepts} delayMs={560} />
        </div>
      )}

      {stage ? (
        <MapActions
          worldHref={worldHref}
          onStay={onNext}
          stageId={stage.stage_id}
        />
      ) : (
        <div className="cel-actions">
          <CelebrationCta onClick={onNext}>대단해요!</CelebrationCta>
        </div>
      )}
    </>
  );
}
