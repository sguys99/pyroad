import type { ComponentType } from 'react';
import type { QuestKind } from '@/lib/quest/questKind';
import type { QuestSessionOptions } from '@/lib/quest/useQuestSession';
import { CodeQuest } from './CodeQuest';
import { ProjectQuest } from './ProjectQuest';

/**
 * 퀘스트 유형별 렌더러 (§2.5). 모두 useQuestSession 위에서 화면만 그린다.
 * 확장 지점: Quiz(Phase 7)·Boss(Phase 9)는 QuestKind에 'quiz'·'boss'를 더하고 여기에 등록한다
 * (Record라서 등록을 빠뜨리면 tsc가 알려 줌).
 */
export const QUEST_RENDERERS: Record<
  QuestKind,
  ComponentType<QuestSessionOptions>
> = {
  code: CodeQuest,
  project: ProjectQuest,
};
