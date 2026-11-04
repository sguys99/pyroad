import type { PromptSkeleton } from '@/lib/types/database';

/**
 * 퀘스트 유형 = 렌더러 종류 (§2.5). Quiz(Phase 7)·Boss(Phase 9)는 여기에 더하고
 * `src/components/quest/questRenderers.ts`에 렌더러를 등록한다.
 */
export type QuestKind = 'code' | 'project';

/**
 * 지금은 단계(steps)가 있으면 프로젝트. P1-08에서 생긴 `quests.quest_type`('quiz'·'boss' 포함)은
 * Quiz 렌더러(Phase 7)를 붙일 때 퀘스트 페이지 select에 넣고 이 함수가 먼저 보도록 바꾼다
 */
export function getQuestKind(
  skeleton: Pick<PromptSkeleton, 'steps'>,
): QuestKind {
  return skeleton.steps != null ? 'project' : 'code';
}
