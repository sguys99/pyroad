import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { DailyQuiz, type DailyItem } from '@/components/quest/quiz/DailyQuiz';
import { stripAnswerFields } from '@/lib/quest/answerKeys';
import type { QuizPromptSkeleton } from '@/lib/quest/questKind';
import { shuffleQuiz } from '@/lib/quest/quizShuffle';
import { getAuthUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import type { QuestWithStage, UserProgress } from '@/lib/types/database';
import { loadWorldMapData } from '@/lib/world/loadWorldMapData';

export const metadata: Metadata = { title: '오늘의 퀴즈' };

/**
 * 오늘의 퀴즈 (P7-10, §12-Q60 3): 월드맵 카드 → 여기서 3문제를 연달아. 고르기·완료는 월드맵 데이터와 같은 계산
 * (`loadWorldMapData().daily`, `src/lib/quest/dailyQuiz.ts`)이라 카드와 화면이 늘 같은 문제를 본다.
 * 채점·보상은 퀴즈 퀘스트와 같은 `/api/quest/answer`(별·XP 규칙 그대로). 고른 문제는 열린 스테이지 것만이라 잠금 가드가 따로 필요 없다.
 * 동적 렌더: (protected) 레이아웃이 force-dynamic (CSP nonce)
 */
export default async function DailyPage() {
  const data = await loadWorldMapData();
  if (!data) redirect('/');
  const { picks, results, today } = data.daily;
  const ids = picks.map((p) => p.questId);

  let userId = data.profile?.id ?? '';
  let items: DailyItem[] = [];
  if (ids.length > 0) {
    const supabase = await createClient();
    const [{ user }, quests, progress] = await Promise.all([
      getAuthUser(),
      supabase
        .from('quests')
        .select(
          'id, stage_id, order, title, concept, quest_type, quiz_kind, prompt_skeleton, validation_type, xp_reward, created_at, stage:stages(id, title, order, theme_name, world:worlds(slug))',
        )
        .in('id', ids),
      supabase.from('user_progress').select('*').in('quest_id', ids),
    ]);
    if (!user) redirect('/');
    userId = user.id;
    const rows = (progress.data ?? []) as UserProgress[];
    items = picks.flatMap((p) => {
      const quest = quests.data?.find((q) => q.id === p.questId) as unknown as
        | QuestWithStage
        | undefined;
      if (!quest) return [];
      // 정답·힌트는 내려보내지 않고(①만 적용된 DB 대비), 보기는 들어올 때마다 섞음 — 퀘스트 페이지와 같음
      quest.prompt_skeleton = stripAnswerFields(quest.prompt_skeleton);
      const skeleton = quest.prompt_skeleton as Partial<QuizPromptSkeleton>;
      if (skeleton.quiz) skeleton.quiz = shuffleQuiz(skeleton.quiz);
      return [
        {
          quest,
          progress:
            rows.find(
              (r) => r.quest_id === p.questId && r.user_id === user.id,
            ) ?? null,
          review: p.review,
        },
      ];
    });
  }

  return (
    <DailyQuiz
      items={items}
      results={results}
      today={today}
      userId={userId}
      initialXP={data.profile?.total_xp ?? 0}
      initialLevel={data.profile?.current_level ?? 1}
    />
  );
}
