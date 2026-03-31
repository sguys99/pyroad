import type {
  Quest,
  Stage,
  StageStatus,
  StageWithStatus,
  UserProgress,
} from '@/lib/types/database';

interface StageWithQuests extends Stage {
  quests: Quest[];
}

export function getStageStatuses(
  stages: StageWithQuests[],
  userProgress: UserProgress[],
): StageWithStatus[] {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  const completedQuestIds = new Set(
    userProgress
      .filter((p) => p.status === 'completed')
      .map((p) => p.quest_id),
  );

  let prevStageCompleted = true;

  return sorted.map((stage) => {
    const sortedQuests = [...stage.quests].sort((a, b) => a.order - b.order);
    const completedCount = sortedQuests.filter((q) =>
      completedQuestIds.has(q.id),
    ).length;
    const allCompleted =
      completedCount === sortedQuests.length && sortedQuests.length > 0;

    let status: StageStatus;
    if (stage.order === 1) {
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
