import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getStageStatuses } from '@/lib/world/getStageStatuses';
import { getAvailableProviders } from '@/lib/tutor/providers/factory';
import { WorldMap } from '@/components/world/WorldMap';
import { ProfileSummary } from '@/components/world/ProfileSummary';
import { ApiKeyAlert } from '@/components/world/ApiKeyAlert';
import { MapBackground } from '@/components/world/MapBackground';
import { PageTransition } from '@/components/shared/PageTransition';
import { LogoutButton } from '@/components/LogoutButton';
import { User, MessageSquare } from 'lucide-react';
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
        .select('id, order, title, theme_name, description, is_final, created_at, quests(id, order)')
        .order('order', { ascending: true }),
      supabase
        .from('user_progress')
        .select('quest_id, status')
        .eq('user_id', user.id),
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
    <PageTransition className="mx-auto min-h-screen max-w-2xl px-4 py-6">
      <div className="relative z-10 mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">모험 지도</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/board"
            aria-label="게시판"
            className="inline-flex items-center gap-0.5 sm:gap-1.5 rounded-full bg-primary/10 px-2 sm:px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">게시판</span>
          </Link>
          <Link
            href="/profile"
            aria-label="내 프로필"
            className="inline-flex items-center gap-0.5 sm:gap-1.5 rounded-full bg-primary/10 px-2 sm:px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">내 프로필</span>
          </Link>
          <LogoutButton />
        </div>
      </div>

      {!hasAnyApiKey && <div className="relative z-10"><ApiKeyAlert /></div>}

      {profile && (
        <div className="relative z-10 mb-6">
          <ProfileSummary profile={profile} badges={badges} />
        </div>
      )}

      <MapBackground className="rounded-2xl overflow-hidden">
        <WorldMap stages={stagesWithStatus} />
      </MapBackground>
    </PageTransition>
  );
}
