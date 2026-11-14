import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import {
  SkillCheckQuiz,
  type SkillCheckInitial,
} from '@/components/world/skillCheck/SkillCheckQuiz';
import { createClient } from '@/lib/supabase/server';
import { kstToday } from '@/lib/time/kst';
import { loadWorldMapData } from '@/lib/world/loadWorldMapData';
import {
  skillCheckPassScore,
  type SkillCheckPractice,
} from '@/lib/world/skillCheck';
import { isOpenable, unlockAfter } from '@/lib/world/worldBook';

export const metadata: Metadata = { title: '실력 확인 퀴즈' };

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * 실력 확인 퀴즈 (P10-03, docs/curriculum/world2.md §7): 잠긴 월드의 책·표지 → 여기.
 * 이 페이지는 아무것도 쓰지 않는다(미리 가져오기로 하루 도전을 쓰지 않게) — 시작·채점은 화면이 `/api/world/skill-check` 로.
 * 판정은 월드맵 데이터와 같은 계산(잠김·오늘 제출 여부). 오늘 이미 냈으면 그 결과(점수·연습할 단계)를 다시 보여 줌.
 * 동적 렌더: (protected) 레이아웃이 force-dynamic
 */
export default async function SkillCheckPage({ params }: Props) {
  const [{ slug }, data] = await Promise.all([params, loadWorldMapData()]);
  if (!data) redirect('/');
  const worlds = data.progress.worlds;
  const index = worlds.findIndex((w) => w.world.slug === slug);
  const entry = worlds[index];
  if (!entry?.world.skill_check) notFound();

  let initial: SkillCheckInitial = { kind: 'ready' };
  if (isOpenable(entry)) initial = { kind: 'open' };
  else if (entry.status === 'coming_soon') initial = { kind: 'soon' };
  else if (entry.skillCheck?.triedToday) {
    const supabase = await createClient();
    const { data: row } = await supabase
      .from('skill_check_attempts')
      .select('score, total, passed, practice')
      .eq('world_id', entry.stages[0].world_id)
      .eq('attempt_on', kstToday())
      .maybeSingle();
    if (row?.total)
      initial = {
        kind: 'done',
        result: {
          score: row.score ?? 0,
          total: row.total,
          pass_score: skillCheckPassScore(row.total),
          passed: row.passed,
          practice: (row.practice ?? []) as unknown as SkillCheckPractice[],
        },
      };
  }

  return (
    <SkillCheckQuiz
      slug={slug}
      worldTitle={entry.world.title}
      prevTitle={unlockAfter(worlds, index)?.world.title ?? '앞 월드'}
      initial={initial}
    />
  );
}
