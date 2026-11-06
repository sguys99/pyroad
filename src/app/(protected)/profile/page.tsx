import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LogoutButton } from '@/components/LogoutButton';
import { getLevelTitle } from '@/lib/quest/xp';
import { BADGE_DEFINITIONS } from '@/lib/quest/badges';
import { XPProgressBar } from '@/components/shared/XPProgressBar';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { BadgeIcon } from '@/components/shared/BadgeIcon';
import { PageTransition } from '@/components/shared/PageTransition';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { OWN_PROFILE_SELECT, toOwnProfile } from '@/lib/avatar/ownProfile';
import { AccountManagementSection } from '@/components/profile/AccountManagementSection';
import { formatKstDate } from '@/lib/time/kst';
import { sortStages } from '@/lib/world/stageOrder';

export default async function ProfilePage() {
  const supabase = await createClient();

  // getAuthUser()와 user.id 불필요한 stages 쿼리를 병렬 실행
  const [{ user }, stagesResult] = await Promise.all([
    getAuthUser(),
    // 순서는 (월드 order, 스테이지 order) — 아래 sortStages (P1-08)
    supabase
      .from('stages')
      .select('id, order, title, world:worlds(order), quests(id)'),
  ]);
  if (!user) redirect('/');

  // user.id 필요한 쿼리는 이후 병렬 실행
  const [profileResult, progressResult, badgesResult] = await Promise.all([
    supabase
      .from('users')
      .select(OWN_PROFILE_SELECT)
      .eq('id', user.id)
      .single(),
    supabase
      .from('user_progress')
      .select('quest_id, status')
      .eq('user_id', user.id)
      .eq('status', 'completed'),
    supabase
      .from('user_badges')
      .select('badge_type, earned_at')
      .eq('user_id', user.id),
  ]);

  const profile = profileResult.data ? toOwnProfile(profileResult.data) : null;
  const progress = progressResult.data ?? [];
  const stages = sortStages(stagesResult.data ?? []);
  const badges = badgesResult.data ?? [];

  if (!profile) redirect('/');

  const title = getLevelTitle(profile.current_level);
  const earnedTypes = new Set(badges.map((b) => b.badge_type));
  const completedQuestIds = new Set(
    progress.filter((p) => p.status === 'completed').map((p) => p.quest_id),
  );
  const totalQuests = stages.reduce(
    (sum, s) => sum + ((s.quests as { id: string }[])?.length ?? 0),
    0,
  );
  const totalCompleted = completedQuestIds.size;

  return (
    <PageTransition className="mx-auto min-h-screen max-w-lg px-4 py-6">
      {/* 뒤로가기 */}
      <div className="mb-6">
        <Link href="/world" className="text-sm text-primary-text underline">
          ← 월드맵으로
        </Link>
      </div>

      {/* 헤더 */}
      <div className="mb-6 flex flex-col items-center gap-3">
        {/* 내 파이뱀 (공개 아바타, 게시판과 같은 모습). 이름은 아래 글자로 */}
        <UserAvatar skin={profile.skin} size={96} />
        <h1 className="text-xl font-bold text-foreground">{profile.name}</h1>
        <p className="text-muted-foreground">
          Lv.{profile.current_level} {title}
        </p>
      </div>

      {/* XP 프로그레스 카드 */}
      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-bold text-foreground">경험치</h2>
        <XPProgressBar totalXP={profile.total_xp} size="md" />
        <p className="mt-2 text-center text-lg font-bold text-primary-text">
          {profile.total_xp} XP
        </p>
      </Card>

      {/* 뱃지 컬렉션 카드 */}
      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-bold text-foreground">뱃지 컬렉션</h2>
        <div className="grid grid-cols-5 gap-3">
          {BADGE_DEFINITIONS.map((badge) => {
            const earned = earnedTypes.has(badge.type);
            const badgeData = badges.find((b) => b.badge_type === badge.type);
            return (
              <div
                key={badge.type}
                className="flex flex-col items-center gap-1"
              >
                <BadgeIcon type={badge.type} earned={earned} size="lg" />
                <p
                  className={`text-xs font-medium ${earned ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {badge.name}
                </p>
                {earned && badgeData && (
                  <p className="text-[10px] text-muted-foreground">
                    {formatKstDate(badgeData.earned_at, 'dot')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* 스테이지 진행률 카드 */}
      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-bold text-foreground">
          스테이지 진행률
        </h2>
        <div className="flex flex-col gap-3">
          {stages.map((stage) => {
            const quests = (stage.quests as { id: string }[]) ?? [];
            const completed = quests.filter((q) =>
              completedQuestIds.has(q.id),
            ).length;
            return (
              <div key={stage.id}>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {stage.order}. {stage.title}
                  </span>
                  <span>
                    {completed}/{quests.length} 퀘스트
                  </span>
                </div>
                <ProgressBar
                  value={completed}
                  max={Math.max(1, quests.length)}
                  size="sm"
                  label={`${stage.order}단계 ${stage.title} 진행률`}
                  valueText={`퀘스트 ${completed}개 / ${quests.length}개`}
                  className="mt-1"
                />
              </div>
            );
          })}
        </div>
      </Card>

      {/* 통계 요약 */}
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-bold text-foreground">통계</h2>
        <div className="grid grid-cols-3 gap-2 text-center sm:gap-4">
          <div>
            <p className="text-xl font-bold text-primary-text sm:text-2xl">
              {totalCompleted}
            </p>
            <p className="text-[10px] text-muted-foreground sm:text-xs">
              완료 퀘스트
            </p>
          </div>
          <div>
            <p className="text-xl font-bold text-primary-text sm:text-2xl">
              {totalQuests}
            </p>
            <p className="text-[10px] text-muted-foreground sm:text-xs">
              전체 퀘스트
            </p>
          </div>
          <div>
            <p className="text-xl font-bold text-primary-text sm:text-2xl">
              {badges.length}
            </p>
            <p className="text-[10px] text-muted-foreground sm:text-xs">
              획득 뱃지
            </p>
          </div>
        </div>
      </Card>

      {/* 계정 관리 */}
      <AccountManagementSection
        stages={stages.map((s) => {
          const quests = (s.quests as { id: string }[]) ?? [];
          const hasProgress = quests.some((q) => completedQuestIds.has(q.id));
          return { id: s.id, order: s.order, title: s.title, hasProgress };
        })}
      />

      {/* 설정 / 로그아웃 */}
      <div className="mt-6 flex flex-col items-center gap-3">
        <Link href="/settings" className="text-sm text-primary-text underline">
          설정 (움직임 · AI 튜터)
        </Link>
        <LogoutButton />
      </div>
    </PageTransition>
  );
}
