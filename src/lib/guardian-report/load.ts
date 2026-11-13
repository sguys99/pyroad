import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { reportServerError } from '@/lib/api/serverError';
import {
  GUARDIAN_TOKEN,
  guardianReportSchema,
  type GuardianReport,
} from './report';

/**
 * 보호자 리포트 읽기 (P9-15). service_role `guardian_report`(00050)만: 토큰 해시 → 학생 → 집계.
 * null = 토큰 모양이 틀림·없음·꺼짐(모두 같은 404), 'error' = 조회 실패(던져서 500)
 */
export async function loadGuardianReport(
  token: string,
  week: 0 | 1,
): Promise<GuardianReport | null | 'error'> {
  if (!GUARDIAN_TOKEN.test(token)) return null;
  const { data, error } = await createAdminClient().rpc('guardian_report', {
    p_token: token,
    p_week: week,
  });
  if (error) {
    reportServerError(error, { area: 'guardian-report', op: 'read' });
    return 'error';
  }
  if (data === null) return null;
  const parsed = guardianReportSchema.safeParse(data);
  if (!parsed.success) {
    reportServerError(new Error('report shape'), {
      area: 'guardian-report',
      op: 'parse',
    });
    return 'error';
  }
  return parsed.data;
}
