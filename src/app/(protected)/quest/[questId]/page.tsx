import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/supabase/auth';
import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { trackQuestStart } from '@/lib/analytics/server';
import { QUEST_RENDERERS } from '@/components/quest/questRenderers';
import { stripAnswerFields } from '@/lib/quest/answerKeys';
import { getQuestKind, type QuizPromptSkeleton } from '@/lib/quest/questKind';
import type { BossPromptSkeleton } from '@/lib/types/database';
import { shuffleQuiz } from '@/lib/quest/quizShuffle';
import { checkStageUnlocked } from '@/lib/world/checkStageUnlocked';
import { STAGE_LOCKED_REDIRECT } from '@/lib/world/stageLock';
import { serverWorlds } from '@/lib/world/serverWorlds';
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
        'id, stage_id, order, title, concept, quest_type, quiz_kind, prompt_skeleton, validation_type, xp_reward, created_at, stage:stages(id, title, order, theme_name, world:worlds(slug), quests(id, order, title, quest_type))',
      )
      .eq('id', questId)
      .single(),
  ]);
  if (!user) redirect('/');

  // user.id 필요한 쿼리는 이후 병렬 실행. 스테이지 잠금(B38)도 함께 확인해 응답이 늦어지지 않게 한다
  // 진행은 이 스테이지 퀘스트 전부를 한 번에 읽는다: 이 퀘스트 진행 + 헤더 진행 점(P6-02)
  const stageId = questResult.data?.stage_id;
  const stageQuestIds = (
    questResult.data?.stage as { quests?: { id: string }[] } | null
  )?.quests?.map((q) => q.id) ?? [questId];
  const [progressResult, profileResult, stageUnlocked] = await Promise.all([
    supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', user.id)
      .in('quest_id', stageQuestIds),
    supabase
      .from('users')
      .select('total_xp, current_level, golden_keys')
      .eq('id', user.id)
      .single(),
    stageId
      ? checkStageUnlocked(createAdminClient(), user.id, stageId, 'quest_page')
      : Promise.resolve(true),
  ]);

  if (!questResult.data) notFound();

  const progressRows = (progressResult.data ?? []) as UserProgress[];
  const progress = progressRows.find((p) => p.quest_id === questId) ?? null;

  // 잠긴 스테이지의 퀘스트를 URL 로 열면 월드맵으로 돌려보내고 안내한다 (B38). 완료·황금키·튜터는 서버가 따로 막는다.
  // 이미 완료한 퀘스트는 복습할 수 있게 둔다 (콘텐츠가 바뀌어 앞 스테이지에 새 퀘스트가 생겨도 완료한 것은 다시 볼 수 있게)
  if (!stageUnlocked && progress?.status !== 'completed') {
    redirect(STAGE_LOCKED_REDIRECT);
  }

  const quest = questResult.data as unknown as QuestWithStage;

  // 클라이언트에 정답/힌트/solution_code 노출 방지. 정답은 quest_answer_keys에 있지만(P1-02),
  // ①(00004)만 적용된 DB에서는 quests에도 남아 있으므로 props로 내려보내기 전에 지운다
  quest.prompt_skeleton = stripAnswerFields(quest.prompt_skeleton);
  // 퀴즈 보기 순서는 들어올 때마다 섞음 (P7-02, §2.3). 다시 풀기 순서는 /api/quest/answer 의 next_quiz
  const skeleton = quest.prompt_skeleton as Partial<QuizPromptSkeleton>;
  if (skeleton.quiz) skeleton.quiz = shuffleQuiz(skeleton.quiz);
  // 보스 문제도 문제마다 섞음 (P9-12). 다시 도전 순서는 /api/quest/boss 시작 응답의 rounds
  const boss = (quest.prompt_skeleton as Partial<BossPromptSkeleton>).boss;
  if (boss?.rounds) boss.rounds = boss.rounds.map((q) => shuffleQuiz(q));
  // 헤더 BGM = 이 퀘스트가 속한 월드의 곡 (P5-11, 월드맵과 같은 곡이면 이어서 재생)
  // 눈썹 "N권"은 지도 머리와 같은 셈(bookNo: order 순 목록의 자리, P6-01)
  const world = quest.stage.world;
  if (world) {
    const worlds = serverWorlds();
    const index = worlds.findIndex((w) => w.slug === world.slug);
    world.bgm = worlds[index]?.map?.bgm ?? null;
    if (index >= 0) world.no = index + 1;
  }
  // 헤더 스테이지 진행 점 (P6-02): 퀘스트마다 내 완료 여부, 잠긴 스테이지 복습이면 안 끝낸 점은 잠김
  const done = new Set(
    progressRows.filter((p) => p.status === 'completed').map((p) => p.quest_id),
  );
  quest.stage.quests = (quest.stage.quests ?? []).map((q) => ({
    ...q,
    completed: done.has(q.id),
  }));
  quest.stage.unlocked = stageUnlocked;
  const profile = profileResult.data;

  // 퀘스트 시작 기록 (P1-17). 응답 뒤 기록되고, DB dedupe로 사용자·퀘스트마다 한 번만 남는다
  trackQuestStart(await headers(), user.id, quest.id);

  const Renderer =
    QUEST_RENDERERS[getQuestKind(quest.prompt_skeleton, quest.quest_type)];

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
