'use client';

import { m } from 'framer-motion';
import { KeyRound } from 'lucide-react';
import { withObjectParticle } from '@/lib/korean';
import type { MotionBudget } from '@/lib/motion/tier';
import type { QuestKind } from '@/lib/quest/questKind';
import { CelebrationCta } from './parts';
import { popIn } from './motion';

interface GoldenKeyCardProps {
  kind: QuestKind;
  questTitle: string;
  budget: MotionBudget;
  onNext: () => void;
}

/**
 * 황금키로 연 퀘스트 (P1-09 → P1-10 결정): XP가 0이므로 큰 축하 대신 가벼운 확인.
 * 컨페티·캐릭터 점프 없이 열쇠가 한 번 돌아가는 연출만. 정답 코드를 읽어 보도록 권한다 (§2.6: 보상은 학습 행동에만)
 */
export function GoldenKeyCard({
  kind,
  questTitle,
  budget,
  onNext,
}: GoldenKeyCardProps) {
  return (
    <>
      <m.span
        {...popIn(budget, 0.08, { rotate: -40, scale: 0.7 })}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft"
        aria-hidden
      >
        <KeyRound className="h-7 w-7 text-accent-text" />
      </m.span>

      <h2 id="celebration-title" className="text-lg font-bold text-foreground">
        황금키로 문을 열었어요
      </h2>
      <p className="text-center text-sm leading-relaxed text-muted-foreground">
        {kind === 'project'
          ? `황금키의 도움으로 ${withObjectParticle(questTitle)} 끝까지 해냈어요. 정답 코드를 한 줄씩 살펴봐요!`
          : '정답 코드를 한 줄씩 읽어 보면 다음에는 혼자서도 열 수 있어요!'}
      </p>
      <p className="text-xs text-muted-foreground/80">
        황금키로 연 퀘스트는 XP와 뱃지 없이 완료돼요
      </p>

      <CelebrationCta onClick={onNext}>알겠어요</CelebrationCta>
    </>
  );
}
