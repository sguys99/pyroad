'use client';

import { useEffect, useState } from 'react';
import { m } from 'framer-motion';
import { sec } from '@/lib/motion/tokens';
import ReactMarkdown from 'react-markdown';
import { LottieCharacter } from '@/components/characters/LottieCharacter';
import type { MotionBudget } from '@/lib/motion/tier';
import type { StageClearInfo } from '@/lib/quest/rewards';
import { useTutor } from '@/lib/tutor/useTutor';
import { CelebrationCta, ConceptChips, Kicker } from './parts';
import { popIn } from './motion';

interface StageClearCardProps {
  stage: StageClearInfo;
  questId: string;
  budget: MotionBudget;
  onNext: () => void;
}

/**
 * 스테이지 클리어: 가장 큰 축하. 파이뱀 점프 + 큰 컨페티 + 파이뱀 선생님의 정리(AI) + 배운 개념.
 * 읽을 것이 많아 자동으로 넘기지 않는다. 정리가 오는 중에도 넘길 수 있다 (요청은 카드가 사라지면 취소됨).
 */
export function StageClearCard({
  stage,
  questId,
  budget,
  onNext,
}: StageClearCardProps) {
  const summary = useStageSummary(questId, stage.concepts);

  return (
    <>
      <LottieCharacter
        character="pybaem"
        animation="level-up"
        size={88}
        expression="celebrating"
      />

      <div className="flex flex-col items-center gap-0.5">
        <Kicker>스테이지 클리어!</Kicker>
        <m.h2
          id="celebration-title"
          {...popIn(budget, 0.12, { scale: 0.7, y: 6 })}
          className="text-3xl font-black text-primary-text"
        >
          Stage {stage.order} 완료!
        </m.h2>
        <p className="text-sm font-medium text-muted-foreground">
          {stage.title}
        </p>
      </div>

      <m.div
        {...popIn(budget, 0.25, { y: 8, scale: 0.98 })}
        className="max-h-40 w-full overflow-y-auto rounded-2xl bg-muted/60 p-3 text-left text-sm leading-relaxed"
        aria-live="polite"
      >
        {summary.text ? (
          <ReactMarkdown
            components={{
              p: ({ children }) => (
                <p className="mb-1.5 last:mb-0">{children}</p>
              ),
              strong: ({ children }) => (
                <strong className="font-bold text-primary-text">
                  {children}
                </strong>
              ),
            }}
          >
            {summary.text}
          </ReactMarkdown>
        ) : (
          <p className="text-muted-foreground">
            파이뱀 선생님이 정리하는 중...
          </p>
        )}
      </m.div>

      <ConceptChips
        concepts={stage.concepts}
        budget={budget}
        delay={sec('slow')}
      />

      <CelebrationCta onClick={onNext} wide>
        다음 모험으로!
      </CelebrationCta>
    </>
  );
}

/** 스테이지 정리 (AI 스트리밍, 실패하면 정해진 문장) */
function useStageSummary(questId: string, concepts: string[]) {
  const { sendTutorStreamRequest } = useTutor();
  const [text, setText] = useState('');
  // 배열 prop은 부모가 다시 그릴 때마다 새로 오므로 문자열로 비교 (요약을 다시 요청하지 않게)
  const conceptsText = concepts.join(', ');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await sendTutorStreamRequest(
          { type: 'stage_summary', quest_id: questId },
          (delta) => {
            if (!cancelled) setText(delta);
          },
        );
        // null: 축하 화면을 닫아 요청이 취소됨
        if (res && !cancelled) {
          setText(res.message);
        }
      } catch {
        if (!cancelled) {
          setText(
            `스테이지를 모두 완료했어요! ${conceptsText} 등의 개념을 배웠어요. 대단해요!`,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [questId, conceptsText, sendTutorStreamRequest]);

  return { text };
}
