import type {
  Stage,
  StageStatus,
  StageWithStatus,
} from '@/lib/types/database';

import { sortStages, type OrderedStage } from './stageOrder';

interface QuestMinimal {
  id: string;
  order: number;
}

interface StageWithQuests extends Stage, OrderedStage {
  quests: QuestMinimal[];
}

interface ProgressMinimal {
  quest_id: string;
  status: string;
}

/**
 * 스테이지 잠금 상태. 순서는 (월드 order, 스테이지 order)이고 첫 스테이지는 항상 열림, 나머지는 바로 앞 스테이지의
 * 퀘스트를 모두 완료해야 열림 — 월드의 첫 스테이지는 이전 월드의 마지막 스테이지 기준 (P1-08).
 * 서버 규칙 supabase/migrations/00012 의 is_stage_unlocked 와 같아야 합니다 (월드 해제 규칙 §12-Q2 는 Phase 10).
 */
export function getStageStatuses(
  stages: StageWithQuests[],
  userProgress: ProgressMinimal[],
): StageWithStatus[] {
  const sorted = sortStages(stages);
  const completedQuestIds = new Set(
    userProgress
      .filter((p) => p.status === 'completed')
      .map((p) => p.quest_id),
  );

  let prevStageCompleted = true;

  return sorted.map((stage, index) => {
    const sortedQuests = [...stage.quests].sort((a, b) => a.order - b.order);
    const completedCount = sortedQuests.filter((q) =>
      completedQuestIds.has(q.id),
    ).length;
    const allCompleted =
      completedCount === sortedQuests.length && sortedQuests.length > 0;

    let status: StageStatus;
    if (index === 0) {
      status = allCompleted ? 'completed' : 'in_progress';
    } else if (!prevStageCompleted) {
      status = 'locked';
    } else {
      status = allCompleted ? 'completed' : 'in_progress';
    }

    const firstIncomplete = sortedQuests.find(
      (q) => !completedQuestIds.has(q.id),
    );

    prevStageCompleted = allCompleted;

    return {
      ...stage,
      status,
      quests: sortedQuests,
      completedQuestCount: completedCount,
      totalQuestCount: sortedQuests.length,
      firstIncompleteQuestId: firstIncomplete?.id ?? sortedQuests[0]?.id ?? null,
    };
  });
}
