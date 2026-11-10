// DB 테이블 매핑 타입
//
// 테이블 행 타입은 `database.generated.ts`(supabase gen types, `npm run db:types`로 재생성)에서
// 가져옵니다. 이 파일은 그 위의 얇은 래퍼로, 생성 타입이 표현하지 못하는 부분만 좁힙니다.
// - CHECK 제약 컬럼(text) → 문자열 리터럴 유니온 (validation_type, quest_type, quiz_kind, status, badge_type)
// - JSONB 컬럼(Json) → 앱이 쓰는 구조 (prompt_skeleton, step_submissions)
// 생성 파일은 직접 고치지 말고, 스키마를 바꾼 뒤 `npm run db:types`로 다시 만드세요.

import type { QuizKind } from '@/lib/content/schema';
import type { ValidationType } from '@/lib/quest/validation';
import type { BgmId } from '@/lib/sound/manifest';
import type { StageQuestDot } from '@/lib/quest/stageProgress';

import type { Tables } from './database.generated';

export type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from './database.generated';

// quests.validation_type CHECK (00012, P1-08): 프로젝트 단계·퀘스트 전체 규칙 모두 같은 다섯 가지
export type { ValidationType };

/** quests.quest_type CHECK (00012, P1-08) */
export type QuestType = 'code' | 'project' | 'quiz' | 'boss';

/**
 * quests.quiz_kind CHECK (00012). quest_type = 'quiz' 일 때만 값이 있음 (P7-01).
 * 퀴즈 공개 부분 타입은 콘텐츠 스키마(src/lib/content/schema.ts)에서 가져옴 (타입만, 번들에 안 들어감)
 */
export type {
  QuizKind,
  QuizPrompt,
  QuizPromptSkeleton,
} from '@/lib/content/schema';

/** worlds.unlock_rule (원본 스키마 src/lib/content/schema.ts WorldUnlockRuleSchema, §12-Q2·Q48) */
export interface WorldUnlockRule {
  type: 'open' | 'previous_world_cleared';
}

export type World = Omit<Tables<'worlds'>, 'unlock_rule'> & {
  unlock_rule: WorldUnlockRule;
};

export type Stage = Tables<'stages'>;

// expected_output 컬럼은 00005 이후 항상 '' (v0.4 운영 적용 뒤 다음 배포에서 삭제, docs/release/v0.4-runbook.md "적용 뒤 정리"). 정답은 quest_answer_keys에서
// `src/lib/quest/answerKeys.ts`로만 읽으므로 앱 타입에서는 뺍니다 (P1-02).
export type Quest = Omit<
  Tables<'quests'>,
  | 'prompt_skeleton'
  | 'validation_type'
  | 'expected_output'
  | 'quest_type'
  | 'quiz_kind'
> & {
  prompt_skeleton: PromptSkeleton;
  validation_type: ValidationType;
  quest_type: QuestType;
  quiz_kind: QuizKind | null;
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

/**
 * 내 화면의 프로필 (P3-13). 이름·아바타는 공개 프로필(닉네임 → 모험가NNNN, 파이뱀 스킨)에서.
 * `users.display_name`(옛 실명)·`avatar_url`(provider 사진)은 읽지 않음 — `src/lib/avatar/ownProfile.ts`
 */
export type { OwnProfile as UserProfile } from '@/lib/avatar/ownProfile';

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
  /** 해 볼 일 (P7-17). 콘텐츠 빌드 전 행에는 없을 수 있음 */
  checklist?: string[];
  /** 공개 예시 출력 (P7-17) */
  example_output?: string;
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
  /** 해 볼 일 (P7-17, 코드 퀘스트만. 프로젝트는 단계마다). 콘텐츠 빌드 전 행에는 없을 수 있음 */
  checklist?: string[];
  /** 공개 예시 출력 (P7-17, 코드 퀘스트만) */
  example_output?: string;
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

/** 다른 사용자에게 보이는 작성자 정보 (user_profiles_public: 닉네임 → 모험가NNNN + 파이뱀 스킨, 00018·00021. 실명·사진 없음) */
export interface BoardAuthor {
  display_name: string | null;
  /** 공개 아바타 스킨 id (NULL = 기본). 이전 응답·낙관적 갱신에서는 없을 수 있음 */
  avatar_skin?: string | null;
}

export interface BoardPostWithAuthor extends BoardPost {
  user_profiles_public: BoardAuthor | null;
  comment_count: number;
}

export interface BoardCommentWithAuthor extends BoardComment {
  user_profiles_public: BoardAuthor | null;
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
  stage: Pick<Stage, 'id' | 'world_id' | 'title' | 'order' | 'theme_name'>;
};

/** 클라이언트에 전달되는 Quest (정답 필드 없음) */
export type QuestClientSafe = Quest;

export type QuestWithStage = QuestClientSafe & {
  stage: Pick<Stage, 'id' | 'title' | 'order' | 'theme_name'> & {
    /** 이 퀘스트의 월드: 월드맵 복귀 링크가 그 월드 지도(`/world/<slug>`)로 (P5-01). 모르면 `/world` */
    /** bgm: 그 월드 map.yaml 곡 (P5-11, 퀘스트 헤더 BGM). 서버가 붙임, 지도 없는 월드면 null */
    /** no: 그림책 N권 (퀘스트 눈썹 "1권 · …", P6-01). 서버가 붙임 */
    world?: { slug: string; bgm?: BgmId | null; no?: number } | null;
    /** 헤더 진행 점(P6-02): 이 스테이지 퀘스트와 내 완료 여부. 서버가 붙임 */
    quests?: StageQuestDot[];
    /** 스테이지가 열려 있는지 (false = 잠긴 스테이지의 완료 퀘스트 복습, B38) */
    unlocked?: boolean;
  };
};

export interface StageWithStatus extends Stage {
  status: StageStatus;
  quests: Pick<Quest, 'id' | 'order'>[];
  completedQuestCount: number;
  totalQuestCount: number;
  firstIncompleteQuestId: string | null;
  /** user_progress.best_stars 합 (P5-12) */
  stars: number;
  /** 퀘스트 수 × 3 */
  maxStars: number;
}
