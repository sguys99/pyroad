import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LogoutButton } from '@/components/LogoutButton';
import { getLevelTitle } from '@/lib/quest/xp';
import { BADGE_DEFINITIONS } from '@/lib/quest/badges';
import { XPProgressBar } from '@/components/shared/XPProgressBar';
import { BadgeIcon } from '@/components/shared/BadgeIcon';
import { PageTransition } from '@/components/shared/PageTransition';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const [profileResult, progressResult, stagesResult, badgesResult] =
    await Promise.all([
      supabase
        .from('users')
        .select('id, display_name, avatar_url, total_xp, current_level')
        .eq('id', user.id)
        .single(),
      supabase
        .from('user_progress')
        .select('quest_id, status')
        .eq('user_id', user.id),
      supabase
        .from('stages')
        .select('id, order, title, quests(id)')
        .order('order', { ascending: true }),
      supabase
        .from('user_badges')
        .select('badge_type, earned_at')
        .eq('user_id', user.id),
    ]);

  const profile = profileResult.data;
  const progress = progressResult.data ?? [];
  const stages = stagesResult.data ?? [];
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
        <Link href="/world" className="text-sm text-primary underline">
          ← 월드맵으로
        </Link>
      </div>

      {/* 헤더 */}
      <div className="mb-6 flex flex-col items-center gap-3">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt="아바타"
            className="h-24 w-24 rounded-full"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/20">
            <CharacterAvatar character="pybaem" expression="happy" size="lg" animated />
          </div>
        )}
        <p className="text-xl font-bold text-foreground">
          {profile.display_name}
        </p>
        <p className="text-muted-foreground">
          Lv.{profile.current_level} {title}
        </p>
      </div>

      {/* XP 프로그레스 카드 */}
      <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-foreground">경험치</h2>
        <XPProgressBar totalXP={profile.total_xp} size="md" />
        <p className="mt-2 text-center text-lg font-bold text-primary">
          {profile.total_xp} XP
        </p>
      </div>

      {/* 뱃지 컬렉션 카드 */}
      <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-foreground">
          뱃지 컬렉션
        </h2>
        <div className="grid grid-cols-5 gap-3">
          {BADGE_DEFINITIONS.map((badge) => {
            const earned = earnedTypes.has(badge.type);
            const badgeData = badges.find((b) => b.badge_type === badge.type);
            return (
              <div key={badge.type} className="flex flex-col items-center gap-1">
                <BadgeIcon type={badge.type} earned={earned} size="lg" />
                <p
                  className={`text-xs font-medium ${earned ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {badge.name}
                </p>
                {earned && badgeData && (
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(badgeData.earned_at).toLocaleDateString('ko-KR')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 스테이지 진행률 카드 */}
      <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-foreground">
          스테이지 진행률
        </h2>
        <div className="flex flex-col gap-3">
          {stages.map((stage) => {
            const quests = (stage.quests as { id: string }[]) ?? [];
            const completed = quests.filter((q) =>
              completedQuestIds.has(q.id),
            ).length;
            const percent =
              quests.length > 0
                ? Math.round((completed / quests.length) * 100)
                : 0;
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
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className={`h-full rounded-full transition-all ${
                      percent === 100 ? 'bg-primary' : percent > 0 ? 'bg-primary/60' : 'bg-border'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 통계 요약 */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-foreground">통계</h2>
        <div className="grid grid-cols-3 gap-2 text-center sm:gap-4">
          <div>
            <p className="text-xl font-bold text-primary sm:text-2xl">{totalCompleted}</p>
            <p className="text-[10px] text-muted-foreground sm:text-xs">완료 퀘스트</p>
          </div>
          <div>
            <p className="text-xl font-bold text-primary sm:text-2xl">{totalQuests}</p>
            <p className="text-[10px] text-muted-foreground sm:text-xs">전체 퀘스트</p>
          </div>
          <div>
            <p className="text-xl font-bold text-primary sm:text-2xl">
              {badges.length}
            </p>
            <p className="text-[10px] text-muted-foreground sm:text-xs">획득 뱃지</p>
          </div>
        </div>
      </div>

      {/* 설정 / 로그아웃 */}
      <div className="flex flex-col items-center gap-3">
        <Link href="/settings" className="text-sm text-primary underline">
          AI 튜터 설정
        </Link>
        <LogoutButton />
      </div>
    </PageTransition>
  );
}
