// DB 테이블 매핑 타입
//
// 테이블 행 타입은 `database.generated.ts`(supabase gen types, `npm run db:types`로 재생성)에서
// 가져옵니다. 이 파일은 그 위의 얇은 래퍼로, 생성 타입이 표현하지 못하는 부분만 좁힙니다.
// - CHECK 제약 컬럼(text) → 문자열 리터럴 유니온 (validation_type, status, badge_type)
// - JSONB 컬럼(Json) → 앱이 쓰는 구조 (prompt_skeleton, step_submissions)
// 생성 파일은 직접 고치지 말고, 스키마를 바꾼 뒤 `npm run db:types`로 다시 만드세요.

import type { Tables } from './database.generated';

export type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from './database.generated';

export type ValidationType = 'output_match' | 'contains' | 'code_check';

export type Stage = Tables<'stages'>;

export type Quest = Omit<
  Tables<'quests'>,
  'prompt_skeleton' | 'validation_type'
> & {
  prompt_skeleton: PromptSkeleton;
  validation_type: ValidationType;
};

export type UserProgress = Omit<
  Tables<'user_progress'>,
  'status' | 'step_submissions'
> & {
  status: 'not_started' | 'in_progress' | 'completed';
  step_submissions: Record<string, string> | null;
};

export type UserBadge = Omit<Tables<'user_badges'>, 'badge_type'> & {
  badge_type:
    | 'first_code'
    | 'hint_master'
    | 'stage_clear'
    | 'project_builder'
    | 'streak_3';
};

export type UserProfile = Pick<
  Tables<'users'>,
  'id' | 'display_name' | 'avatar_url' | 'total_xp' | 'current_level'
>;

export interface ProjectStep {
  step_number: number;
  step_goal: string;
  starter_code: string;
  validation_type: ValidationType;
  expected_output: string;
  hints: {
    level_1: string;
    level_2: string;
    level_3: string;
  };
  fallback_text: string;
  solution_code?: string;
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
  solution_code?: string;
  steps?: ProjectStep[];
}

// 게시판 타입

export type BoardPost = Tables<'board_posts'>;

export type BoardComment = Tables<'board_comments'>;

export interface BoardPostWithAuthor extends BoardPost {
  user_profiles_public: { display_name: string; avatar_url: string | null };
  comment_count: number;
}

export interface BoardCommentWithAuthor extends BoardComment {
  user_profiles_public: { display_name: string; avatar_url: string | null };
}

// 공지사항 타입

export type Notice = Tables<'notices'>;

// 월드맵 도메인 타입

export type StageStatus = 'locked' | 'in_progress' | 'completed';

export interface StageWithQuests extends Stage {
  quests: Quest[];
}

/** 서버 전용: expected_output 포함 */
export type QuestWithStageServer = Quest & {
  stage: Pick<Stage, 'id' | 'title' | 'order' | 'theme_name'>;
};

/** 클라이언트에 전달되는 Quest (expected_output 제외) */
export type QuestClientSafe = Omit<Quest, 'expected_output'>;

export type QuestWithStage = QuestClientSafe & {
  stage: Pick<Stage, 'id' | 'title' | 'order' | 'theme_name'>;
};

export interface StageWithStatus extends Stage {
  status: StageStatus;
  quests: Pick<Quest, 'id' | 'order'>[];
  completedQuestCount: number;
  totalQuestCount: number;
  firstIncompleteQuestId: string | null;
}
