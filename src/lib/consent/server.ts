import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import { createAdminClient } from '@/lib/supabase/admin';
import { reportServerError } from '@/lib/api/serverError';
import {
  GUARDIAN_REQUIRED_MESSAGE,
  consentStatus,
  isRestricted,
  type ConsentRow,
} from './status';

type Admin = SupabaseClient<Database>;

export const CONSENT_SELECT =
  'age_band, guardian_consented_at, consent_deadline';

/**
 * 제한 모드 서버 검사 (P3-15): 만 14세 미만 + 보호자 동의 전이면 다른 사람에게 보이는 쓰기(게시판 글·고치기·댓글)를 막는다(신고는 받음).
 * 게시판 쓰기는 모두 API Route → service_role 이라(③ 00015 이후 클라이언트 쓰기 권한 없음) 여기 한 곳에서 막으면 된다.
 * 앞으로 공유·갤러리 쓰기 API 도 같은 함수를 부른다.
 *
 * - 막히면 403 `{ error, code: 'guardian_consent' }` (아이용 문구)
 * - 사용자 id 는 `auth.getUser()`로 확인한 값만
 * - 조회가 실패하면 **막는다**(아동 보호 쪽). 단 00024 미적용(열 없음 42703)이면 지나간다 — 런북 순서상 생기지 않지만
 *   잘못된 순서로 배포해도 게시판 전체가 멈추지 않게
 */
export async function guardianWriteGate(
  userId: string,
  admin: Admin = createAdminClient(),
): Promise<Response | null> {
  const { data, error } = await admin
    .from('users')
    .select(CONSENT_SELECT)
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    if (error.code === '42703') return null;
    reportServerError(error, { area: 'consent', op: 'write gate' });
    return Response.json(
      {
        error: '앗, 지금은 확인하지 못했어요. 잠시 뒤에 다시 해 볼까요?',
        code: 'server',
      },
      { status: 503 },
    );
  }
  if (!data) return null;
  if (isRestricted(consentStatus(data as ConsentRow))) {
    return Response.json(
      { error: GUARDIAN_REQUIRED_MESSAGE, code: 'guardian_consent' },
      { status: 403 },
    );
  }
  return null;
}
