import type { FreeQuestionBlock } from './freeQuestion';

export type { LLMProviderType } from './providers/types';

export interface TutorRequest {
  type:
    | 'quest_intro'
    | 'hint_generator'
    | 'code_feedback'
    | 'encouragement'
    | 'project_guide'
    | 'stage_summary'
    /** "개념만 알려 줘요" (P6-10, §12-Q58): 퀘스트 데이터로만 만드는 개념 설명 */
    | 'concept_explain'
    /** 퀴즈 오답 뒤 "왜 틀렸어요?" (P7-08): 학생 답은 서버가 quiz_attempts 에서 읽음. 정답 미포함 */
    | 'quiz_explain'
    /** "파이뱀에게 물어보기" 자유 질문 (P9-17): 아이가 쓴 `question` 을 서버가 거른 뒤에만 LLM 에. 흘려 보내지 않음 */
    | 'free_question';
  quest_id: string;
  /** free_question 만: 아이가 쓴 질문 (FREE_QUESTION_MAX_LENGTH 자 이하) */
  question?: string;
  student_code?: string;
  hint_level?: 1 | 2 | 3;
  execution_result?: {
    stdout: string;
    stderr: string;
    passed: boolean;
  };
  earned_xp?: number;
  hints_used?: number;
  current_step?: number;
  total_steps?: number;
  previous_code?: string;
  step_goal?: string;
}

export interface TutorResponse {
  message: string;
  is_fallback: boolean;
  no_api_key?: boolean;
  provider_used?: string;
  /** free_question 을 서버가 걸렀음 (P9-17). message 는 아이용 안내이고 LLM 은 부르지 않음 */
  blocked?: FreeQuestionBlock;
  /** free_question: 오늘 더 물어볼 수 있는 수 (모르면 없음) */
  remaining?: number;
}

export interface ChatMessage {
  /** student = 아이가 "파이뱀에게 물어보기"에서 고른 질문 (P6-10, 오른쪽 말풍선) */
  role: 'tutor' | 'system' | 'student';
  content: string;
  isFallback?: boolean;
  /** 힌트 쪽지 (P6-09): 이야기 쪽 쪽지로 보이고 대화 기록에는 나오지 않음. system = 꺼내는 중 표시, tutor = 힌트 내용 */
  hint?: { level: number; step: number };
}
