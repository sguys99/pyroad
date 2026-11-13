import type { PromptSkeleton, QuestType } from '@/lib/types/database';

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
 * 퀘스트 유형 = 렌더러 종류 (§2.5). 새 유형은 여기에 더하고 `src/components/quest/questRenderers.ts`에 렌더러를 등록한다
 * (보스 배틀 P9-12 = 'boss').
 */
export type QuestKind = 'code' | 'project' | 'quiz' | 'boss';

/**
 * `quests.quest_type`(P1-08)이 'quiz'면 퀴즈(P7-03), 'boss'면 보스 배틀(P9-12), 아니면 단계(steps)가 있으면 프로젝트, 그 밖은 코드.
 * questType 을 모르는 곳(useQuestSession 등 코드 퀘스트 전용)은 빼고 불러도 됨
 */
export function getQuestKind(
  skeleton: Pick<PromptSkeleton, 'steps'>,
  questType?: QuestType | null,
): QuestKind {
  if (questType === 'quiz') return 'quiz';
  if (questType === 'boss') return 'boss';
  return skeleton.steps != null ? 'project' : 'code';
}
