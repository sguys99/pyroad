import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { reportServerError } from '@/lib/api/serverError';
import type { MonitoringSummary, RangeDays } from './metrics';

/** 운영 지표 읽기 (P12-09). 개인 단위 값은 받지 않는다(합계만). 화면은 `src/app/admin/page.tsx` */
export type LoadResult = { ok: true; data: MonitoringSummary } | { ok: false };

/** service_role 로 집계를 읽는다. 호출 전에 반드시 `isAdminUser` 확인 (페이지가 함) */
export async function loadMonitoringSummary(
  days: RangeDays,
): Promise<LoadResult> {
  const { data, error } = await createAdminClient().rpc('monitoring_summary', {
    p_days: days,
  });
  if (error || !data || typeof data !== 'object') {
    if (error) reportServerError(error, { area: 'monitoring', op: 'summary' });
    return { ok: false };
  }
  return { ok: true, data: data as unknown as MonitoringSummary };
}

/** Sentry 이슈 목록 주소. `SENTRY_ORG`(소스맵 올리기용, 이미 있는 env)가 있을 때만 */
export function sentryIssuesUrl(
  org: string | undefined = process.env.SENTRY_ORG,
): string | null {
  const o = org?.trim();
  if (!o || !/^[a-z0-9-]+$/i.test(o)) return null;
  return `https://${o}.sentry.io/issues/?statsPeriod=24h`;
}
