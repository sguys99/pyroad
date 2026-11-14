import type { Stage, StageStatus, StageWithStatus } from '@/lib/types/database';

import { sortStages, type OrderedStage } from './stageOrder';
import type { WorldInfo } from './worlds';

interface QuestMinimal {
  id: string;
  order: number;
  /** 'quiz' 는 보너스라 잠금·클리어 계산에서 뺌 (§12-Q60). 없으면 코드 퀘스트로 봄 */
  quest_type?: string;
}

/** 스테이지 잠금·클리어에 드는 퀘스트인지. 퀴즈는 보너스 (SQL is_stage_unlocked 00026 과 같은 규칙) */
export const countsForClear = (q: { quest_type?: string }) =>
  q.quest_type !== 'quiz';

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
 * 서버 규칙 is_stage_unlocked(00012·00026·00046)와 같아야 합니다 (RLS 회귀 WD-5가 월드 간 잠금, BOSS-3이 "이미 간 곳은 열림" 확인).
 * 그 스테이지나 뒤 스테이지에 완료한 퀘스트가 있으면 앞 스테이지를 다 깨지 않았어도 열림 (보스가 새로 생긴 스테이지, 00046).
 * 월드의 첫 스테이지는 그 월드의 실력 확인 퀴즈에 합격했어도 열림 (`skillPassWorldIds`, 00052 · P10-03).
 * 황금키로 넘긴 퀘스트도 status 'completed' 라 완료로 셉니다 (별은 best_stars 그대로).
 * 퀴즈(quest_type 'quiz')는 보너스라 완료 수·총 수·클리어·firstIncompleteQuestId 에서 뺍니다 (00026, §12-Q60).
 * 별(stars·maxStars)은 모으는 수집 기록이라 퀴즈도 넣습니다 (퀴즈 별이 실제로 쌓이는 첫 유형).
 */
export function getStageStatuses(
  stages: StageWithQuests[],
  userProgress: ProgressMinimal[],
  /** 실력 확인 퀴즈에 합격한 월드 id (skill_check_attempts.passed, 00052). 그 월드의 첫 스테이지가 열림 */
  skillPassWorldIds: ReadonlySet<string> = new Set(),
): StageWithStatus[] {
  const sorted = sortStages(stages);
  const completedQuestIds = new Set(
    userProgress.filter((p) => p.status === 'completed').map((p) => p.quest_id),
  );
  const bestStars = new Map(
    userProgress.map((p) => [p.quest_id, p.best_stars ?? 0]),
  );

  // 00046: 이 스테이지나 뒤 스테이지에 완료한 퀘스트가 있으면 열림 (앞 스테이지에 보스가 새로 생겨도 잠기지 않게)
  const stageOfQuest = new Map(
    sorted.flatMap((s, i) => s.quests.map((q) => [q.id, i] as const)),
  );
  const reached = Math.max(
    -1,
    ...[...completedQuestIds].map((id) => stageOfQuest.get(id) ?? -1),
  );

  let prevStageCompleted = true;

  return sorted.map((stage, index) => {
    const sortedQuests = [...stage.quests].sort((a, b) => a.order - b.order);
    const required = sortedQuests.filter(countsForClear);
    const completedCount = required.filter((q) =>
      completedQuestIds.has(q.id),
    ).length;
    const allCompleted =
      completedCount === required.length && required.length > 0;

    const passedIn =
      skillPassWorldIds.has(stage.world_id) &&
      sorted[index - 1]?.world_id !== stage.world_id;

    let status: StageStatus;
    if (index === 0 || passedIn) {
      status = allCompleted ? 'completed' : 'in_progress';
    } else if (!prevStageCompleted && index > reached) {
      status = 'locked';
    } else {
      status = allCompleted ? 'completed' : 'in_progress';
    }

    const firstIncomplete = required.find((q) => !completedQuestIds.has(q.id));

    prevStageCompleted = allCompleted;

    return {
      ...stage,
      status,
      quests: sortedQuests,
      completedQuestCount: completedCount,
      totalQuestCount: required.length,
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
  /** 진행 중(in_progress) 스테이지 중 맨 뒤 것 (보통 하나, 보스가 새로 생긴 앞 스테이지가 함께 진행 중일 수 있음) */
  currentStage: StageWithStatus | null;
  /** 이어하기 대상: 현재 스테이지의 첫 미완료 퀘스트 (P5-10) */
  continueQuestId: string | null;
  /** 잠긴 월드의 실력 확인 퀴즈 진입점 (P10-03, `attachSkillChecks`). 없으면 퀴즈 없음·이미 열림 */
  skillCheck?: { triedToday: boolean } | null;
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
   * `/world` 가 보여 줄 월드 (Q50): 열린 월드 중 아직 클리어 안 한 가장 뒤 월드, 모두 클리어면 마지막으로 열린 월드.
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
  skillPassWorldIds?: ReadonlySet<string>,
): WorldsProgress {
  const all = getStageStatuses(stages, userProgress, skillPassWorldIds);
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
    // 가장 멀리 간 진행 중 스테이지 (보스가 새로 생긴 앞 스테이지도 진행 중일 수 있어 맨 뒤 것, 00046)
    const currentStage =
      own.findLast((s) => s.status === 'in_progress') ?? null;
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
    // 열린 월드가 여럿이면 가장 뒤 (실력 확인 퀴즈로 앞 월드를 건너뛴 학생은 새 월드가 지금 월드, P10-03)
    current:
      reachable.findLast((w) => w.status === 'open') ??
      reachable.at(-1) ??
      null,
    unlockedStageIds: all.filter((s) => s.status !== 'locked').map((s) => s.id),
  };
}
