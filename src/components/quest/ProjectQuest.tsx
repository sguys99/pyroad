'use client';

import Link from 'next/link';
import { worldPath } from '@/lib/world/worldBook';
import {
  useQuestSession,
  type QuestSessionOptions,
} from '@/lib/quest/useQuestSession';
import { QuestWorkspace } from './QuestWorkspace';
import { StepStrip } from './StepStrip';

/** 프로젝트 퀘스트 렌더러: 단계마다 코드를 쌓아 가며 통과하는 퀘스트 */
export function ProjectQuest(props: QuestSessionOptions) {
  const session = useQuestSession(props);
  const steps = session.steps ?? [];

  return (
    <QuestWorkspace
      session={session}
      notebookTop={
        <StepStrip
          goals={steps.map((s) => s.step_goal)}
          current={session.currentStep}
          cleared={session.stepCleared}
          completed={session.isCompleted}
          onSkip={session.skipStepBeat}
        />
      }
      completedBanner={
        <>
          프로젝트를 완성했어요!{' '}
          <Link
            href={worldPath(session.quest.stage.world?.slug)}
            className="underline"
          >
            월드맵으로 돌아가기
          </Link>
        </>
      }
    />
  );
}
