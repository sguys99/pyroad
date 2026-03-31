export interface TutorRequest {
  type:
    | 'quest_intro'
    | 'hint_generator'
    | 'code_feedback'
    | 'encouragement';
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
}

export interface TutorResponse {
  message: string;
  is_fallback: boolean;
}

export interface ChatMessage {
  role: 'tutor' | 'system';
  content: string;
  isFallback?: boolean;
}
