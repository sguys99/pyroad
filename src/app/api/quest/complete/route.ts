import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateXP, calculateLevel } from '@/lib/quest/xp';
import { checkAndAwardBadges } from '@/lib/quest/checkBadges';

interface CompleteRequest {
  quest_id: string;
  code_submitted: string;
  hints_used: number;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: CompleteRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.quest_id || body.code_submitted === undefined) {
    return NextResponse.json(
      { error: 'quest_id and code_submitted are required' },
      { status: 400 },
    );
  }

  // 1. Quest 조회 + 중복 완료 확인 + 유저 프로필 — 병렬 실행
  const [questResult, existingResult, profileResult] = await Promise.all([
    supabase
      .from('quests')
      .select('id, xp_reward, stage_id')
      .eq('id', body.quest_id)
      .single(),
    supabase
      .from('user_progress')
      .select('status')
      .eq('user_id', user.id)
      .eq('quest_id', body.quest_id)
      .maybeSingle(),
    supabase
      .from('users')
      .select('total_xp, current_level')
      .eq('id', user.id)
      .single(),
  ]);

  const quest = questResult.data;
  if (!quest) {
    return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
  }

  // 2. 이미 완료된 퀘스트 — 현재 프로필 반환
  if (existingResult.data?.status === 'completed') {
    return NextResponse.json({
      earned_xp: 0,
      total_xp: profileResult.data?.total_xp ?? 0,
      new_level: profileResult.data?.current_level ?? 1,
      level_changed: false,
      already_completed: true,
      new_badges: [],
    });
  }

  // 3. XP 계산
  const earnedXP = calculateXP(quest.xp_reward, body.hints_used);

  // 4. user_progress upsert
  await supabase.from('user_progress').upsert(
    {
      user_id: user.id,
      quest_id: body.quest_id,
      status: 'completed' as const,
      hints_used: body.hints_used,
      code_submitted: body.code_submitted,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,quest_id' },
  );

  const prevLevel = profileResult.data?.current_level ?? 1;
  const newTotalXP = (profileResult.data?.total_xp ?? 0) + earnedXP;
  const newLevel = calculateLevel(newTotalXP);

  // 6. users 업데이트
  await supabase
    .from('users')
    .update({
      total_xp: newTotalXP,
      current_level: newLevel,
    })
    .eq('id', user.id);

  // 7. 뱃지 체크 및 부여 + 스테이지 완료 판정 — 병렬 실행
  const [newBadges, stageQuestsResult, completedInStageResult] =
    await Promise.all([
      checkAndAwardBadges({
        supabase,
        userId: user.id,
        questId: body.quest_id,
        hintsUsed: body.hints_used,
      }),
      supabase
        .from('quests')
        .select('id, concept')
        .eq('stage_id', quest.stage_id),
      supabase
        .from('user_progress')
        .select('quest_id')
        .eq('user_id', user.id)
        .eq('status', 'completed'),
    ]);

  const stageQuestIds = new Set(
    stageQuestsResult.data?.map((q) => q.id) ?? [],
  );
  const completedIds = new Set(
    (completedInStageResult.data ?? [])
      .filter((p) => stageQuestIds.has(p.quest_id))
      .map((p) => p.quest_id),
  );
  completedIds.add(body.quest_id);

  const isLastQuestInStage =
    stageQuestIds.size > 0 && stageQuestIds.size === completedIds.size;

  // 스테이지 완료 시 추가 정보 수집
  let stageConcepts: string[] | undefined;
  let stageTitle: string | undefined;
  let stageOrder: number | undefined;

  if (isLastQuestInStage) {
    stageConcepts =
      stageQuestsResult.data?.map((q) => q.concept) ?? [];

    const stageResult = await supabase
      .from('stages')
      .select('title, "order"')
      .eq('id', quest.stage_id)
      .single();

    if (stageResult.data) {
      stageTitle = stageResult.data.title;
      stageOrder = stageResult.data.order;
    }
  }

  return NextResponse.json({
    earned_xp: earnedXP,
    total_xp: newTotalXP,
    new_level: newLevel,
    level_changed: newLevel > prevLevel,
    already_completed: false,
    new_badges: newBadges,
    isLastQuestInStage,
    ...(isLastQuestInStage && { stageConcepts, stageTitle, stageOrder }),
  });
}
