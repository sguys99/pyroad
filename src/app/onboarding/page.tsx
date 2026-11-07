import { redirect } from 'next/navigation';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { getAuthUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { reportServerError } from '@/lib/api/serverError';
import { nicknameSuggestionFromUser } from '@/lib/auth/normalizeProviderMetadata';
import { isSkinId } from '@/lib/avatar/skins';
import { validateNickname } from '@/lib/profile/nickname';
import { onboardingVariant } from '@/lib/onboarding/returning';
import { suggestNickname } from '@/lib/profile/nicknameSuggest';
import { formatKstDate } from '@/lib/time/kst';

/**
 * 첫 로그인 온보딩 (P3-11). 이미 마친 아이는 월드맵으로.
 * 온보딩 전에 가입해 학습한 기존 사용자(P3-12, `onboardingVariant`)는 같은 단계를 반가운 말로, 튜토리얼은 고를 수 있게.
 * 그 전까지 다른 친구에게는 공개 이름 "모험가1234"(자리표시자, 00013·00018)로 보인다. 학습 기록·경험치는 건드리지 않는다.
 *
 * 닉네임 입력칸의 처음 값 (서버에서 정해 넘김: 금칙어 검사를 화면 번들에 넣지 않으려고)
 * 1. 이미 정한 닉네임 (기존 사용자, P3-12) — 금칙어까지 다시 통과할 때만. 아니면 새로 추천하고 "새로 정해야 해" 안내
 * 2. provider 가 준 닉네임 — 실명일 가능성이 없고 규칙·금칙어를 통과할 때만 (`nicknameSuggestionFromUser`, DB 에 저장하지 않음)
 * 3. 랜덤 추천 ("용감한여우")
 * 이미 고른 파이뱀 색·학년이 있으면 그대로 보여 준다.
 */
export default async function OnboardingPage() {
  const { user } = await getAuthUser();
  if (!user) redirect('/');

  const supabase = await createClient();
  const [{ data, error }, progress] = await Promise.all([
    supabase
      .from('users')
      .select('nickname, grade, avatar_config, onboarded_at, total_xp')
      .eq('id', user.id)
      .maybeSingle(),
    // 기존 사용자 판별용 (P3-12): 행 수만, 내용은 읽지 않음
    supabase
      .from('user_progress')
      .select('quest_id', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ]);
  if (error) reportServerError(error, { area: 'onboarding', op: 'load user' });
  if (data?.onboarded_at) redirect('/world');

  const variant = onboardingVariant({
    totalXp: data?.total_xp,
    progressCount: progress.count,
    nickname: data?.nickname,
  });
  // 예전 닉네임은 금칙어까지 다시 검사 (서버라 금칙어 목록을 써도 화면 번들에 들어가지 않음)
  const existing = data?.nickname ? validateNickname(data.nickname) : null;
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
      variant={variant}
      previousNickname={existing ? (existing.ok ? 'kept' : 'rename') : null}
      totalXp={data?.total_xp ?? 0}
    />
  );
}
