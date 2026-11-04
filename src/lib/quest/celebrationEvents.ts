// 완료 응답(QuestCompleteResponse) → 축하 이벤트 목록 (P1-09).
//
// 퀘스트 엔진(useQuestSession)은 "무엇을 축하할지"만 이 목록으로 내보내고, 어떻게 보여 줄지는
// 화면 쪽(지금은 QuestCelebrations, P1-10부터는 축하 시퀀서)이 정한다.
// 목록 순서가 보여 줄 순서다. 모두 "이번 요청에서 새로 일어난 일"만 담는다 (P1-03).

import type { BadgeType } from './badges';
import type { QuestKind } from './questKind';
import { getLevelTitle } from './xp';
import {
  levelChanged,
  type QuestCompleteResponse,
  type StageClearInfo,
} from './rewards';

export type CelebrationEvent =
  | { type: 'stage_clear'; stage: StageClearInfo }
  | { type: 'project_complete'; questTitle: string; xpGained: number }
  | { type: 'level_up'; level: number; title: string }
  | { type: 'badge'; badge: BadgeType };

export interface CelebrationContext {
  kind: QuestKind;
  questTitle: string;
}

/**
 * 축하 순서: (코드) 스테이지 클리어 / (프로젝트) 프로젝트 완성 → 레벨 업 → 뱃지(받은 순서).
 * 이미 완료한 퀘스트(already_completed)는 새로 받은 것이 없으므로 빈 목록.
 * 프로젝트는 지금 화면과 같게 스테이지 클리어를 따로 보여 주지 않는다 (P1-10에서 정함).
 */
export function buildCelebrationEvents(
  completion: QuestCompleteResponse,
  { kind, questTitle }: CelebrationContext,
): CelebrationEvent[] {
  if (completion.already_completed) return [];

  const events: CelebrationEvent[] = [];
  if (kind === 'project') {
    events.push({
      type: 'project_complete',
      questTitle,
      xpGained: completion.xp_gained,
    });
  } else if (completion.stage_cleared) {
    events.push({ type: 'stage_clear', stage: completion.stage_cleared });
  }
  if (levelChanged(completion)) {
    events.push({
      type: 'level_up',
      level: completion.level_after,
      title: getLevelTitle(completion.level_after),
    });
  }
  for (const badge of completion.new_badges) {
    events.push({ type: 'badge', badge });
  }
  return events;
}
