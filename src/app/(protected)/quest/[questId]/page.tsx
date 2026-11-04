import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { redirect, notFound } from 'next/navigation';
import { QUEST_RENDERERS } from '@/components/quest/questRenderers';
import { stripAnswerFields } from '@/lib/quest/answerKeys';
import { getQuestKind } from '@/lib/quest/questKind';
import type { QuestWithStage, UserProgress } from '@/lib/types/database';

interface Props {
  params: Promise<{ questId: string }>;
}

export default async function QuestPage({ params }: Props) {
  const { questId } = await params;
  const supabase = await createClient();

  // getAuthUser()와 user.id 불필요한 quest 쿼리를 병렬 실행
  const [{ user }, questResult] = await Promise.all([
    getAuthUser(),
    supabase
      .from('quests')
      .select(
        'id, stage_id, order, title, concept, prompt_skeleton, validation_type, xp_reward, created_at, stage:stages(id, title, order, theme_name)',
      )
      .eq('id', questId)
      .single(),
  ]);
  if (!user) redirect('/');

  // user.id 필요한 쿼리는 이후 병렬 실행
  const [progressResult, profileResult] = await Promise.all([
    supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('quest_id', questId)
      .maybeSingle(),
    supabase
      .from('users')
      .select('total_xp, current_level, golden_keys')
      .eq('id', user.id)
      .single(),
  ]);

  if (!questResult.data) notFound();

  const quest = questResult.data as unknown as QuestWithStage;

  // 클라이언트에 정답/힌트/solution_code 노출 방지. 정답은 quest_answer_keys에 있지만(P1-02),
  // ①(00004)만 적용된 DB에서는 quests에도 남아 있으므로 props로 내려보내기 전에 지운다
  quest.prompt_skeleton = stripAnswerFields(quest.prompt_skeleton);
  const progress = progressResult.data as UserProgress | null;
  const profile = profileResult.data;

  const Renderer = QUEST_RENDERERS[getQuestKind(quest.prompt_skeleton)];

  // key: 퀘스트를 옮기면(소프트 내비게이션) 퀘스트 상태는 새로 시작하고,
  // Pyodide Worker는 quest/layout.tsx의 PyodideProvider가 그대로 가지고 있다 (B22)
  return (
    <Renderer
      key={quest.id}
      quest={quest}
      progress={progress}
      userId={user.id}
      initialXP={profile?.total_xp ?? 0}
      initialLevel={profile?.current_level ?? 1}
      initialGoldenKeys={profile?.golden_keys ?? 3}
    />
  );
}
