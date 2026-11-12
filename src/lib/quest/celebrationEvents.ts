// 완료 응답(QuestCompleteResponse) → 축하 이벤트 목록 (P1-09, P1-10).
//
// 퀘스트 엔진(useQuestSession)은 "무엇을 축하할지"만 이 목록으로 내보내고, 어떻게 보여 줄지는
// 축하 시퀀서(`src/lib/celebration/plan.ts` + `QuestCelebrations`)가 정한다: 순서·묶음·자동 넘김·컨페티·효과음.
// 모두 "이번 요청에서 새로 일어난 일"만 담는다 (P1-03).

import type { AchievementInfo } from './achievements';
import type { QuestKind } from './questKind';
import { getLevelTitle } from './xp';
import { levelUpCoinsTotal, type LevelUpCoins } from './coins';
import {
  levelChanged,
  type QuestCompleteResponse,
  type StageClearInfo,
} from './rewards';

export type CelebrationEvent =
  | { type: 'stage_clear'; stage: StageClearInfo }
  | {
      type: 'project_complete';
      questTitle: string;
      xpGained: number;
      /** 프로젝트가 스테이지의 마지막 퀘스트였으면(7-1) 그 스테이지. 축하 하나로 같이 보여 준다 */
      stage: StageClearInfo | null;
    }
  /** 황금키로 연 퀘스트 (XP 0): 큰 축하 대신 가벼운 확인 */
  | { type: 'golden_key'; kind: QuestKind; questTitle: string }
  | {
      type: 'level_up';
      level: number;
      fromLevel: number;
      title: string;
      /** 지나간 레벨들에서 받은 코인 합 (P8-04, 레벨 업 카드에 보임). 이미 받은 레벨이면 0 */
      coins?: number;
    }
  /** 새로 얻은 업적 (P8-09). 카드에서 바로 "받기" */
  | { type: 'badge'; badge: AchievementInfo }
  // 쓰지 않는 자리: 별(P8-05)·퀘스트·별 코인은 결과 쪽 보상 띠(QuestSuccess)가 별 팝·"새 별 +N"으로, 레벨 업 코인은 레벨 업 카드가 보임
  | { type: 'star'; stars: 1 | 2 | 3; gained: number }
  | { type: 'coin'; amount: number }
  // 스테이지 보물상자 (§3 F11, P8-06): 월드맵 StageChest "열기" → 서버가 준 코인. 내용 공개형.
  // 출석 7일째 상자(P8-08)도 같은 카드: note 로 부제를 바꾸고 방패를 담음
  | {
      type: 'chest';
      stageTitle: string;
      /** 채운 별 목표 (예: 15) */
      goal: number;
      contents: { coins: number; goldenKeys: number; shields?: number };
      /** 부제 (없으면 "<스테이지>에서 별 N개를 모았어요") */
      note?: string;
    };

export type CelebrationEventType = CelebrationEvent['type'];

export interface CelebrationContext {
  kind: QuestKind;
  questTitle: string;
}

/**
 * 퀘스트 결과(황금키 확인 / 프로젝트 완성 / 스테이지 클리어) → 레벨 업 → 업적(정의 순서).
 * 보여 줄 순서는 시퀀서가 우선순위로 한 번 더 맞춘다 (`planCelebrations`).
 *
 * - 이미 완료한 퀘스트(already_completed)는 퀘스트 결과 카드 없음. 다시 풀기로 황금키 퀘스트를 처음 직접 풀었으면(P8-05)
 *   그때 받은 레벨 업·업적만 (복습 도전으로 얻은 업적도. 중복 요청은 둘 다 없어 빈 목록).
 * - 황금키를 쓴 퀘스트(DB의 used_golden_key, 프로젝트는 한 단계라도)는 XP가 0이라 "황금키로 열었어요" 확인만.
 *   스테이지를 클리어했으면 스테이지 클리어는 따로 축하한다(나머지 퀘스트는 스스로 풀었으므로).
 *   업적 지표는 직접 푼 것만 세므로(Q25) 이 퀘스트로 얻는 업적은 진행으로 세는 스테이지 클리어뿐이다 (00036).
 * - 프로젝트가 스테이지 마지막이면 프로젝트 완성 하나에 스테이지 클리어를 담는다 (같은 순간을 두 번 축하하지 않게).
 */
export function buildCelebrationEvents(
  completion: QuestCompleteResponse,
  { kind, questTitle }: CelebrationContext,
): CelebrationEvent[] {
  const events: CelebrationEvent[] = [];
  const stage = completion.stage_cleared;
  if (completion.already_completed) {
    // 다시 풀기 (P8-05): 퀘스트 결과 카드는 없고, 황금키 퀘스트의 첫 직접 풀이로 받은 레벨 업·업적만 아래에서
  } else if (completion.used_golden_key) {
    events.push({ type: 'golden_key', kind, questTitle });
    if (stage) events.push({ type: 'stage_clear', stage });
  } else if (kind === 'project') {
    events.push({
      type: 'project_complete',
      questTitle,
      xpGained: completion.xp_gained,
      stage,
    });
  } else if (stage) {
    events.push({ type: 'stage_clear', stage });
  }
  if (levelChanged(completion)) {
    events.push({
      type: 'level_up',
      level: completion.level_after,
      fromLevel: completion.level_before,
      title: getLevelTitle(completion.level_after),
      coins: levelUpCoinsTotal(completion.level_ups),
    });
  }
  events.push(...achievementEvents(completion.new_achievements));
  return events;
}

/** 새로 얻은 업적 → 축하 (P8-09 공용: 퀘스트·퀴즈·미션·출석·상자). 응답에 없으면(예전 DB) 빈 목록 */
export function achievementEvents(
  list: readonly AchievementInfo[] | null | undefined,
): CelebrationEvent[] {
  return (list ?? []).map((badge) => ({ type: 'badge', badge }));
}

/** 미션 받기 등 퀘스트 밖 보상 응답(level_before·level_after·level_ups) → 레벨 업 축하 (P8-08 공용). 안 올랐으면 빈 목록 */
export function levelUpEvents(res: {
  level_before: number;
  level_after: number;
  level_ups?: readonly LevelUpCoins[];
}): CelebrationEvent[] {
  if (res.level_after <= res.level_before) return [];
  return [
    {
      type: 'level_up',
      level: res.level_after,
      fromLevel: res.level_before,
      title: getLevelTitle(res.level_after),
      coins: levelUpCoinsTotal(res.level_ups),
    },
  ];
}
