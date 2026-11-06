import 'server-only';

import { cache } from 'react';
import { getAuthUser } from './auth';
import { createClient } from './server';
import { reportServerError } from '@/lib/api/serverError';
import type { ConsentRow } from '@/lib/consent/status';

/**
 * 로그인 레이아웃이 요청마다 한 번 읽는 본인 `users` 행 (React cache, 페이지와 함께 1번).
 *
 * - `settings`: 움직임(P2-15)·사운드(P2-14) 설정
 * - `onboarded_at`: 첫 로그인 온보딩을 마쳤는지 (P3-11, 00023). NULL 이면 레이아웃이 `/onboarding`으로 보낸다
 * - 나이 확인·보호자 동의 (P3-15, 00024): 제한 모드·파기 기한 안내
 *
 * 마이그레이션이 덜 적용된 DB(열 없음 42703)에서는 더 적은 열로 다시 읽고 모르는 값은 `undefined`(= 모름 → 관문·띠를 걸지 않음).
 * 런북 순서(① 먼저)대로면 일어나지 않지만, 잘못된 순서로 배포해도 앱 전체가 막히지는 않게 한다.
 */
export interface OwnUserRow {
  settings: unknown;
  /** ISO 시각 · null(온보딩 전) · undefined(열 없음·조회 실패 = 모름) */
  onboardedAt: string | null | undefined;
  /** 나이 확인·보호자 동의 열 (undefined = 00024 미적용) */
  consent: ConsentRow | undefined;
}

const SELECTS = [
  'settings, onboarded_at, age_band, guardian_consented_at, consent_deadline',
  'settings, onboarded_at',
  'settings',
] as const;

type Row = {
  settings?: unknown;
  onboarded_at?: string | null;
  age_band?: string | null;
  guardian_consented_at?: string | null;
  consent_deadline?: string | null;
};

export const loadOwnUserRow = cache(async (): Promise<OwnUserRow | null> => {
  const { user } = await getAuthUser();
  if (!user) return null;
  const supabase = await createClient();
  let lastError: unknown = null;
  for (const select of SELECTS) {
    const { data, error } = await supabase
      .from('users')
      .select(select)
      .eq('id', user.id)
      .maybeSingle();
    if (!error) {
      if (!data) return null;
      const row = data as Row;
      return {
        settings: row.settings ?? null,
        onboardedAt: 'onboarded_at' in row ? row.onboarded_at : undefined,
        consent:
          'age_band' in row
            ? {
                age_band: row.age_band ?? null,
                guardian_consented_at: row.guardian_consented_at ?? null,
                consent_deadline: row.consent_deadline ?? null,
              }
            : undefined,
      };
    }
    lastError = error;
    if (error.code !== '42703') break;
  }
  reportServerError(lastError, { area: 'layout', op: 'load own user row' });
  return null;
});
