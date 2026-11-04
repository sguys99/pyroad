'use client';

import { memo, useCallback, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { CelebrationEvent } from '@/lib/quest/celebrationEvents';
import type { BadgeType } from '@/lib/quest/badges';
import { StageCompleteCelebration } from './celebrations/StageCompleteCelebration';
import { ProjectCompleteCelebration } from './celebrations/ProjectCompleteCelebration';
import { LevelUpCelebration } from './celebrations/LevelUpCelebration';
import { BadgeEarnedPopup } from './celebrations/BadgeEarnedPopup';

interface QuestCelebrationsProps {
  /** 아직 보여 주지 않은 축하 (useQuestSession.celebrations) */
  events: CelebrationEvent[];
  questId: string;
  /** 앞에서부터 count개를 보여 줬다 */
  onDismiss: (count: number) => void;
}

/**
 * 축하 이벤트 목록을 앞에서부터 하나씩 기존 축하 컴포넌트로 보여 준다 (P1-09).
 * 이어지는 뱃지는 BadgeEarnedPopup 하나로 묶는다(지금 화면과 같게).
 *
 * memo + 안정된 props(이벤트 배열은 보여 준 만큼 지울 때만 바뀜)라서 퀘스트 셸이 튜터 스트리밍 등으로
 * 다시 그려져도 오버레이는 다시 그려지지 않는다 (§2.10). P1-10 축하 시퀀서가 이 자리를 대신한다.
 */
export const QuestCelebrations = memo(function QuestCelebrations({
  events,
  questId,
  onDismiss,
}: QuestCelebrationsProps) {
  const head = events[0];

  const badges = useMemo(() => {
    const list: BadgeType[] = [];
    for (const event of events) {
      if (event.type !== 'badge') break;
      list.push(event.badge);
    }
    return list;
  }, [events]);

  const dismissHead = useCallback(() => onDismiss(1), [onDismiss]);
  const dismissBadges = useCallback(
    () => onDismiss(badges.length),
    [onDismiss, badges.length],
  );

  // 이벤트가 하나 지나갈 때마다 key가 바뀌어 이전 오버레이는 퇴장 연출, 다음 것은 등장
  const key = head ? `${events.length}-${head.type}` : undefined;

  return (
    <AnimatePresence>
      {head?.type === 'stage_clear' && (
        <StageCompleteCelebration
          key={key}
          stageTitle={head.stage.title}
          stageOrder={head.stage.order}
          concepts={head.stage.concepts}
          questId={questId}
          onClose={dismissHead}
        />
      )}
      {head?.type === 'project_complete' && (
        <ProjectCompleteCelebration
          key={key}
          earnedXP={head.xpGained}
          questName={head.questTitle}
          onClose={dismissHead}
        />
      )}
      {head?.type === 'level_up' && (
        <LevelUpCelebration
          key={key}
          newLevel={head.level}
          newTitle={head.title}
          onClose={dismissHead}
        />
      )}
      {head?.type === 'badge' && (
        <BadgeEarnedPopup key={key} badges={badges} onComplete={dismissBadges} />
      )}
    </AnimatePresence>
  );
});
