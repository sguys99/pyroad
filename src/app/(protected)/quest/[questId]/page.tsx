import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { QuestShell } from '@/components/quest/QuestShell';
import { ProjectQuestShell } from '@/components/quest/ProjectQuestShell';
import type { QuestWithStage, UserProgress } from '@/lib/types/database';

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
      .select('*, stage:stages(id, title, order, theme_name)')
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
