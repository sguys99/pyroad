import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getStageStatuses } from '@/lib/world/getStageStatuses';
import { getAvailableProviders } from '@/lib/tutor/providers/factory';
import { WorldMap } from '@/components/world/WorldMap';
import { ProfileSummary } from '@/components/world/ProfileSummary';
import { ApiKeyAlert } from '@/components/world/ApiKeyAlert';
import { PageTransition } from '@/components/shared/PageTransition';
import type { UserProfile } from '@/lib/types/database';

export default async function WorldPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const [stagesResult, progressResult, profileResult, badgesResult] =
    await Promise.all([
      supabase
        .from('stages')
        .select('*, quests(*)')
        .order('order', { ascending: true }),
      supabase.from('user_progress').select('*').eq('user_id', user.id),
      supabase
        .from('users')
        .select('id, display_name, avatar_url, total_xp, current_level, custom_api_keys')
        .eq('id', user.id)
        .single(),
      supabase
        .from('user_badges')
        .select('badge_type, earned_at')
        .eq('user_id', user.id),
    ]);

  const stages = stagesResult.data ?? [];
  const progress = progressResult.data ?? [];
  const profile = profileResult.data as UserProfile | null;
  const badges = badgesResult.data ?? [];

  const stagesWithStatus = getStageStatuses(stages, progress);

  // API 키 상태 확인: 서버 env 키 + 사용자 커스텀 키
  const serverProviders = getAvailableProviders();
  const userKeys = (profileResult.data as Record<string, unknown>)?.custom_api_keys as Record<string, string> | undefined;
  const hasAnyApiKey = serverProviders.length > 0 ||
    (userKeys && Object.values(userKeys).some((k) => !!k));

  return (
    <PageTransition className="mx-auto min-h-screen max-w-lg px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">모험 지도</h1>
        <Link
          href="/profile"
          className="text-sm text-primary underline"
        >
          내 프로필
        </Link>
      </div>

      {!hasAnyApiKey && <ApiKeyAlert />}

      {profile && (
        <div className="mb-6">
          <ProfileSummary profile={profile} badges={badges} />
        </div>
      )}

      <WorldMap stages={stagesWithStatus} />
    </PageTransition>
  );
}
