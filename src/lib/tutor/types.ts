export type { LLMProviderType } from './providers/types';

export interface TutorRequest {
  type:
    | 'quest_intro'
    | 'hint_generator'
    | 'code_feedback'
    | 'encouragement'
    | 'project_guide'
    | 'stage_summary';
  quest_id: string;
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
}

export interface ChatMessage {
  role: 'tutor' | 'system';
  content: string;
  isFallback?: boolean;
  /** 힌트 쪽지 (P6-09): 이야기 쪽 쪽지로 보이고 대화 기록에는 나오지 않음. system = 꺼내는 중 표시, tutor = 힌트 내용 */
  hint?: { level: number; step: number };
}
