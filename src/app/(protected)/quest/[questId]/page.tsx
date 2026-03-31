import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { QuestShell } from '@/components/quest/QuestShell';
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

  const [questResult, progressResult] = await Promise.all([
    supabase
      .from('quests')
      .select('*, stage:stages(id, title, order)')
      .eq('id', questId)
      .single(),
    supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('quest_id', questId)
      .maybeSingle(),
  ]);

  if (!questResult.data) notFound();

  const quest = questResult.data as unknown as QuestWithStage;
  const progress = progressResult.data as UserProgress | null;

  return <QuestShell quest={quest} progress={progress} />;
}
