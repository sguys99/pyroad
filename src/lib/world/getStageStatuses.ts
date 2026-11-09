import type { Stage, StageStatus, StageWithStatus } from '@/lib/types/database';

import { sortStages, type OrderedStage } from './stageOrder';
import type { WorldInfo } from './worlds';

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
  /** 없으면 0 (별 합계만 영향) */
  best_stars?: number;
}

/** 퀘스트 하나의 최대 별 (user_progress.best_stars 0~3, 00012) */
export const MAX_STARS_PER_QUEST = 3;

/**
 * 스테이지 잠금 상태. 순서는 (월드 order, 스테이지 order)이고 첫 스테이지는 항상 열림, 나머지는 바로 앞 스테이지의
 * 퀘스트를 모두 완료해야 열림 — 월드의 첫 스테이지는 이전 월드의 마지막 스테이지 기준 (P1-08).
 * 그래서 월드 해제 규칙 previous_world_cleared 도 이 순서로 나옵니다 (스테이지 없는 "준비 중" 월드는 건너뜀).
 * 서버 규칙 supabase/migrations/00012 의 is_stage_unlocked 와 같아야 합니다 (RLS 회귀 WD-5가 월드 간 잠금 확인).
 * 황금키로 넘긴 퀘스트도 status 'completed' 라 완료로 셉니다 (별은 best_stars 그대로).
 */
export function getStageStatuses(
  stages: StageWithQuests[],
  userProgress: ProgressMinimal[],
): StageWithStatus[] {
  const sorted = sortStages(stages);
  const completedQuestIds = new Set(
    userProgress.filter((p) => p.status === 'completed').map((p) => p.quest_id),
  );
  const bestStars = new Map(
    userProgress.map((p) => [p.quest_id, p.best_stars ?? 0]),
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
      firstIncompleteQuestId:
        firstIncomplete?.id ?? sortedQuests[0]?.id ?? null,
      stars: sortedQuests.reduce(
        (sum, q) => sum + (bestStars.get(q.id) ?? 0),
        0,
      ),
      maxStars: sortedQuests.length * MAX_STARS_PER_QUEST,
    };
  });
}

/** coming_soon: 스테이지 없음(준비 중) · locked: 첫 스테이지 잠김 · open: 진행 중 · cleared: 모든 스테이지 완료 */
export type WorldStatus = 'coming_soon' | 'locked' | 'open' | 'cleared';

export interface WorldWithStatus {
  world: WorldInfo;
  status: WorldStatus;
  /** 이 월드의 스테이지 (스테이지 order 순) */
  stages: StageWithStatus[];
  completedStageCount: number;
  completedQuestCount: number;
  totalQuestCount: number;
  stars: number;
  maxStars: number;
  /** 진행 중(in_progress) 스테이지. 순서 규칙상 전체에서 많아야 하나 */
  currentStage: StageWithStatus | null;
  /** 이어하기 대상: 현재 스테이지의 첫 미완료 퀘스트 (P5-10) */
  continueQuestId: string | null;
  /** 해제 조건 안내용. previousWorld 는 order 바로 앞 월드 */
  unlock: {
    rule: WorldInfo['unlock_rule'];
    previousWorld: Pick<WorldInfo, 'slug' | 'title'> | null;
    previousCleared: boolean;
  };
}

export interface WorldsProgress {
  worlds: WorldWithStatus[];
  /**
   * `/world` 가 보여 줄 월드 (Q50): 열린 월드 중 아직 클리어 안 한 첫 월드, 모두 클리어면 마지막으로 열린 월드.
   * 스테이지 있는 월드가 없으면 null
   */
  current: WorldWithStatus | null;
  /** 지금 열린(잠기지 않은) 스테이지 id. 새로 해제됨 판단(P5-05)은 저장해 둔 목록과 비교 */
  unlockedStageIds: string[];
}

/**
 * 월드 단위 상태 (P5-12). 스테이지 잠금은 모든 월드를 한 줄로 이어 getStageStatuses 로 계산한 뒤 월드별로 나눔
 * (서버 is_stage_unlocked 와 같은 결과). 스테이지는 world.order 로 월드에 붙임 (worlds."order" UNIQUE)
 */
export function getWorldStatuses(
  worlds: readonly WorldInfo[],
  stages: StageWithQuests[],
  userProgress: ProgressMinimal[],
): WorldsProgress {
  const all = getStageStatuses(stages, userProgress);
  const ordered = [...worlds].sort((a, b) => a.order - b.order);

  const result: WorldWithStatus[] = [];
  for (const world of ordered) {
    const own = all.filter(
      (s) => ((s as OrderedStage).world?.order ?? 0) === world.order,
    );
    const prev = result.at(-1) ?? null;
    const completedStageCount = own.filter(
      (s) => s.status === 'completed',
    ).length;
    const status: WorldStatus =
      own.length === 0
        ? 'coming_soon'
        : own[0].status === 'locked'
          ? 'locked'
          : completedStageCount === own.length
            ? 'cleared'
            : 'open';
    const currentStage = own.find((s) => s.status === 'in_progress') ?? null;
    const sum = (
      key: 'completedQuestCount' | 'totalQuestCount' | 'stars' | 'maxStars',
    ) => own.reduce((n, s) => n + s[key], 0);

    result.push({
      world,
      status,
      stages: own,
      completedStageCount,
      completedQuestCount: sum('completedQuestCount'),
      totalQuestCount: sum('totalQuestCount'),
      stars: sum('stars'),
      maxStars: sum('maxStars'),
      currentStage,
      continueQuestId: currentStage?.firstIncompleteQuestId ?? null,
      unlock: {
        rule: world.unlock_rule,
        previousWorld: prev
          ? { slug: prev.world.slug, title: prev.world.title }
          : null,
        previousCleared: prev?.status === 'cleared',
      },
    });
  }

  const reachable = result.filter(
    (w) => w.status === 'open' || w.status === 'cleared',
  );
  return {
    worlds: result,
    current:
      reachable.find((w) => w.status === 'open') ?? reachable.at(-1) ?? null,
    unlockedStageIds: all.filter((s) => s.status !== 'locked').map((s) => s.id),
  };
}
