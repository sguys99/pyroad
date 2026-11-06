import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { TutorialReplay } from '@/components/onboarding/TutorialReplay';
import { loadOwnUserRow } from '@/lib/supabase/ownUserRow';
import { getAuthUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { skinFromAvatarConfig } from '@/lib/avatar/skins';

export const metadata: Metadata = { title: '30초 튜토리얼' };

/**
 * 30초 튜토리얼 다시 보기 (P3-11, 설정 화면 링크). 온보딩을 아직 안 마쳤으면 온보딩부터 (약관 동의를 건너뛰지 않게).
 * 끝나거나 건너뛰면 월드맵으로.
 */
export default async function TutorialPage() {
  const { user } = await getAuthUser();
  if (!user) redirect('/');
  const row = await loadOwnUserRow();
  if (row && row.onboardedAt === null) redirect('/onboarding');

  const supabase = await createClient();
  const { data } = await supabase
    .from('users')
    .select('avatar_config')
    .eq('id', user.id)
    .maybeSingle();
  return <TutorialReplay skin={skinFromAvatarConfig(data?.avatar_config)} />;
}
