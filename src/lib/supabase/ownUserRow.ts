import 'server-only';

import { cache } from 'react';
import { getAuthUser } from './auth';
import { createClient } from './server';
import { reportServerError } from '@/lib/api/serverError';

/**
 * 로그인 레이아웃이 요청마다 한 번 읽는 본인 `users` 행 (React cache, 페이지와 함께 1번).
 *
 * - `settings`: 움직임(P2-15)·사운드(P2-14) 설정
 * - `onboarded_at`: 첫 로그인 온보딩을 마쳤는지 (P3-11, 00023). NULL 이면 레이아웃이 `/onboarding`으로 보낸다
 *
 * ①(00023)을 아직 적용하지 않은 DB에서는 `onboarded_at` 열이 없어(42703) `settings`만 다시 읽고 `onboardedAt: undefined`
 * (= 모름 → 관문을 걸지 않음). 런북 순서(① 먼저)대로면 일어나지 않지만, 잘못된 순서로 배포해도 앱 전체가 막히지는 않게 한다.
 */
export interface OwnUserRow {
  settings: unknown;
  /** ISO 시각 · null(온보딩 전) · undefined(열 없음·조회 실패 = 모름) */
  onboardedAt: string | null | undefined;
}

export const loadOwnUserRow = cache(async (): Promise<OwnUserRow | null> => {
  const { user } = await getAuthUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users')
    .select('settings, onboarded_at')
    .eq('id', user.id)
    .maybeSingle();
  if (!error) {
    return data
      ? { settings: data.settings ?? null, onboardedAt: data.onboarded_at }
      : null;
  }
  if (error.code === '42703') {
    const retry = await supabase
      .from('users')
      .select('settings')
      .eq('id', user.id)
      .maybeSingle();
    if (!retry.error) {
      return retry.data
        ? { settings: retry.data.settings ?? null, onboardedAt: undefined }
        : null;
    }
  }
  reportServerError(error, { area: 'layout', op: 'load own user row' });
  return null;
});
