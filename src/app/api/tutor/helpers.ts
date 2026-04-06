import { createClient } from '@/lib/supabase/server';
import { getAvailableProviders } from '@/lib/tutor/providers/factory';
import {
  SYSTEM_PROMPT,
  buildQuestIntroPrompt,
  buildHintPrompt,
  buildCodeFeedbackPrompt,
  buildEncouragementPrompt,
  buildProjectGuidePrompt,
  buildStageSummaryPrompt,
} from '@/lib/tutor/prompts';
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

// quest_intro, encouragement는 품질보다 속도 우선 → 경량 모델 사용
const FAST_TYPES = new Set(['quest_intro', 'encouragement', 'stage_summary']);

// 동일 quest에 대해 동일 프롬프트 → 캐시 가능
export const CACHEABLE_TYPES = new Set(['quest_intro', 'encouragement', 'stage_summary']);

export interface PreparedTutorCall {
  systemPrompt: string;
  userPrompt: string;
  providerType: LLMProviderType | undefined;
  customApiKey: string | undefined;
  hasAnyKey: boolean;
  fast: boolean;
  quest: QuestWithStageServer;
  body: TutorRequest;
}

export async function prepareTutorCall(
  request: Request,
): Promise<PreparedTutorCall | Response> {
  // 1. Auth 검증
  const supabase = await createClient();
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

  if (body.student_code && body.student_code.length > MAX_CODE_LENGTH) {
    body.student_code = body.student_code.slice(0, MAX_CODE_LENGTH);
  }

  // 3. Quest + User Profile 병렬 조회
  const [questResult, userProfileResult] = await Promise.all([
    supabase
      .from('quests')
      .select('*, stage:stages(id, title, order, theme_name)')
      .eq('id', body.quest_id)
      .single(),
    supabase
      .from('users')
      .select('preferred_provider, custom_api_keys')
      .eq('id', user.id)
      .single(),
  ]);

  const { data: quest } = questResult;
  const { data: userProfile } = userProfileResult;

  if (!quest) {
    return Response.json({ error: 'Quest not found' }, { status: 404 });
  }

  const q = quest as unknown as QuestWithStageServer;
  const skeleton = q.prompt_skeleton;

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
    const hintKey = `level_${hintLevel}` as keyof typeof skeleton.hints;
    userPrompt = buildHintPrompt({
      topic: skeleton.topic,
      exerciseDescription: skeleton.exercise_description,
      studentCode: body.student_code || '',
      hintLevel,
      hintReference: skeleton.hints[hintKey],
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
      expectedOutput: q.expected_output,
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
    const stageConceptsResult = await supabase
      .from('quests')
      .select('concept')
      .eq('stage_id', q.stage.id)
      .order('"order"');
    const concepts = stageConceptsResult.data?.map((r) => r.concept) ?? [
      skeleton.topic,
    ];

    // 다음 스테이지 제목 조회
    const nextStageResult = await supabase
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

  // 6. Provider 결정
  let providerType: LLMProviderType | undefined = body.provider;
  let customApiKey: string | undefined;

  if (!providerType) {
    if (userProfile?.preferred_provider) {
      providerType = userProfile.preferred_provider as LLMProviderType;
    }
  }
  if (userProfile?.custom_api_keys && providerType) {
    const keys = userProfile.custom_api_keys as Record<string, string>;
    customApiKey = keys[providerType] || undefined;
  }

  const available = getAvailableProviders();
  const userKeys = (userProfile?.custom_api_keys ?? {}) as Record<string, string>;
  const hasAnyKey = available.length > 0 || Object.values(userKeys).some((k) => !!k);

  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    providerType,
    customApiKey,
    hasAnyKey,
    fast: FAST_TYPES.has(body.type),
    quest: q,
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

export function buildFallbackMessage(
  body: TutorRequest,
  quest: QuestWithStageServer,
): string {
  const skeleton = quest.prompt_skeleton;

  if (body.type === 'quest_intro') {
    return skeleton.fallback_text;
  } else if (body.type === 'hint_generator') {
    const hintLevel = body.hint_level as 1 | 2 | 3;
    const hintKey = `level_${hintLevel}` as keyof typeof skeleton.hints;
    return skeleton.hints[hintKey];
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
