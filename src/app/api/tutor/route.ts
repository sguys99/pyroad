import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callTutor } from '@/lib/tutor/client';
import {
  SYSTEM_PROMPT,
  buildQuestIntroPrompt,
  buildHintPrompt,
  buildCodeFeedbackPrompt,
  buildEncouragementPrompt,
  buildProjectGuidePrompt,
} from '@/lib/tutor/prompts';
import type { TutorRequest, TutorResponse } from '@/lib/tutor/types';
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

export async function POST(request: Request) {
  // 1. Auth 검증
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Body 검증
  let body: TutorRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (
    !body.type ||
    !VALID_TYPES.includes(body.type as (typeof VALID_TYPES)[number])
  ) {
    return NextResponse.json(
      { error: 'Invalid type' },
      { status: 400 },
    );
  }

  if (!body.quest_id) {
    return NextResponse.json(
      { error: 'quest_id is required' },
      { status: 400 },
    );
  }

  if (body.type === 'hint_generator') {
    if (
      !body.hint_level ||
      !VALID_HINT_LEVELS.includes(body.hint_level as 1 | 2 | 3)
    ) {
      return NextResponse.json(
        { error: 'hint_level (1, 2, or 3) is required for hint_generator' },
        { status: 400 },
      );
    }
  }

  if (body.student_code && body.student_code.length > MAX_CODE_LENGTH) {
    body.student_code = body.student_code.slice(0, MAX_CODE_LENGTH);
  }

  // 3. Quest 조회
  const { data: quest } = await supabase
    .from('quests')
    .select('*, stage:stages(id, title, order, theme_name)')
    .eq('id', body.quest_id)
    .single();

  if (!quest) {
    return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
  }

  const q = quest as unknown as QuestWithStage;
  const skeleton = q.prompt_skeleton;

  // 4. 추가 검증
  if (body.type === 'code_feedback' && !body.execution_result) {
    return NextResponse.json(
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

  // 6. Claude 호출
  const result = await callTutor(SYSTEM_PROMPT, userPrompt);

  // 7. 폴백 처리
  let message: string;
  let isFallback: boolean;

  if (result.ok) {
    message = result.text;
    isFallback = false;
  } else {
    isFallback = true;
    if (body.type === 'quest_intro') {
      message = skeleton.fallback_text;
    } else if (body.type === 'hint_generator') {
      const hintLevel = body.hint_level as 1 | 2 | 3;
      const hintKey = `level_${hintLevel}` as keyof typeof skeleton.hints;
      message = skeleton.hints[hintKey];
    } else if (body.type === 'code_feedback') {
      message = body.execution_result?.passed
        ? '대단해요! 정답이에요! 🎉'
        : '앗, 조금 고쳐볼까요? 힌트를 사용해보세요! 💡';
    } else if (body.type === 'encouragement') {
      message = '퀘스트를 완료했어요! 정말 대단해요! 🎉🐍';
    } else {
      // project_guide
      const stepIdx = (body.current_step ?? 1) - 1;
      const steps = skeleton.steps;
      message =
        steps && steps[stepIdx]
          ? steps[stepIdx].fallback_text
          : skeleton.fallback_text;
    }
  }

  // 8. 응답
  const response: TutorResponse = { message, is_fallback: isFallback };
  return NextResponse.json(response);
}
