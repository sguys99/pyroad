export interface TutorRequest {
  type: 'quest_intro' | 'hint_generator';
  quest_id: string;
  student_code?: string;
  hint_level?: 1 | 2 | 3;
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
