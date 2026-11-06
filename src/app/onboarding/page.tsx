import { redirect } from 'next/navigation';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { getAuthUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { reportServerError } from '@/lib/api/serverError';
import { nicknameSuggestionFromUser } from '@/lib/auth/normalizeProviderMetadata';
import { isSkinId } from '@/lib/avatar/skins';
import { checkNicknameRules } from '@/lib/profile/nicknameRules';
import { suggestNickname } from '@/lib/profile/nicknameSuggest';
import { formatKstDate } from '@/lib/time/kst';

/**
 * 첫 로그인 온보딩 (P3-11). 이미 마친 아이는 월드맵으로.
 *
 * 닉네임 입력칸의 처음 값 (서버에서 정해 넘김: 금칙어 검사를 화면 번들에 넣지 않으려고)
 * 1. 이미 정한 닉네임 (기존 사용자, P3-12)
 * 2. provider 가 준 닉네임 — 실명일 가능성이 없고 규칙·금칙어를 통과할 때만 (`nicknameSuggestionFromUser`, DB 에 저장하지 않음)
 * 3. 랜덤 추천 ("용감한여우")
 * 이미 고른 파이뱀 색·학년이 있으면 그대로 보여 준다.
 */
export default async function OnboardingPage() {
  const { user } = await getAuthUser();
  if (!user) redirect('/');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users')
    .select('nickname, grade, avatar_config, onboarded_at')
    .eq('id', user.id)
    .maybeSingle();
  if (error) reportServerError(error, { area: 'onboarding', op: 'load user' });
  if (data?.onboarded_at) redirect('/world');

  const existing = data?.nickname ? checkNicknameRules(data.nickname) : null;
  const initialNickname =
    (existing?.ok ? existing.nickname : null) ??
    nicknameSuggestionFromUser(user) ??
    suggestNickname();
  const skin =
    data?.avatar_config &&
    typeof data.avatar_config === 'object' &&
    !Array.isArray(data.avatar_config)
      ? (data.avatar_config as Record<string, unknown>).skin
      : undefined;

  return (
    <OnboardingFlow
      initialNickname={initialNickname}
      initialSkin={isSkinId(skin) ? skin : null}
      initialGrade={data?.grade ?? null}
      issuedOn={formatKstDate(new Date(), 'dot')}
    />
  );
}
