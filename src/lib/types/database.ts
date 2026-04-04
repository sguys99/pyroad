// DB 테이블 매핑 타입

export interface Stage {
  id: string;
  order: number;
  title: string;
  theme_name: string;
  description: string;
  is_final: boolean;
  created_at: string;
}

export interface Quest {
  id: string;
  stage_id: string;
  order: number;
  title: string;
  concept: string;
  prompt_skeleton: PromptSkeleton;
  validation_type: 'output_match' | 'contains' | 'code_check';
  expected_output: string;
  xp_reward: number;
  created_at: string;
}

export interface UserProgress {
  id: string;
  user_id: string;
  quest_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  hints_used: number;
  code_submitted: string;
  completed_at: string | null;
  created_at: string;
  current_step: number | null;
  step_submissions: Record<string, string> | null;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_type:
    | 'first_code'
    | 'hint_master'
    | 'stage_clear'
    | 'project_builder'
    | 'streak_3';
  earned_at: string;
}

export interface UserProfile {
  id: string;
  display_name: string;
  avatar_url: string;
  total_xp: number;
  current_level: number;
}

export interface ProjectStep {
  step_number: number;
  step_goal: string;
  starter_code: string;
  validation_type: 'output_match' | 'contains' | 'code_check';
  expected_output: string;
  hints: {
    level_1: string;
    level_2: string;
    level_3: string;
  };
  fallback_text: string;
}

export interface PromptSkeleton {
  topic: string;
  learning_goals: string[];
  story_context: string;
  exercise_description: string;
  starter_code: string;
  expected_output_hint: string;
  fallback_text: string;
  hints: {
    level_1: string;
    level_2: string;
    level_3: string;
  };
  steps?: ProjectStep[];
}

// 게시판 타입

export interface BoardPost {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface BoardComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface BoardPostWithAuthor extends BoardPost {
  user_profiles_public: { display_name: string; avatar_url: string | null };
  comment_count: number;
}

export interface BoardCommentWithAuthor extends BoardComment {
  user_profiles_public: { display_name: string; avatar_url: string | null };
}

// 월드맵 도메인 타입

export type StageStatus = 'locked' | 'in_progress' | 'completed';

export interface StageWithQuests extends Stage {
  quests: Quest[];
}

/** 서버 전용: expected_output 포함 */
export interface QuestWithStageServer extends Quest {
  stage: Pick<Stage, 'id' | 'title' | 'order' | 'theme_name'>;
}

/** 클라이언트에 전달되는 Quest (expected_output 제외) */
export type QuestClientSafe = Omit<Quest, 'expected_output'>;

export interface QuestWithStage extends QuestClientSafe {
  stage: Pick<Stage, 'id' | 'title' | 'order' | 'theme_name'>;
}

export interface StageWithStatus extends Stage {
  status: StageStatus;
  quests: Pick<Quest, 'id' | 'order'>[];
  completedQuestCount: number;
  totalQuestCount: number;
  firstIncompleteQuestId: string | null;
}
