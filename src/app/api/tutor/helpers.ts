import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  FREE_TIER_PROVIDER,
  getAvailableProviders,
  resolveUserProvider,
} from '@/lib/tutor/providers/factory';
import {
  SYSTEM_PROMPT,
  buildQuestIntroPrompt,
  buildHintPrompt,
  buildCodeFeedbackPrompt,
  buildEncouragementPrompt,
  buildProjectGuidePrompt,
  buildStageSummaryPrompt,
} from '@/lib/tutor/prompts';
import {
  fetchAnswerKeyRow,
  hintFor,
  resolveAnswerKey,
  type QuestAnswerKey,
} from '@/lib/quest/answerKeys';
import { loadUserApiKeys } from '@/lib/tutor/apiKeys';
import type { TutorRequest, LLMProviderType } from '@/lib/tutor/types';
import type { QuestWithStageServer } from '@/lib/types/database';

const VALID_TYPES = [
  'quest_intro',
  'hint_generator',
  'code_feedback',
  'encouragement',
  'project_guide',
  'stage_summary',
] as const;
const VALID_HINT_LEVELS = [1, 2, 3] as const;
const MAX_CODE_LENGTH = 2000;
const MAX_OUTPUT_LENGTH = 2000;
const MAX_STEP_GOAL_LENGTH = 500;

// quest_intro, encouragement는 품질보다 속도 우선 → 경량 모델 사용
const FAST_TYPES = new Set(['quest_intro', 'encouragement', 'stage_summary']);

// 캐시 대상 타입은 src/lib/tutor/cache.ts의 buildCacheKey가 정한다 (개인화 입력이 없는 타입만)

// 정답(힌트 원문·expected_output)이 필요한 타입만 quest_answer_keys를 읽는다 (P1-02)
const ANSWER_KEY_TYPES = new Set(['hint_generator', 'code_feedback']);

export interface PreparedTutorCall {
  systemPrompt: string;
  userPrompt: string;
  providerType: LLMProviderType;
  customApiKey: string | undefined;
  hasAnyKey: boolean;
  fast: boolean;
  fallbackProviders: LLMProviderType[];
  quest: QuestWithStageServer;
  /** hint_generator·code_feedback에서만 채움. 서버 안에서만 쓰고 응답에 넣지 않음 */
  answerKey: QuestAnswerKey | null;
  body: TutorRequest;
}

function truncate(value: unknown, max: number): string | undefined {
  return typeof value === 'string' ? value.slice(0, max) : undefined;
}

function toBoundedInt(value: unknown, min: number, max: number): number | undefined {
  const n = Math.trunc(Number(value));
  if (value == null || !Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}

/**
 * 클라이언트 입력은 프롬프트에 그대로 들어가므로 허용된 필드만 남기고
 * 길이와 범위를 제한한다 (LLM 비용 남용 방지).
 */
export function sanitizeTutorBody(body: TutorRequest): TutorRequest {
  const er = body.execution_result;
  return {
    type: body.type,
    quest_id: String(body.quest_id),
    hint_level: body.hint_level,
    student_code: truncate(body.student_code, MAX_CODE_LENGTH),
    execution_result: er && {
      stdout: truncate(er.stdout, MAX_OUTPUT_LENGTH) ?? '',
      stderr: truncate(er.stderr, MAX_OUTPUT_LENGTH) ?? '',
      passed: er.passed === true,
    },
    earned_xp: toBoundedInt(body.earned_xp, 0, 10_000),
    hints_used: toBoundedInt(body.hints_used, 0, 100),
    current_step: toBoundedInt(body.current_step, 1, 50),
    total_steps: toBoundedInt(body.total_steps, 1, 50),
    previous_code: truncate(body.previous_code, MAX_CODE_LENGTH),
    step_goal: truncate(body.step_goal, MAX_STEP_GOAL_LENGTH),
  };
}

export async function prepareTutorCall(
  request: Request,
): Promise<PreparedTutorCall | Response> {
  // 1. Auth 검증
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Body 검증
  let body: TutorRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (
    !body.type ||
    !VALID_TYPES.includes(body.type as (typeof VALID_TYPES)[number])
  ) {
    return Response.json({ error: 'Invalid type' }, { status: 400 });
  }

  if (!body.quest_id) {
    return Response.json(
      { error: 'quest_id is required' },
      { status: 400 },
    );
  }

  if (body.type === 'hint_generator') {
    if (
      !body.hint_level ||
      !VALID_HINT_LEVELS.includes(body.hint_level as 1 | 2 | 3)
    ) {
      return Response.json(
        { error: 'hint_level (1, 2, or 3) is required for hint_generator' },
        { status: 400 },
      );
    }
  }

  body = sanitizeTutorBody(body);

  // (P1-19) 사용자별 rate limit은 여기에 둔다: 인증·입력 검증 뒤, DB 조회·캐시·LLM 호출 전.
  // 두 라우트(/api/tutor, /api/tutor/stream)가 모두 이 함수를 거치므로 한 곳에서 막을 수 있다.

  // 3. Quest + User Profile + 본인 API 키(B13, 서버에서만 복호화) (+ 정답) 병렬 조회
  const needsAnswerKey = ANSWER_KEY_TYPES.has(body.type);
  const [questResult, userProfileResult, userApiKeys, answerKeyRow] = await Promise.all([
    adminClient
      .from('quests')
      .select('*, stage:stages(id, title, order, theme_name)')
      .eq('id', body.quest_id)
      .single(),
    supabase
      .from('users')
      .select('preferred_provider')
      .eq('id', user.id)
      .single(),
    loadUserApiKeys(user.id),
    needsAnswerKey
      ? fetchAnswerKeyRow(adminClient, body.quest_id)
      : Promise.resolve(null),
  ]);

  const { data: quest } = questResult;
  const { data: userProfile } = userProfileResult;

  if (!quest) {
    return Response.json({ error: 'Quest not found' }, { status: 404 });
  }

  const q = quest as unknown as QuestWithStageServer;
  const skeleton = q.prompt_skeleton;
  // quests 행(expected_output·prompt_skeleton)은 quest_answer_keys가 없을 때의 폴백
  const answerKey = needsAnswerKey ? resolveAnswerKey(answerKeyRow, quest) : null;

  // 4. 추가 검증
  if (body.type === 'code_feedback' && !body.execution_result) {
    return Response.json(
      { error: 'execution_result is required for code_feedback' },
      { status: 400 },
    );
  }

  // 5. 프롬프트 조립
  let userPrompt: string;

  if (body.type === 'quest_intro') {
    userPrompt = buildQuestIntroPrompt({
      stageTitle: q.stage.title,
      themeName: q.stage.theme_name,
      questTitle: q.title,
      topic: skeleton.topic,
      learningGoals: skeleton.learning_goals,
      storyContext: skeleton.story_context,
      exerciseDescription: skeleton.exercise_description,
    });
  } else if (body.type === 'hint_generator') {
    const hintLevel = body.hint_level as 1 | 2 | 3;
    userPrompt = buildHintPrompt({
      topic: skeleton.topic,
      exerciseDescription: skeleton.exercise_description,
      studentCode: body.student_code || '',
      hintLevel,
      hintReference: answerKey ? hintFor(answerKey.hints, hintLevel) : '',
    });
  } else if (body.type === 'code_feedback') {
    const er = body.execution_result!;
    userPrompt = buildCodeFeedbackPrompt({
      topic: skeleton.topic,
      exerciseDescription: skeleton.exercise_description,
      studentCode: body.student_code || '',
      stdout: er.stdout,
      stderr: er.stderr,
      passed: er.passed,
      expectedOutput: answerKey?.expectedOutput ?? '',
    });
  } else if (body.type === 'encouragement') {
    userPrompt = buildEncouragementPrompt({
      questTitle: q.title,
      topic: skeleton.topic,
      earnedXP: body.earned_xp ?? 0,
      hintsUsed: body.hints_used ?? 0,
    });
  } else if (body.type === 'stage_summary') {
    // stage_summary: 동일 스테이지의 모든 퀘스트 concept를 수집
    const stageConceptsResult = await adminClient
      .from('quests')
      .select('concept')
      .eq('stage_id', q.stage.id)
      .order('"order"');
    const concepts = stageConceptsResult.data?.map((r) => r.concept) ?? [
      skeleton.topic,
    ];

    // 다음 스테이지 제목 조회
    const nextStageResult = await adminClient
      .from('stages')
      .select('title')
      .eq('order', q.stage.order + 1)
      .maybeSingle();

    userPrompt = buildStageSummaryPrompt({
      stageTitle: q.stage.title,
      stageOrder: q.stage.order,
      concepts,
      nextStageTitle: nextStageResult.data?.title ?? undefined,
    });
  } else {
    // project_guide
    userPrompt = buildProjectGuidePrompt({
      projectTitle: q.title,
      storyContext: skeleton.story_context,
      currentStep: body.current_step ?? 1,
      totalSteps: body.total_steps ?? 5,
      stepGoal: body.step_goal ?? '',
      previousCode: body.previous_code ?? '',
    });
  }

  // 6. Provider 결정 (서버의 유료 키는 사용하지 않음)
  // - 본인 키가 있는 사용자: 본인 키로 호출, 실패 시 무료 티어로만 폴백
  // - 그 외: 서버 무료 티어만 사용, 실패 시 rule-based fallback
  const { providerType, customApiKey } = resolveUserProvider(
    userProfile?.preferred_provider,
    userApiKeys.keys,
  );
  const fallbackProviders = customApiKey ? [FREE_TIER_PROVIDER] : [];

  const available = getAvailableProviders();
  const hasAnyKey = !!customApiKey || available.includes(FREE_TIER_PROVIDER);

  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    providerType,
    customApiKey,
    hasAnyKey,
    fast: FAST_TYPES.has(body.type),
    fallbackProviders,
    quest: q,
    answerKey,
    body,
  };
}

// ── Fallback 메시지 풀 ──────────────────────────────────────

type HintBucket = 'no_hints' | 'few_hints' | 'max_hints';
type XPBucket = 'standard' | 'high';

const PASSED_FEEDBACK_POOL: Record<HintBucket, string[]> = {
  no_hints: [
    '힌트 없이 혼자 풀다니 정말 대단해요! 🎉',
    '와, 스스로 해냈어요! 진짜 코딩 천재! ⭐',
    '힌트 도움 없이 정답! 실력이 쑥쑥 자라고 있어요! 🌱',
    '완벽해요! 혼자 힘으로 해결했네요! 💪',
  ],
  few_hints: [
    '잘했어요! 힌트를 잘 활용해서 정답을 찾았네요! 🎉',
    '정답이에요! 힌트가 도움이 됐죠? 👍',
    '멋져요! 힌트를 참고해서 풀어냈어요! 🌟',
  ],
  max_hints: [
    '정답이에요! 힌트를 따라 끝까지 해낸 게 중요해요! 🎉',
    '해냈어요! 포기하지 않은 게 최고예요! 💪',
    '잘했어요! 다음엔 힌트 없이도 할 수 있을 거예요! 🚀',
  ],
};

const ENCOURAGEMENT_POOL: Record<HintBucket, Record<XPBucket, string[]>> = {
  no_hints: {
    standard: [
      '퀘스트 완료! 힌트 없이 해내다니 대단해요! 🎉🐍',
      '{topic} 마스터! 혼자 풀었어요! ⭐🐍',
      '멋져요! 이 퀘스트를 힌트 없이 클리어! 🏆',
    ],
    high: [
      '보너스 XP까지! 힌트 없이 완벽하게 해냈어요! 🎉✨',
      '최고예요! {earned_xp}XP 획득! 진짜 코딩 마법사! 🧙‍♂️⭐',
      '{topic} 완벽 클리어! 보너스 점수까지! 🏆🐍',
    ],
  },
  few_hints: {
    standard: [
      '퀘스트 완료! 잘했어요! 🎉🐍',
      '{topic} 퀘스트를 클리어했어요! 다음 모험으로! 🌟',
      '축하해요! 한 걸음 더 성장했어요! 🐍💪',
    ],
    high: [
      '퀘스트 완료! {earned_xp}XP 획득! 🎉🐍',
      '잘했어요! 좋은 점수로 클리어! ⭐',
      '{topic} 퀘스트 클리어! 대단한 점수예요! 🏆',
    ],
  },
  max_hints: {
    standard: [
      '퀘스트 완료! 끝까지 해낸 게 최고예요! 🎉🐍',
      '잘했어요! 포기하지 않고 완료! 다음엔 더 잘할 수 있어요! 💪',
      '클리어! {topic}을 배웠어요! 🐍🌱',
    ],
    high: [
      '퀘스트 완료! {earned_xp}XP 획득! 다음엔 힌트를 줄여보세요! 🎉',
      '해냈어요! 점수도 좋아요! 🌟🐍',
      '클리어! 다음 퀘스트에서는 더 적은 힌트로 도전해봐요! 💪',
    ],
  },
};

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}

function getHintBucket(hintsUsed: number): HintBucket {
  if (hintsUsed === 0) return 'no_hints';
  if (hintsUsed <= 2) return 'few_hints';
  return 'max_hints';
}

// ── buildFallbackMessage ────────────────────────────────────

// 저장된 힌트도 읽지 못했을 때 (정답 데이터 누락)
const HINT_UNAVAILABLE_MESSAGE =
  '지금은 힌트를 가져오지 못했어요. 문제를 한 번 더 천천히 읽어 볼까요? 💡';

export function buildFallbackMessage(
  body: TutorRequest,
  quest: QuestWithStageServer,
  answerKey: QuestAnswerKey | null,
): string {
  const skeleton = quest.prompt_skeleton;

  if (body.type === 'quest_intro') {
    return skeleton.fallback_text;
  } else if (body.type === 'hint_generator') {
    const hintLevel = body.hint_level as 1 | 2 | 3;
    const hint = answerKey ? hintFor(answerKey.hints, hintLevel) : '';
    return hint || HINT_UNAVAILABLE_MESSAGE;
  } else if (body.type === 'code_feedback') {
    if (!body.execution_result?.passed) {
      return '앗, 조금 고쳐볼까요? 힌트를 사용해보세요! 💡';
    }
    return pickRandom(PASSED_FEEDBACK_POOL[getHintBucket(body.hints_used ?? 0)]);
  } else if (body.type === 'encouragement') {
    const hintBucket = getHintBucket(body.hints_used ?? 0);
    const xpBucket: XPBucket = (body.earned_xp ?? 0) >= 100 ? 'high' : 'standard';
    const template = pickRandom(ENCOURAGEMENT_POOL[hintBucket][xpBucket]);
    return interpolate(template, {
      topic: skeleton.topic,
      earned_xp: body.earned_xp ?? 0,
    });
  } else if (body.type === 'stage_summary') {
    return `🎉 스테이지를 모두 완료했어요! "${skeleton.topic}" 등의 개념을 배웠어요. 대단해요! 🐍`;
  } else {
    // project_guide
    const stepIdx = (body.current_step ?? 1) - 1;
    const steps = skeleton.steps;
    return steps && steps[stepIdx]
      ? steps[stepIdx].fallback_text
      : skeleton.fallback_text;
  }
}
