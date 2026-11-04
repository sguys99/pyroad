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

// expected_output 컬럼은 00005 이후 항상 '' (v0.4 운영 적용 뒤 다음 배포에서 삭제, docs/release/v0.4-runbook.md "적용 뒤 정리"). 정답은 quest_answer_keys에서
// `src/lib/quest/answerKeys.ts`로만 읽으므로 앱 타입에서는 뺍니다 (P1-02).
export type Quest = Omit<
  Tables<'quests'>,
  'prompt_skeleton' | 'validation_type' | 'expected_output'
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

export interface HintLevels {
  level_1: string;
  level_2: string;
  level_3: string;
}

// prompt_skeleton은 클라이언트에 그대로 내려가는 공개 부분만 담습니다.
// 정답(expected_output·hints·solution_code)은 quest_answer_keys에 있습니다 (P1-02, B07).
// ①(00004)만 적용된 DB에서는 quests에도 정답이 남아 있으므로, 페이지는 stripAnswerFields()로 지운 뒤 내려보냅니다.

/** 프로젝트 퀘스트 단계의 공개 부분 (quests.prompt_skeleton.steps[]) */
export interface ProjectStep {
  step_number: number;
  step_goal: string;
  starter_code: string;
  validation_type: ValidationType;
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
  steps?: ProjectStep[];
}

// 정답 타입 (서버 전용, quest_answer_keys)

/** quest_answer_keys.steps[]: 프로젝트 단계별 정답 */
export interface ProjectStepAnswer {
  step_number: number;
  expected_output: string;
  hints: HintLevels;
  solution_code?: string;
}

export type QuestAnswerKeyRow = Omit<
  Tables<'quest_answer_keys'>,
  'hints' | 'steps'
> & {
  hints: Partial<HintLevels>;
  steps: ProjectStepAnswer[];
};

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

/** 서버 라우트(튜터 등)가 읽는 퀘스트. 정답은 들어 있지 않음 (answerKeys.ts로 따로 읽음) */
export type QuestWithStageServer = Quest & {
  stage: Pick<Stage, 'id' | 'title' | 'order' | 'theme_name'>;
};

/** 클라이언트에 전달되는 Quest (정답 필드 없음) */
export type QuestClientSafe = Quest;

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
