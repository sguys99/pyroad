import 'server-only';

import type { SupabaseClient, UserIdentity } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import { deleteUserAnalytics } from '@/lib/analytics/server';
import { unlinkAllKakao, type UnlinkOutcome } from '@/lib/auth/providerUnlink';
import { reportServerError } from '@/lib/api/serverError';
import { purgeShareCards } from '@/lib/share-card/purge';

/**
 * 계정 삭제 한 곳 (B28·P3-16·P3-15): 탈퇴(`/api/account/delete`)와 미동의 계정 파기 크론(`/api/cron/purge-unconsented`)이 같이 쓴다.
 *
 * 1. provider 쪽 연결 끊기 — Auth 삭제 전에. Kakao 는 어드민 키로 identity 마다 unlink(실패·키 없음이어도 계속).
 *    Naver 는 토큰을 저장하지 않으므로 여기서 못 한다(탈퇴 화면의 재인증 폐기만, 크론 파기에서는 불가 — 런북에 기록)
 * 2. Auth 사용자 삭제 → public.users(ON DELETE CASCADE)와 그 사용자의 모든 행(진행·뱃지·퀴즈·공개 프로필·게시글·댓글·신고·
 *    API 키·요청 한도·약관 동의 기록)이 함께 지워짐. 새 테이블도 users 를 ON DELETE CASCADE 로 참조해야 함 (회귀 B28-1·2)
 * 3. 분석 이벤트(익명 ID = HMAC, users 를 참조하지 않음)를 따로 지움. 실패해도 삭제는 끝난 것으로 둠
 * 4. 자랑 카드 이미지의 CDN 사본(최대 90일 캐시)을 지움 (B77). 카드 id 는 CASCADE 로 사라지므로 Auth 삭제 전에 읽어 둔다.
 *    읽기·지우기 실패는 로그만 — 계정 삭제를 막지 않음(런북대로 손으로 지움)
 *
 * identities 를 주지 않으면 관리자 API 로 읽는다.
 */
export type DeleteAccountResult =
  | { ok: true; unlinked: { kakao: UnlinkOutcome } }
  | { ok: false; error: string };

export async function deleteUserAccount(
  admin: SupabaseClient<Database>,
  userId: string,
  identities?: UserIdentity[] | null,
): Promise<DeleteAccountResult> {
  let ids = identities ?? undefined;
  if (!ids) {
    const { data } = await admin.auth.admin.getUserById(userId);
    ids = data?.user?.identities;
  }
  const kakao = await unlinkAllKakao(ids);

  const cards = await admin
    .from('share_cards')
    .select('id')
    .eq('user_id', userId);
  if (cards.error)
    reportServerError(cards.error, {
      area: 'account',
      op: 'share cards before delete',
    });

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };

  await deleteUserAnalytics(admin, userId);
  await purgeShareCards((cards.data ?? []).map((c) => c.id));
  return { ok: true, unlinked: { kakao } };
}
