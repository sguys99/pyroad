import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { QuestShell } from '@/components/quest/QuestShell';
import { ProjectQuestShell } from '@/components/quest/ProjectQuestShell';
import type {
  QuestWithStage,
  UserProgress,
  PromptSkeleton,
} from '@/lib/types/database';

interface Props {
  params: Promise<{ questId: string }>;
}

export default async function QuestPage({ params }: Props) {
  const { questId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const [questResult, progressResult, profileResult] = await Promise.all([
    supabase
      .from('quests')
      .select(
        'id, stage_id, order, title, concept, prompt_skeleton, validation_type, xp_reward, created_at, stage:stages(id, title, order, theme_name)',
      )
      .eq('id', questId)
      .single(),
    supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('quest_id', questId)
      .maybeSingle(),
    supabase
      .from('users')
      .select('total_xp, current_level')
      .eq('id', user.id)
      .single(),
  ]);

  if (!questResult.data) notFound();

  const quest = questResult.data as unknown as QuestWithStage;

  // 클라이언트에 정답/힌트 노출 방지
  quest.prompt_skeleton.hints = { level_1: '', level_2: '', level_3: '' };
  if (quest.prompt_skeleton.steps) {
    quest.prompt_skeleton.steps = quest.prompt_skeleton.steps.map(
      ({ expected_output: _eo, hints: _hints, ...rest }) => ({
        ...rest,
        expected_output: '',
        hints: { level_1: '', level_2: '', level_3: '' },
      }),
    );
  }
  const progress = progressResult.data as UserProgress | null;
  const profile = profileResult.data;

  const isProject = quest.prompt_skeleton.steps != null;
  const Shell = isProject ? ProjectQuestShell : QuestShell;

  return (
    <Shell
      quest={quest}
      progress={progress}
      userId={user.id}
      initialXP={profile?.total_xp ?? 0}
      initialLevel={profile?.current_level ?? 1}
    />
  );
}
