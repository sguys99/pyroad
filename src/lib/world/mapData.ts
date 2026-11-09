/**
 * 월드맵 데이터의 형태 변환 (P5-13). 조회는 `loadWorldMapData.ts`(서버 전용), 여기는 순수 함수라 단위 테스트한다.
 * 퀘스트는 목록에 보일 공개 열만 받는다 — 정답·힌트·solution_code(`quest_answer_keys`, service_role 전용)는 여기 오지 않음.
 */
import {
  toOwnProfile,
  type OwnProfile,
  type OwnProfileRow,
} from '@/lib/avatar/ownProfile';
import type { UserBadge } from '@/lib/types/database';

import { getWorldStatuses, type WorldsProgress } from './getStageStatuses';
import type { WorldInfo } from './worlds';

/** 스테이지 시트(P5-06)가 보여 줄 퀘스트 열 (DB 조회 그대로라 quest_type 은 string) */
export interface QuestListRow {
  id: string;
  order: number;
  title: string;
  quest_type: string;
  is_mobile_friendly: boolean;
}

export type StageRow = Parameters<typeof getWorldStatuses>[1][number] & {
  quests: QuestListRow[];
};

export interface ProgressRow {
  user_id: string;
  quest_id: string;
  status: string;
  best_stars: number;
  completed_at: string | null;
  /** 황금키로 완료 → 스트릭에서 뺀다 (3일 뱃지와 같은 규칙, Q25) */
  used_golden_key: boolean;
}

export interface BadgeRow {
  user_id: string;
  badge_type: string;
  earned_at: string;
}

/** 스테이지 시트의 퀘스트 한 줄: 공개 열 + 내 진행 (진행이 없으면 status null, 별 0) */
export interface StageQuestItem extends QuestListRow {
  status: string | null;
  best_stars: number;
}

export interface WorldMapData {
  /** HUD(P5-07): 닉네임·아바타·레벨·XP */
  profile: OwnProfile | null;
  badges: Pick<UserBadge, 'badge_type' | 'earned_at'>[];
  /** 월드·스테이지 상태, 현재 월드, 이어하기, 열린 스테이지 (P5-12) */
  progress: WorldsProgress;
  /** 스테이지 id → 퀘스트 목록 (order 순, P5-06 바텀시트) */
  questsByStage: Record<string, StageQuestItem[]>;
  /** 직접 푼(황금키 아님) 완료 시각들. HUD 스트릭(P5-07, `src/lib/time/streak.ts`)이 KST 날짜로 센다 */
  completedAt: string[];
  /** 서버가 커스텀 키를 받을 수 있는데 등록한 키가 없음 */
  showApiKeyAlert: boolean;
  // P5-05 잠금 해제 본 기록(Q49)은 테이블이 생기면 여기에 더한다 (progress.unlockedStageIds 와 비교)
}

export interface WorldMapRaw {
  stages: StageRow[];
  progress: ProgressRow[];
  profile: OwnProfileRow | null;
  badges: BadgeRow[];
  /** loadUserApiKeys 결과 (조회 못 했으면 null → 안내 안 띄움) */
  apiKeys: { enabled: boolean; keys: object } | null;
}

export function toWorldMapData(
  userId: string,
  raw: WorldMapRaw,
  worlds: readonly WorldInfo[],
): WorldMapData {
  // 사용자 행은 RLS(본인만)로 걸러 오지만, 정책이 넓어져도 남의 행이 섞이지 않게 확인한 id 로 한 번 더 거른다
  const progress = raw.progress.filter((p) => p.user_id === userId);
  const mine = new Map(progress.map((p) => [p.quest_id, p]));

  const questsByStage: Record<string, StageQuestItem[]> = {};
  for (const stage of raw.stages) {
    questsByStage[stage.id] = [...stage.quests]
      .sort((a, b) => a.order - b.order)
      .map((q) => ({
        id: q.id,
        order: q.order,
        title: q.title,
        quest_type: q.quest_type,
        is_mobile_friendly: q.is_mobile_friendly,
        status: mine.get(q.id)?.status ?? null,
        best_stars: mine.get(q.id)?.best_stars ?? 0,
      }));
  }

  return {
    profile:
      raw.profile && raw.profile.id === userId
        ? toOwnProfile(raw.profile)
        : null,
    badges: raw.badges
      .filter((b) => b.user_id === userId)
      .map(({ badge_type, earned_at }) => ({
        badge_type: badge_type as UserBadge['badge_type'],
        earned_at,
      })),
    progress: getWorldStatuses(worlds, raw.stages, progress),
    questsByStage,
    completedAt: progress.flatMap((p) =>
      p.status === 'completed' && p.completed_at && !p.used_golden_key
        ? [p.completed_at]
        : [],
    ),
    // 사용자 커스텀 키 유무만 본다 (서버 기본 키는 무시)
    showApiKeyAlert:
      !!raw.apiKeys?.enabled && Object.keys(raw.apiKeys.keys).length === 0,
  };
}
