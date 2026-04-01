import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getStageStatuses } from '@/lib/world/getStageStatuses';
import { WorldMap } from '@/components/world/WorldMap';
import { ProfileSummary } from '@/components/world/ProfileSummary';
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
        .select('id, display_name, avatar_url, total_xp, current_level')
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

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">모험 지도</h1>
        <Link
          href="/profile"
          className="text-sm text-primary underline"
        >
          내 프로필
        </Link>
      </div>

      {profile && (
        <div className="mb-6">
          <ProfileSummary profile={profile} badges={badges} />
        </div>
      )}

      <WorldMap stages={stagesWithStatus} />
    </main>
  );
}
