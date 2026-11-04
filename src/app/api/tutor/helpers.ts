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
import {
  consumeTutorQuota,
  getTutorRateLimit,
  rateLimitedResponse,
} from '@/lib/tutor/rateLimit';
import {
  reportTutorAbuse,
  safeQuestId,
  type TutorAbuseLevel,
  type TutorAbuseReason,
} from '@/lib/tutor/abuse';
import { consumeServerKeyBudget } from '@/lib/tutor/globalBudget';
import { captureServerError } from '@/lib/observability/server';
import { checkStageUnlocked } from '@/lib/world/checkStageUnlocked';
import { STAGE_LOCKED_MESSAGE } from '@/lib/world/stageLock';
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
// 요청 본문 상한. 위 길이 제한(자르기)보다 훨씬 큰 본문은 파싱하지 않고 거부한다 (P1-19).
// 우리 화면은 코드 전체 + 출력(화면 상한 5,000자)을 보내므로 아이가 아주 긴 코드를 붙여 넣어도 이보다 작다
const MAX_BODY_BYTES = 64 * 1024;
// 우리 클라이언트가 보낼 수 있는 출력 길이 (src/lib/pyodide/constants.ts MAX_OUTPUT_LENGTH 5,000 + "잘렸어요" 안내).
// 서버는 MAX_OUTPUT_LENGTH(2,000)로 자르지만, 이보다 길면 우리 화면이 만든 요청이 아님
const CLIENT_MAX_OUTPUT_LENGTH = 5_100;
// 한도 초과가 이만큼 반복되면 경고(Sentry)로 올린다. useTutor 는 429 를 받으면 그 유형을 Retry-After 동안 보내지 않으므로
// 정상 화면에서는 분 창마다 1~2번(탭 여러 개)이 고작이다
const REPEAT_DENIED_PER_MINUTE = 5;
const REPEAT_DENIED_PER_DAY = 100;

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
  /**
   * hint_generator에서만 채움: 힌트 내용을 보내기 시작할 때 한 번 불러 `user_progress.hints_used`를 기록한다
   * (P1-04, B05). 클라이언트는 hints_used를 쓰지 않는다. 실패해도 던지지 않음(힌트는 그대로 보냄)
   */
  recordHint: (() => Promise<void>) | null;
  /** 서버 키로 provider 를 부르기 직전에 전역 예산을 1 차감한다 (P1-22). callTutor·callTutorStream 의 `allowServerKey` */
  allowServerKey: (provider: LLMProviderType) => Promise<boolean>;
}

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * 힌트 사용 기록 (`record_hint` RPC, service_role 전용, 00010).
 * 코드 퀘스트는 받은 가장 높은 단계, 프로젝트 퀘스트는 누적 횟수를 DB가 정한다.
 * 기록에 실패해도 아이에게는 힌트를 보여 준다 (드문 DB 오류로 힌트를 막지 않음). 실패는 로그·Sentry로 남긴다.
 */
export async function recordHintUsage(
  admin: AdminClient,
  userId: string,
  questId: string,
  level: 1 | 2 | 3,
): Promise<void> {
  try {
    const { error } = await admin.rpc('record_hint', {
      p_user_id: userId,
      p_quest_id: questId,
      p_level: level,
    });
    if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
  } catch (error) {
    console.error(
      '[tutor] record_hint 실패:',
      error instanceof Error ? error.message : error,
    );
    captureServerError(error, { tags: { area: 'tutor', op: 'record_hint' } });
  }
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

/** 자르기 한도를 넘은 필드 이름 (기록용, P1-19). 출력은 우리 화면의 상한보다 길 때만 (정상 실행도 2,000자는 넘음) */
function overLongFields(body: TutorRequest): string[] {
  const fields: string[] = [];
  const over = (name: string, value: unknown, max: number) => {
    if (typeof value === 'string' && value.length > max) fields.push(name);
  };
  over('student_code', body.student_code, MAX_CODE_LENGTH);
  over('previous_code', body.previous_code, MAX_CODE_LENGTH);
  over('step_goal', body.step_goal, MAX_STEP_GOAL_LENGTH);
  over('stdout', body.execution_result?.stdout, CLIENT_MAX_OUTPUT_LENGTH);
  over('stderr', body.execution_result?.stderr, CLIENT_MAX_OUTPUT_LENGTH);
  return fields;
}

type UserClient = Awaited<ReturnType<typeof createClient>>;

/** 이 사용자가 퀘스트를 이미 완료했는지 (본인 진행은 RLS 로 읽힘). 읽지 못하면 완료하지 않은 것으로 */
async function hasCompletedQuest(
  supabase: UserClient,
  userId: string,
  questId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('user_progress')
    .select('status')
    .eq('user_id', userId)
    .eq('quest_id', questId)
    .maybeSingle();
  return data?.status === 'completed';
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

  // 우리 화면은 보내지 않는 요청을 기록한다 (P1-19). 학생이 쓴 내용은 남기지 않음
  const reject = (
    status: number,
    error: string,
    reason: TutorAbuseReason,
    type?: string,
    level: TutorAbuseLevel = 'warning',
    detail?: Record<string, string | number | boolean>,
  ) => {
    reportTutorAbuse({ userId: user.id, reason, level, type, detail });
    return Response.json({ error }, { status });
  };

  // 2. Body 검증 (크기 → JSON → 필드)
  const declaredLength = Number(request.headers.get('content-length'));
  if (declaredLength > MAX_BODY_BYTES) {
    return reject(413, 'Body too large', 'body_too_large', undefined, 'warning', {
      bytes: declaredLength,
    });
  }
  let body: TutorRequest;
  try {
    const raw = await request.text();
    const bytes = Buffer.byteLength(raw);
    if (bytes > MAX_BODY_BYTES) {
      return reject(413, 'Body too large', 'body_too_large', undefined, 'warning', { bytes });
    }
    body = JSON.parse(raw);
  } catch {
    return reject(400, 'Invalid JSON', 'invalid_json');
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return reject(400, 'Invalid JSON', 'invalid_json');
  }

  if (
    !body.type ||
    !VALID_TYPES.includes(body.type as (typeof VALID_TYPES)[number])
  ) {
    return reject(400, 'Invalid type', 'invalid_type', String(body.type));
  }

  if (!body.quest_id) {
    return reject(400, 'quest_id is required', 'missing_quest_id', body.type);
  }

  if (body.type === 'hint_generator') {
    if (
      !body.hint_level ||
      !VALID_HINT_LEVELS.includes(body.hint_level as 1 | 2 | 3)
    ) {
      return reject(
        400,
        'hint_level (1, 2, or 3) is required for hint_generator',
        'invalid_hint_level',
        body.type,
      );
    }
  }

  if (body.type === 'code_feedback' && !body.execution_result) {
    return reject(
      400,
      'execution_result is required for code_feedback',
      'missing_execution_result',
      body.type,
    );
  }

  const tooLong = overLongFields(body);
  if (tooLong.length > 0) {
    // 자르고 계속 진행 (B01). 아이가 아주 긴 코드를 붙여 넣는 경우도 있으므로 기록만
    reportTutorAbuse({
      userId: user.id,
      reason: 'input_too_long',
      level: 'info',
      type: body.type,
      detail: { fields: tooLong.join(',') },
    });
  }

  body = sanitizeTutorBody(body);
  const questId = body.quest_id;

  // 퀘스트 행은 3~4단계(프로필·한도)와 나란히 미리 받아 둔다. 스테이지 잠금 확인(B38)에는 퀘스트의 스테이지 id 가 필요해
  // 한 번 더 왕복하지만, 그 왕복이 전에 퀘스트 조회가 쓰던 자리(정답 조회와 나란히)에 들어가므로 전체 대기 시간은 그대로다.
  // 정답 조회·잠금 확인은 한도를 통과한 요청만 (한도에 걸리면 이 결과는 버림)
  const questLookup = Promise.resolve(
    adminClient
      .from('quests')
      .select('*, stage:stages(id, world_id, title, order, theme_name)')
      .eq('id', questId)
      .single(),
  );
  questLookup.catch(() => {});

  // 3. 본인 API 키(B13, 서버에서만 복호화) + 선호 provider → 한도 종류(본인 키면 느슨하게)
  const [userProfileResult, userApiKeys] = await Promise.all([
    supabase
      .from('users')
      .select('preferred_provider')
      .eq('id', user.id)
      .single(),
    loadUserApiKeys(user.id),
  ]);

  // Provider 결정 (서버의 유료 키는 사용하지 않음)
  // - 본인 키가 있는 사용자: 본인 키로 호출, 실패 시 무료 티어로만 폴백
  // - 그 외: 서버 무료 티어만 사용, 실패 시 rule-based fallback
  const { providerType, customApiKey } = resolveUserProvider(
    userProfileResult.data?.preferred_provider,
    userApiKeys.keys,
  );

  // 4. 사용자별 요청 한도 (P1-19): 정답 조회·스테이지 잠금 확인, 캐시, LLM 호출 전.
  // 두 라우트(/api/tutor, /api/tutor/stream)가 모두 이 함수를 거치므로 한 곳에서 막는다. 캐시 적중도 센다(rateLimit.ts)
  const quota = await consumeTutorQuota(
    adminClient,
    user.id,
    body.type,
    getTutorRateLimit(body.type, !!customApiKey),
  );
  if (!quota.allowed) {
    const repeated =
      quota.deniedMinute >= REPEAT_DENIED_PER_MINUTE ||
      quota.deniedToday >= REPEAT_DENIED_PER_DAY;
    reportTutorAbuse({
      userId: user.id,
      reason: 'rate_limited',
      level: repeated ? 'warning' : 'info',
      type: body.type,
      detail: {
        scope: quota.scope ?? 'minute',
        retry_after: quota.retryAfter,
        denied_minute: quota.deniedMinute,
        denied_today: quota.deniedToday,
        own_key: !!customApiKey,
      },
    });
    return rateLimitedResponse(quota);
  }

  // 5. Quest → 스테이지 잠금(B38) + 정답 병렬 조회
  const needsAnswerKey = ANSWER_KEY_TYPES.has(body.type);
  const { data: quest } = await questLookup;

  if (!quest) {
    return reject(404, 'Quest not found', 'quest_not_found', body.type, 'warning', {
      quest_id: safeQuestId(questId),
    });
  }

  const q = quest as unknown as QuestWithStageServer;
  const [stageUnlocked, answerKeyRow] = await Promise.all([
    checkStageUnlocked(adminClient, user.id, q.stage.id, 'tutor'),
    needsAnswerKey ? fetchAnswerKeyRow(adminClient, questId) : Promise.resolve(null),
  ]);

  // 잠긴 스테이지면 막는다 (B38). 퀘스트 화면이 잠긴 퀘스트를 열지 않으므로 우리 화면은 보내지 않는 요청이다.
  // 이미 완료한 퀘스트(복습)는 화면과 같이 허용한다: 잠김일 때만 진행을 한 번 더 읽으므로 평소 응답은 늦어지지 않음
  if (!stageUnlocked && !(await hasCompletedQuest(supabase, user.id, questId))) {
    reportTutorAbuse({
      userId: user.id,
      reason: 'stage_locked',
      level: 'warning',
      type: body.type,
      detail: { quest_id: safeQuestId(questId) },
    });
    return Response.json(
      { error: 'stage_locked', message: STAGE_LOCKED_MESSAGE },
      { status: 403 },
    );
  }

  const skeleton = q.prompt_skeleton;
  // quests 행(expected_output·prompt_skeleton)은 quest_answer_keys가 없을 때의 폴백
  const answerKey = needsAnswerKey ? resolveAnswerKey(answerKeyRow, quest) : null;

  // 6. 프롬프트 조립
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

    // 다음 스테이지 제목 조회 (같은 월드 안. stages."order" 는 월드마다 1부터, P1-08)
    const nextStageResult = await adminClient
      .from('stages')
      .select('title')
      .eq('world_id', q.stage.world_id)
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

  // 7. 폴백 provider
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
    recordHint:
      body.type === 'hint_generator'
        ? () =>
            recordHintUsage(
              adminClient,
              user.id,
              body.quest_id,
              body.hint_level as 1 | 2 | 3,
            )
        : null,
    allowServerKey: (provider) => consumeServerKeyBudget(adminClient, provider),
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
