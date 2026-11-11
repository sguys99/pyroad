import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/supabase/auth';
import { reportServerError } from '@/lib/api/serverError';
import { evaluateAchievements } from '@/lib/quest/rewardRpc';
import {
  buildAchievementBook,
  type AchievementDef,
  type AchievementProgressRow,
} from '@/lib/quest/achievementBook';
import { PageTransition } from '@/components/shared/PageTransition';
import { AchievementBook } from '@/components/achievements/AchievementBook';

export const metadata: Metadata = { title: '업적 도감' };

/**
 * 업적 도감 (P8-10). 프로필 "업적" 카드·월드맵 메뉴에서 들어옴. (protected) 레이아웃이 동적 렌더(CSP nonce).
 *
 * - 먼저 `evaluate_achievements`(멱등): 목표에 닿았는데 아직 기록되지 않은 업적(예: 00036 전부터 쌓인 기록)을 여기서도 잡아
 *   "진행 막대는 꽉 찼는데 미획득"인 칸이 없게
 * - 진행도 `achievement_progress`는 service_role 이라 확인한 id 로만. 정의·내 업적·잔액은 본인 권한으로
 */
export default async function AchievementsPage() {
  const { user } = await getAuthUser();
  if (!user) redirect('/');
  const supabase = await createClient();
  const admin = createAdminClient();

  await evaluateAchievements(admin, user.id);
  const [defs, owned, progress, me] = await Promise.all([
    supabase
      .from('achievements')
      .select(
        'id, name, description, icon, tier, category, metric, sort, hidden',
      ),
    supabase
      .from('user_achievements')
      .select('achievement_id, achieved_at, claimed_at')
      .eq('user_id', user.id),
    admin.rpc('achievement_progress', { p_user_id: user.id }),
    supabase.from('users').select('coins').eq('id', user.id).single(),
  ]);
  if (progress.error)
    reportServerError(progress.error, {
      area: 'achievements',
      op: 'achievement_progress',
    });

  const entries = buildAchievementBook(
    (defs.data ?? []) as AchievementDef[],
    owned.data ?? [],
    (progress.data ?? []) as AchievementProgressRow[],
  );

  return (
    <PageTransition className="mx-auto min-h-screen max-w-3xl px-4 py-4 sm:py-6">
      {entries.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          업적 도감을 불러오지 못했어요. 잠시 후 다시 열어 볼까요?
        </p>
      ) : (
        <AchievementBook entries={entries} coins={me.data?.coins ?? 0} />
      )}
    </PageTransition>
  );
}
