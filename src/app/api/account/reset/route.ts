import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateLevel } from '@/lib/quest/xp';

interface ResetRequest {
  stageId?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ResetRequest = {};
  try {
    body = await request.json();
  } catch {
    // body가 없으면 전체 리셋
  }

  if (body.stageId) {
    // 대상 스테이지의 order 조회
    const { data: targetStage } = await supabase
      .from('stages')
      .select('id, order, title')
      .eq('id', body.stageId)
      .single();

    if (!targetStage) {
      return NextResponse.json(
        { error: '해당 스테이지를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    // 캐스케이드: 대상 스테이지 이후(order >= target) 모든 스테이지 조회
    const { data: affectedStages } = await supabase
      .from('stages')
      .select('id, order, title')
      .gte('order', targetStage.order)
      .order('order', { ascending: true });

    if (!affectedStages || affectedStages.length === 0) {
      return NextResponse.json(
        { error: '해당 스테이지를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const affectedStageIds = affectedStages.map((s) => s.id);

    // 영향 받는 모든 스테이지의 퀘스트 조회
    const { data: quests } = await supabase
      .from('quests')
      .select('id, xp_reward, stage_id')
      .in('stage_id', affectedStageIds);

    if (!quests || quests.length === 0) {
      return NextResponse.json(
        { error: '해당 스테이지의 퀘스트를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const questIds = quests.map((q) => q.id);

    // 완료된 퀘스트 진행 데이터 조회 (XP 차감용)
    const { data: completedProgress } = await supabase
      .from('user_progress')
      .select('quest_id, hints_used')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .in('quest_id', questIds);

    // 영향 받는 모든 스테이지의 user_progress 삭제
    const { error: progressError } = await supabase
      .from('user_progress')
      .delete()
      .eq('user_id', user.id)
      .in('quest_id', questIds);

    if (progressError) {
      return NextResponse.json(
        { error: '진행 데이터 삭제 중 오류가 발생했습니다.' },
        { status: 500 },
      );
    }

    // 영향 받는 스테이지의 stage_clear 뱃지 삭제
    // badge_type 형식이 'stage_clear'이므로 해당 뱃지 삭제
    // (stage_clear 뱃지는 하나만 존재하므로 후속 스테이지가 리셋되면 삭제)
    await supabase
      .from('user_badges')
      .delete()
      .eq('user_id', user.id)
      .eq('badge_type', 'stage_clear');

    // XP 재계산: 삭제된 퀘스트의 XP를 차감
    if (completedProgress && completedProgress.length > 0) {
      let xpToRemove = 0;
      for (const prog of completedProgress) {
        const quest = quests.find((q) => q.id === prog.quest_id);
        if (quest) {
          const hintsUsed = prog.hints_used ?? 0;
          if (hintsUsed === 0) xpToRemove += Math.round(quest.xp_reward * 1.5);
          else if (hintsUsed === 1)
            xpToRemove += Math.round(quest.xp_reward * 1.25);
          else xpToRemove += quest.xp_reward;
        }
      }

      const { data: currentUser } = await supabase
        .from('users')
        .select('total_xp')
        .eq('id', user.id)
        .single();

      const newTotalXP = Math.max(0, (currentUser?.total_xp ?? 0) - xpToRemove);
      const newLevel = calculateLevel(newTotalXP);

      await supabase
        .from('users')
        .update({ total_xp: newTotalXP, current_level: newLevel })
        .eq('id', user.id);
    }

    return NextResponse.json({
      success: true,
      type: 'stage',
      resetStages: affectedStages.map((s) => ({
        id: s.id,
        order: s.order,
        title: s.title,
      })),
    });
  }

  // 전체 리셋
  const { error: badgesError } = await supabase
    .from('user_badges')
    .delete()
    .eq('user_id', user.id);

  if (badgesError) {
    return NextResponse.json(
      { error: '뱃지 삭제 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }

  const { error: progressError } = await supabase
    .from('user_progress')
    .delete()
    .eq('user_id', user.id);

  if (progressError) {
    return NextResponse.json(
      { error: '진행 데이터 삭제 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }

  const { error: userError } = await supabase
    .from('users')
    .update({ total_xp: 0, current_level: 1 })
    .eq('id', user.id);

  if (userError) {
    return NextResponse.json(
      { error: '사용자 데이터 초기화 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, type: 'full' });
}
