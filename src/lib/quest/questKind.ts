import type { PromptSkeleton } from '@/lib/types/database';

/** 공개 퀴즈 타입 (P7-01). 정답 타입(QuizAnswer)은 서버 전용 `@/lib/quest/answerKeys` */
export type {
  QuizKind,
  QuizPrompt,
  QuizPromptSkeleton,
} from '@/lib/types/database';

/**
 * fill_blank 퀴즈 코드의 빈칸 표시 `{{빈칸 id}}` (P7-01). 렌더러는 `code.split(QUIZ_BLANK_RE)` 로
 * [글자, 빈칸 id, 글자, …] 를 얻음 (홀수 칸이 빈칸 id)
 */
export const QUIZ_BLANK_RE = /\{\{([^{}]+)\}\}/g;

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
