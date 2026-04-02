import { createClient } from '@/lib/supabase/server';
import { getAvailableProviders } from '@/lib/tutor/providers/factory';
import {
  SYSTEM_PROMPT,
  buildQuestIntroPrompt,
  buildHintPrompt,
  buildCodeFeedbackPrompt,
  buildEncouragementPrompt,
  buildProjectGuidePrompt,
} from '@/lib/tutor/prompts';
import type { TutorRequest, LLMProviderType } from '@/lib/tutor/types';
import type { QuestWithStage } from '@/lib/types/database';

const VALID_TYPES = [
  'quest_intro',
  'hint_generator',
  'code_feedback',
  'encouragement',
  'project_guide',
] as const;
const VALID_HINT_LEVELS = [1, 2, 3] as const;
const MAX_CODE_LENGTH = 2000;

// quest_intro, encouragement는 품질보다 속도 우선 → 경량 모델 사용
const FAST_TYPES = new Set(['quest_intro', 'encouragement']);

// 동일 quest에 대해 동일 프롬프트 → 캐시 가능
export const CACHEABLE_TYPES = new Set(['quest_intro', 'encouragement']);

export interface PreparedTutorCall {
  systemPrompt: string;
  userPrompt: string;
  providerType: LLMProviderType | undefined;
  customApiKey: string | undefined;
  hasAnyKey: boolean;
  fast: boolean;
  quest: QuestWithStage;
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

  const q = quest as unknown as QuestWithStage;
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

export function buildFallbackMessage(
  body: TutorRequest,
  quest: QuestWithStage,
): string {
  const skeleton = quest.prompt_skeleton;

  if (body.type === 'quest_intro') {
    return skeleton.fallback_text;
  } else if (body.type === 'hint_generator') {
    const hintLevel = body.hint_level as 1 | 2 | 3;
    const hintKey = `level_${hintLevel}` as keyof typeof skeleton.hints;
    return skeleton.hints[hintKey];
  } else if (body.type === 'code_feedback') {
    return body.execution_result?.passed
      ? '대단해요! 정답이에요! 🎉'
      : '앗, 조금 고쳐볼까요? 힌트를 사용해보세요! 💡';
  } else if (body.type === 'encouragement') {
    return '퀘스트를 완료했어요! 정말 대단해요! 🎉🐍';
  } else {
    // project_guide
    const stepIdx = (body.current_step ?? 1) - 1;
    const steps = skeleton.steps;
    return steps && steps[stepIdx]
      ? steps[stepIdx].fallback_text
      : skeleton.fallback_text;
  }
}
