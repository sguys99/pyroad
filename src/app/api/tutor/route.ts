import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callTutor } from '@/lib/tutor/client';
import {
  SYSTEM_PROMPT,
  buildQuestIntroPrompt,
  buildHintPrompt,
} from '@/lib/tutor/prompts';
import type { TutorRequest, TutorResponse } from '@/lib/tutor/types';
import type { QuestWithStage } from '@/lib/types/database';

const VALID_TYPES = ['quest_intro', 'hint_generator'] as const;
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

  if (!body.type || !VALID_TYPES.includes(body.type)) {
    return NextResponse.json(
      { error: 'Invalid type. Must be quest_intro or hint_generator' },
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

  // 4. 프롬프트 조립
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
  } else {
    const hintLevel = body.hint_level as 1 | 2 | 3;
    const hintKey = `level_${hintLevel}` as keyof typeof skeleton.hints;
    userPrompt = buildHintPrompt({
      topic: skeleton.topic,
      exerciseDescription: skeleton.exercise_description,
      studentCode: body.student_code || '',
      hintLevel,
      hintReference: skeleton.hints[hintKey],
    });
  }

  // 5. Claude 호출
  const result = await callTutor(SYSTEM_PROMPT, userPrompt);

  // 6. 폴백 처리
  let message: string;
  let isFallback: boolean;

  if (result.ok) {
    message = result.text;
    isFallback = false;
  } else {
    isFallback = true;
    if (body.type === 'quest_intro') {
      message = skeleton.fallback_text;
    } else {
      const hintLevel = body.hint_level as 1 | 2 | 3;
      const hintKey = `level_${hintLevel}` as keyof typeof skeleton.hints;
      message = skeleton.hints[hintKey];
    }
  }

  // 7. 응답
  const response: TutorResponse = { message, is_fallback: isFallback };
  return NextResponse.json(response);
}
