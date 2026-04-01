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

  // 1. Quest 조회
  const { data: quest } = await supabase
    .from('quests')
    .select('id, xp_reward')
    .eq('id', body.quest_id)
    .single();

  if (!quest) {
    return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
  }

  // 2. 중복 완료 방지
  const { data: existing } = await supabase
    .from('user_progress')
    .select('status')
    .eq('user_id', user.id)
    .eq('quest_id', body.quest_id)
    .maybeSingle();

  if (existing?.status === 'completed') {
    // 이미 완료된 퀘스트 — 현재 프로필 반환
    const { data: profile } = await supabase
      .from('users')
      .select('total_xp, current_level')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      earned_xp: 0,
      total_xp: profile?.total_xp ?? 0,
      new_level: profile?.current_level ?? 1,
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

  // 5. 현재 유저 조회
  const { data: currentUser } = await supabase
    .from('users')
    .select('total_xp, current_level')
    .eq('id', user.id)
    .single();

  const prevLevel = currentUser?.current_level ?? 1;
  const newTotalXP = (currentUser?.total_xp ?? 0) + earnedXP;
  const newLevel = calculateLevel(newTotalXP);

  // 6. users 업데이트
  await supabase
    .from('users')
    .update({
      total_xp: newTotalXP,
      current_level: newLevel,
    })
    .eq('id', user.id);

  // 7. 뱃지 체크 및 부여
  const newBadges = await checkAndAwardBadges({
    supabase,
    userId: user.id,
    questId: body.quest_id,
    hintsUsed: body.hints_used,
  });

  return NextResponse.json({
    earned_xp: earnedXP,
    total_xp: newTotalXP,
    new_level: newLevel,
    level_changed: newLevel > prevLevel,
    already_completed: false,
    new_badges: newBadges,
  });
}
