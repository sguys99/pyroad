import type { User } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/supabase/auth';

/**
 * 관리자 판별 (B02, B37). 공지 쓰기·수정·삭제 API와 공지 화면의 관리자 메뉴가 씀.
 *
 * 1. `app_metadata.role === 'admin'` — app_metadata 는 service_role(SQL Editor·Admin API)만 바꿀 수 있음.
 *    `user_metadata` 는 사용자가 `auth.updateUser({ data })` 로 직접 바꿀 수 있으므로 절대 보지 않음.
 * 2. 이행 기간 폴백: `ADMIN_EMAIL` 과 같은 이메일 + 그 이메일이 확인된(`email_confirmed_at`) 계정.
 *    `email`·`email_confirmed_at` 은 GoTrue 만 씀(이메일 변경은 새 주소에서 확인해야 `email` 이 바뀜).
 *    provider 가 확인되지 않았다고 한 이메일은 `email_confirmed_at` 이 비어 있어 통과하지 못함.
 *    Kakao·Naver 계정은 이메일이 없으므로(§2.8) 1번으로만 관리자가 될 수 있음.
 *
 * 판별 대상은 `auth.getUser()` 결과(요청마다 Auth 서버에서 새로 읽음)여야 함. JWT 의 app_metadata 는
 * 토큰을 갱신하기 전까지 예전 값이라, role 을 바꾼 직후 판별이 늦거나(부여) 남을(회수) 수 있음.
 *
 * TODO(B37): 운영 관리자 계정에 role 을 설정하고 확인한 뒤(docs/release/v0.4-runbook.md "관리자 role 설정"),
 * v0.4 다음 릴리즈에서 2번 폴백과 `ADMIN_EMAIL` env(.env.example·Vercel)를 지움.
 */
export type AdminCandidate = Pick<User, 'app_metadata'> &
  Partial<Pick<User, 'email' | 'email_confirmed_at'>>;

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function isAdminUser(user: AdminCandidate | null | undefined): boolean {
  if (!user) return false;
  if (user.app_metadata?.role === 'admin') return true;

  // ↓ 이행 기간 폴백 (TODO(B37) 참고)
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  if (!adminEmail) return false;
  return !!user.email_confirmed_at && normalizeEmail(user.email) === adminEmail;
}

export async function isAdmin(): Promise<boolean> {
  const { user } = await getAuthUser();
  return isAdminUser(user);
}
