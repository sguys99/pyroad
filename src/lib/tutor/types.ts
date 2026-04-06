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
  provider?: 'anthropic' | 'openai' | 'gemini';
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
}

export interface ChatMessage {
  role: 'tutor' | 'system';
  content: string;
  isFallback?: boolean;
}
