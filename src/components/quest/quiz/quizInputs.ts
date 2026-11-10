import type { QuizKind } from '@/lib/quest/questKind';
import { multipleChoiceInput } from './MultipleChoice';
import type { QuizInputDef } from './types';

/**
 * 퀴즈 종류 → 입력 컴포넌트 (P7-03, 공통 약속은 `./types.ts`). P7-04 빈칸·P7-05 순서·P7-06 버그 찾기가 여기에 등록한다.
 * 등록 전 종류는 틀이 "준비 중" 안내를 보여 줌
 */
export const QUIZ_INPUTS: { [K in QuizKind]?: QuizInputDef<K> } = {
  multiple_choice: multipleChoiceInput,
};
