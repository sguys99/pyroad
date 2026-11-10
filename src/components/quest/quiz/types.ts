import type { ComponentType } from 'react';
import type { QuizKind, QuizPrompt } from '@/lib/quest/questKind';

/**
 * 퀴즈 종류별 입력 컴포넌트의 공통 약속 (P7-03). P7-04~06(빈칸·순서·버그 찾기)은 이 모양으로 만들어
 * `quizInputs.ts` 의 QUIZ_INPUTS 에 한 줄 등록하면 QuizQuest 틀(문제 카드·정답 확인·결과·다시 풀기)에 그대로 붙는다.
 *
 * - 입력 컴포넌트는 화면만: 고른 값은 `onChange`로 올리고, 제출·채점·별·효과음은 useQuizSession 이 한다.
 * - `value`는 제출 정규형(content/README 퀴즈 절, QuizAnswerValue)과 같은 모양. 아직 다 안 골랐으면 null 또는 일부만 찬 값
 * - 보기 순서는 `quiz`에 온 그대로(서버가 섞음, 다시 풀면 새 quiz 로 바뀜). 위치가 아니라 id 로만 값을 만든다
 * - `disabled`: 채점 중·결과가 보이는 동안. 이때 `result`로 맞음/틀림/공개 정답을 아이콘 + 글자로 표시(색만으로 알리지 않음)
 * - `misses`: 이번 회차에 틀렸던 답들 (다시 풀 때 흐리게 보여 줄 수 있음)
 * - 문제 글(`quiz.question`)은 틀이 카드 머리에 그린다. 문제 코드 등 종류별 내용은 입력 컴포넌트가 그린다(`QuizCode`)
 */
export interface QuizValueMap {
  multiple_choice: string;
  fill_blank: Record<string, string>;
  parsons: string[] | { id: string; indent: number }[];
  bug_hunt: { line: string; fix: string };
}

export type QuizOf<K extends QuizKind> = Extract<QuizPrompt, { kind: K }>;

export interface QuizInputResult<V> {
  status: 'correct' | 'wrong' | 'revealed';
  /** 채점한 답 */
  submitted: V;
  /** revealed 일 때만: 서버가 공개한 정답 */
  answer: V | null;
}

export interface QuizInputProps<K extends QuizKind> {
  quiz: QuizOf<K>;
  value: QuizValueMap[K] | null;
  onChange: (value: QuizValueMap[K]) => void;
  disabled: boolean;
  result: QuizInputResult<QuizValueMap[K]> | null;
  misses: readonly QuizValueMap[K][];
  /** 문제 글 id (라디오 그룹 등의 aria-labelledby) */
  labelledBy: string;
}

export interface QuizInputDef<K extends QuizKind> {
  Input: ComponentType<QuizInputProps<K>>;
  /** "정답 확인"을 켤지: 제출할 만큼 다 골랐는지 */
  isComplete: (value: QuizValueMap[K] | null, quiz: QuizOf<K>) => boolean;
  /** 카드 머리 이름 (예: "객관식") */
  label: string;
}
