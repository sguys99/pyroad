import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GuardianConsentFlow } from '@/components/consent/GuardianConsentFlow';
import { loadOwnUserRow } from '@/lib/supabase/ownUserRow';
import { getAuthUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { skinFromAvatarConfig } from '@/lib/avatar/skins';
import { consentStatus } from '@/lib/consent/status';

export const metadata: Metadata = { title: '보호자 동의' };

/**
 * 나중에 보호자 동의 (P3-15, §12-Q35). 제한 모드(만 14세 미만 + 동의 전) 아이가 보호자와 함께 연다
 * (띠·게시판 안내·설정의 "보호자 동의하기"). 온보딩 전이면 온보딩부터, 동의가 필요 없으면(만 14세 이상·이미 동의) 월드맵으로.
 * 나이 확인 결과가 없는 계정(00024 전 온보딩)은 동의를 받을 수 없어(서버 not_under14) 월드맵으로 — 띠도 보이지 않음.
 */
export default async function GuardianConsentPage() {
  const { user } = await getAuthUser();
  if (!user) redirect('/');
  const row = await loadOwnUserRow();
  if (row && row.onboardedAt === null) redirect('/onboarding');
  const status = row?.consent ? consentStatus(row.consent) : null;
  if (
    !status ||
    status.state !== 'pending' ||
    row?.consent?.age_band !== 'under14'
  ) {
    redirect('/world');
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('users')
    .select('avatar_config, nickname')
    .eq('id', user.id)
    .maybeSingle();
  return (
    <GuardianConsentFlow
      skin={skinFromAvatarConfig(data?.avatar_config)}
      nickname={data?.nickname ?? null}
      daysLeft={status.daysLeft}
    />
  );
}
