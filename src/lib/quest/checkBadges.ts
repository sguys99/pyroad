import type { SupabaseClient } from '@supabase/supabase-js';
import type { BadgeType } from './badges';

interface BadgeCheckContext {
  supabase: SupabaseClient;
  userId: string;
  questId: string;
  hintsUsed: number;
}

export async function checkAndAwardBadges(
  ctx: BadgeCheckContext,
): Promise<BadgeType[]> {
  const { supabase, userId, questId, hintsUsed } = ctx;

  // 기존 뱃지 조회
  const { data: existingBadges } = await supabase
    .from('user_badges')
    .select('badge_type')
    .eq('user_id', userId);

  const earned = new Set(existingBadges?.map((b) => b.badge_type) ?? []);
  const newBadges: BadgeType[] = [];

  // first_code: 첫 퀘스트 완료
  if (!earned.has('first_code')) {
    const { count } = await supabase
      .from('user_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed');

    if (count === 1) {
      newBadges.push('first_code');
    }
  }

  // hint_master: 힌트 0회로 완료
  if (!earned.has('hint_master') && hintsUsed === 0) {
    newBadges.push('hint_master');
  }

  // stage_clear: 현재 퀘스트의 스테이지 전체 완료
  if (!earned.has('stage_clear')) {
    const { data: quest } = await supabase
      .from('quests')
      .select('stage_id')
      .eq('id', questId)
      .single();

    if (quest) {
      const { data: stageQuests } = await supabase
        .from('quests')
        .select('id')
        .eq('stage_id', quest.stage_id);

      if (stageQuests && stageQuests.length > 0) {
        const stageQuestIds = stageQuests.map((q) => q.id);

        const { count } = await supabase
          .from('user_progress')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'completed')
          .in('quest_id', stageQuestIds);

        if (count === stageQuestIds.length) {
          newBadges.push('stage_clear');
        }
      }
    }
  }

  // streak_3: 3일 연속 퀘스트 완료 (KST 기준)
  if (!earned.has('streak_3')) {
    const { data: completions } = await supabase
      .from('user_progress')
      .select('completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(50);

    if (completions && completions.length >= 3) {
      const uniqueDates = [
        ...new Set(
          completions.map((c) =>
            new Date(c.completed_at!).toLocaleDateString('ko-KR', {
              timeZone: 'Asia/Seoul',
            }),
          ),
        ),
      ];

      if (uniqueDates.length >= 3) {
        // KST 날짜를 Date 객체로 변환하여 연속 확인
        const toKSTDate = (dateStr: string) => {
          const parts = dateStr.replace(/\./g, '').trim().split(' ');
          return new Date(
            parseInt(parts[0]),
            parseInt(parts[1]) - 1,
            parseInt(parts[2]),
          );
        };

        const recent3 = uniqueDates.slice(0, 3).map(toKSTDate);
        const day1to2 =
          (recent3[0].getTime() - recent3[1].getTime()) / (1000 * 60 * 60 * 24);
        const day2to3 =
          (recent3[1].getTime() - recent3[2].getTime()) / (1000 * 60 * 60 * 24);

        if (Math.round(day1to2) === 1 && Math.round(day2to3) === 1) {
          newBadges.push('streak_3');
        }
      }
    }
  }

  // 새 뱃지 삽입
  if (newBadges.length > 0) {
    await supabase.from('user_badges').insert(
      newBadges.map((badge_type) => ({
        user_id: userId,
        badge_type,
      })),
    );
  }

  return newBadges;
}
