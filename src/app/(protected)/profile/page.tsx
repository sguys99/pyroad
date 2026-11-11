import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, ChevronLeft } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/supabase/auth';
import { reportServerError } from '@/lib/api/serverError';
import { LogoutButton } from '@/components/LogoutButton';
import { HudCounter } from '@/components/ui/hud';
import { PageTransition } from '@/components/shared/PageTransition';
import { AccountManagementSection } from '@/components/profile/AccountManagementSection';
import { LearningCalendar } from '@/components/profile/LearningCalendar';
import {
  AchievementsCard,
  ProfileCard,
  ProfileHero,
  ProfileStatsCard,
  TreasureCard,
} from '@/components/profile/ProfileSections';
import { OWN_PROFILE_SELECT, toOwnProfile } from '@/lib/avatar/ownProfile';
import type { Achievement } from '@/lib/types/database';
import {
  recentAchievements,
  type ProfileStatsRaw,
} from '@/lib/profile/profileStats';
import { getStageStatuses } from '@/lib/world/getStageStatuses';
import { chestState } from '@/lib/world/chest';
import { kstToday } from '@/lib/time/kst';

/** 못 읽었을 때(00038 전 DB) 빈 기록 — 화면은 0으로 그대로 그림 */
const EMPTY_STATS: ProfileStatsRaw = {
  stats: {
    quests: 0,
    no_hint: 0,
    stars: 0,
    three_stars: 0,
    quiz_correct: 0,
    reviews: 0,
    streak: 0,
    errors: 0,
    chests: 0,
    attendance: 0,
  },
  quiz_tries: 0,
  quiz_right: 0,
  streak: 0,
  shields: 0,
  days: {},
  shield_days: [],
  stamp_days: [],
  coins_week: 0,
};

/**
 * 프로필 (P8-13): 본인 전용 — 공개 정보 범위(§2.6, 닉네임 + 아바타)는 그대로.
 * 사용자 테이블은 본인 권한(RLS)으로, 통계·학습 달력은 service_role `profile_stats`(00038)를 확인한 id 로 한 번에 — 모두 병렬
 */
export default async function ProfilePage() {
  const supabase = await createClient();
  const { user } = await getAuthUser();
  if (!user) redirect('/');
  const today = kstToday();

  const [profileRes, stagesRes, progressRes, chestsRes, owned, defs, stats] =
    await Promise.all([
      supabase
        .from('users')
        .select(OWN_PROFILE_SELECT)
        .eq('id', user.id)
        .single(),
      supabase
        .from('stages')
        .select(
          'id, world_id, order, title, theme_name, description, is_final, created_at, world:worlds(order), quests(id, order, quest_type)',
        ),
      supabase
        .from('user_progress')
        .select('quest_id, status, best_stars')
        .eq('user_id', user.id),
      supabase
        .from('coin_ledger')
        .select('ref')
        .eq('user_id', user.id)
        .eq('source', 'chest'),
      supabase
        .from('user_achievements')
        .select('achievement_id, achieved_at, claimed_at')
        .eq('user_id', user.id),
      supabase.from('achievements').select('id, name, icon, tier, sort'),
      createAdminClient().rpc('profile_stats', { p_user_id: user.id }),
    ]);
  if (stats.error)
    reportServerError(stats.error, { area: 'profile', op: 'profile_stats' });

  const profile = profileRes.data ? toOwnProfile(profileRes.data) : null;
  if (!profile) redirect('/');
  const raw = (stats.data as unknown as ProfileStatsRaw | null) ?? EMPTY_STATS;

  const progress = progressRes.data ?? [];
  const opened = new Set((chestsRes.data ?? []).map((c) => c.ref));
  const stages = getStageStatuses(stagesRes.data ?? [], progress).map((s) => ({
    ...s,
    chestOpened: opened.has(s.id),
  }));
  const completed = new Set(
    progress.filter((p) => p.status === 'completed').map((p) => p.quest_id),
  );

  // 업적: 도감과 같은 셈(숨김 업적도 "???" 칸으로 보이므로 전체에 넣음)
  const ownedRows = owned.data ?? [];
  const definitions = (defs.data ?? []) as Pick<
    Achievement,
    'id' | 'name' | 'icon' | 'tier' | 'sort'
  >[];
  const earnedIds = new Set(ownedRows.map((a) => a.achievement_id));

  return (
    <PageTransition className="mx-auto min-h-screen max-w-lg px-4 py-4 sm:py-6 md:max-w-4xl">
      <div className="pf">
        <div className="pf-top pf-wide">
          <Link href="/world" className="pf-back focus-ring">
            <ChevronLeft aria-hidden />
            월드맵
          </Link>
          <HudCounter kind="coin" value={profile.coins} />
        </div>

        <ProfileHero
          name={profile.name}
          skin={profile.skin}
          totalXp={profile.total_xp}
        />

        <ProfileCard
          title="학습 달력"
          icon={
            <CalendarDays className="size-5 text-primary-text" aria-hidden />
          }
          side={`지금 ${raw.streak}일 연속`}
          data-testid="profile-calendar"
        >
          <LearningCalendar
            today={today}
            days={raw.days}
            shieldDays={raw.shield_days}
            stampDays={raw.stamp_days}
          />
        </ProfileCard>

        <ProfileStatsCard raw={raw} />

        <AchievementsCard
          earned={definitions.filter((d) => earnedIds.has(d.id)).length}
          total={definitions.length}
          claimable={ownedRows.filter((a) => !a.claimed_at).length}
          recent={recentAchievements(definitions, ownedRows)}
        />

        <TreasureCard
          coins={profile.coins}
          coinsWeek={raw.coins_week}
          threeStars={raw.stats.three_stars}
          stages={stages.map((s) => ({
            id: s.id,
            order: s.order,
            title: s.title,
            stars: s.stars,
            maxStars: s.maxStars,
            chest: chestState(s),
            locked: s.status === 'locked',
          }))}
        />

        <div className="pf-wide">
          <AccountManagementSection
            stages={stages.map((s) => ({
              id: s.id,
              order: s.order,
              title: s.title,
              hasProgress: s.quests.some((q) => completed.has(q.id)),
            }))}
          />
        </div>

        <div className="pf-foot pf-wide">
          <Link
            href="/settings"
            className="text-sm text-primary-text underline"
          >
            설정 (움직임 · AI 튜터)
          </Link>
          <LogoutButton />
        </div>
      </div>
    </PageTransition>
  );
}
