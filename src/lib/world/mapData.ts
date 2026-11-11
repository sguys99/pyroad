/**
 * 월드맵 데이터의 형태 변환 (P5-13). 조회는 `loadWorldMapData.ts`(서버 전용), 여기는 순수 함수라 단위 테스트한다.
 * 퀘스트는 목록에 보일 공개 열만 받는다 — 정답·힌트·solution_code(`quest_answer_keys`, service_role 전용)는 여기 오지 않음.
 */
import {
  toOwnProfile,
  type OwnProfile,
  type OwnProfileRow,
} from '@/lib/avatar/ownProfile';

import {
  dailyQuizResults,
  pickDailyQuizzes,
  type DailyQuizState,
  type QuizAttemptRow,
} from '@/lib/quest/dailyQuiz';
import { kstToday } from '@/lib/time/kst';

import { getWorldStatuses, type WorldsProgress } from './getStageStatuses';
import { planUnlocks, type UnlockPlan } from './unlockSeen';
import type { WorldInfo } from './worlds';

/** 스테이지 시트(P5-06)가 보여 줄 퀘스트 열 (DB 조회 그대로라 quest_type 은 string) */
export interface QuestListRow {
  id: string;
  order: number;
  title: string;
  /** 이 퀘스트가 다루는 개념 한 줄 (공개 열, 시트 미리 보기) */
  concept: string;
  quest_type: string;
  /** 퀴즈 종류 (퀴즈만, 공개 열). 시트 아이콘·폰 퀴즈 추천(P7-11) */
  quiz_kind: string | null;
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
  /** 퀴즈 마지막 별 판정일 (KST 'YYYY-MM-DD', 00026). 같은 날 다시 풀면 연습이라 복습 추천에서 뺀다 (P7-10) */
  stars_judged_on?: string | null;
  /** 황금키로 완료 → 스트릭에서 뺀다 (3일 뱃지와 같은 규칙, Q25) */
  used_golden_key: boolean;
  /** 행이 생긴 때 = 그 퀘스트에서 처음 코드를 고친 때(자동 저장). 이어하기가 "가장 최근에 시작한 퀘스트"를 고른다 */
  created_at: string;
}

/** 스테이지 시트의 퀘스트 한 줄: 공개 열 + 내 진행 (진행이 없으면 status null, 별 0) */
export interface StageQuestItem extends QuestListRow {
  status: string | null;
  best_stars: number;
  /** 퀴즈 마지막 별 판정일 (P7-10, 없으면 판정 전) */
  stars_judged_on?: string | null;
  /** 처음 완료한 때 (오늘의 퀴즈가 "오늘 아침 칸"을 되짚을 때) */
  completed_at?: string | null;
}

export interface WorldMapData {
  /** HUD(P5-07): 닉네임·아바타·레벨·XP */
  profile: OwnProfile | null;
  /** 월드·스테이지 상태, 현재 월드, 이어하기, 열린 스테이지 (P5-12) */
  progress: WorldsProgress;
  /** 스테이지 id → 퀘스트 목록 (order 순, P5-06 바텀시트) */
  questsByStage: Record<string, StageQuestItem[]>;
  /** 직접 푼(황금키 아님) 완료 시각들. HUD 스트릭(P5-07, `src/lib/time/streak.ts`)이 KST 날짜로 센다 */
  completedAt: string[];
  /** 이어하기 CTA 대상 (P5-10). 열린 퀘스트를 다 깼으면 null */
  continueTarget: ContinueTarget | null;
  /** 서버가 커스텀 키를 받을 수 있는데 등록한 키가 없음 */
  showApiKeyAlert: boolean;
  /** 잠금 해제 연출 (P5-05, Q49): 본 기록과 지금 열린 스테이지 비교. 본 기록을 못 읽었으면 null (연출·기록 없음) */
  unlocks: UnlockPlan | null;
  /** 오늘의 퀴즈 (P7-10): 오늘 고른 문제와 끝난 문제 */
  daily: DailyQuizState;
}

/** 이어하기 CTA (P5-10) */
export interface ContinueTarget {
  questId: string;
  questTitle: string;
  stageOrder: number;
  stageTitle: string;
  /** recent: 가장 최근에 시작한 미완료 퀘스트 · next: 다음 차례 · start: 진행이 하나도 없음("모험 시작하기") */
  kind: 'recent' | 'next' | 'start';
}

/**
 * "지난번에 하던 퀘스트" (P5-10): 열린 스테이지의 미완료 퀘스트 중 진행 행이 가장 늦게 생긴 것, 없으면 다음 차례
 * (현재 스테이지의 첫 미완료 `continueQuestId`). 잠긴 스테이지 퀘스트는 고르지 않는다(퀘스트 페이지 가드 B38과 같은 판정).
 * shortcut: user_progress 에 updated_at 이 없어 "마지막으로 손댄"이 아니라 "마지막으로 시작한" 퀘스트다. 정확히 하려면 updated_at 열 + 트리거
 */
export function pickContinue(
  progress: WorldsProgress,
  rows: readonly ProgressRow[],
  questsByStage: Record<string, StageQuestItem[]>,
): ContinueTarget | null {
  const stageOf = new Map(
    progress.worlds
      .flatMap((w) => w.stages)
      .filter((s) => s.status !== 'locked')
      .flatMap((s) =>
        (questsByStage[s.id] ?? []).map((q) => [q.id, s] as const),
      ),
  );
  const recent = rows
    .filter((r) => r.status !== 'completed' && stageOf.has(r.quest_id))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  const questId = recent?.quest_id ?? progress.current?.continueQuestId;
  const stage = questId ? stageOf.get(questId) : undefined;
  const quest = stage && questsByStage[stage.id].find((q) => q.id === questId);
  if (!stage || !quest) return null;
  return {
    questId: quest.id,
    questTitle: quest.title,
    stageOrder: stage.order,
    stageTitle: stage.title,
    kind: recent ? 'recent' : rows.length === 0 ? 'start' : 'next',
  };
}

export interface WorldMapRaw {
  stages: StageRow[];
  progress: ProgressRow[];
  profile: OwnProfileRow | null;
  /** loadUserApiKeys 결과 (조회 못 했으면 null → 안내 안 띄움) */
  apiKeys: { enabled: boolean; keys: object } | null;
  /** user_seen_unlocks 본인 행 (P5-05). 조회 실패(00025 전 DB 등)면 null */
  seen: Array<{ user_id: string; stage_id: string }> | null;
  /** 오늘(KST) 본인 퀴즈 시도 (P7-10, 오늘의 퀴즈 완료 계산). 없으면 끝난 문제 없음 */
  attempts?: QuizAttemptRow[] | null;
  /** 연 보물상자 (P8-06): 본인 coin_ledger chest 행, ref = stage_id. 못 읽었으면 없음(모두 안 연 것) */
  chests?: Array<{ user_id: string; ref: string }> | null;
  /** 오늘 저장한 오늘의 퀴즈 목록 (P8-07 `user_daily_missions.quiz_ids`, §12-Q61). 있으면 그 문제로 고정 */
  dailyQuizIds?: string[] | null;
}

export function toWorldMapData(
  userId: string,
  raw: WorldMapRaw,
  worlds: readonly WorldInfo[],
  today: string = kstToday(),
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
        concept: q.concept,
        quest_type: q.quest_type,
        quiz_kind: q.quiz_kind,
        is_mobile_friendly: q.is_mobile_friendly,
        status: mine.get(q.id)?.status ?? null,
        best_stars: mine.get(q.id)?.best_stars ?? 0,
        stars_judged_on: mine.get(q.id)?.stars_judged_on ?? null,
        completed_at: mine.get(q.id)?.completed_at ?? null,
      }));
  }

  const worldsProgress = getWorldStatuses(worlds, raw.stages, progress);
  const opened = new Set(
    (raw.chests ?? []).filter((c) => c.user_id === userId).map((c) => c.ref),
  );
  for (const w of worldsProgress.worlds)
    for (const s of w.stages) s.chestOpened = opened.has(s.id);
  const picks = pickDailyQuizzes({
    userId,
    today,
    stages: worldsProgress.worlds.flatMap((w) => w.stages),
    questsByStage,
    fixed: raw.dailyQuizIds,
  });
  return {
    profile:
      raw.profile && raw.profile.id === userId
        ? toOwnProfile(raw.profile)
        : null,
    progress: worldsProgress,
    questsByStage,
    continueTarget: pickContinue(worldsProgress, progress, questsByStage),
    completedAt: progress.flatMap((p) =>
      p.status === 'completed' && p.completed_at && !p.used_golden_key
        ? [p.completed_at]
        : [],
    ),
    unlocks: planUnlocks(
      worldsProgress.unlockedStageIds,
      raw.seen &&
        raw.seen.filter((r) => r.user_id === userId).map((r) => r.stage_id),
    ),
    daily: {
      today,
      picks,
      results: dailyQuizResults(
        picks.map((p) => p.questId),
        (raw.attempts ?? []).filter((a) => a.user_id === userId),
        today,
      ),
    },
    // 사용자 커스텀 키 유무만 본다 (서버 기본 키는 무시)
    showApiKeyAlert:
      !!raw.apiKeys?.enabled && Object.keys(raw.apiKeys.keys).length === 0,
  };
}
