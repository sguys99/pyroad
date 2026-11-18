import type { User } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/supabase/auth';

/**
 * 관리자 판별 (B02, B37). 공지 쓰기·수정·삭제 API와 공지 화면의 관리자 메뉴, 작품 숨김, 파기 크론의 관리자 건너뛰기가 씀.
 *
 * `app_metadata.role === 'admin'` 만 본다 — app_metadata 는 service_role(SQL Editor·Admin API)만 바꿀 수 있음.
 * `user_metadata` 는 사용자가 `auth.updateUser({ data })` 로 직접 바꿀 수 있으므로 절대 보지 않음.
 * 이메일 비교(`ADMIN_EMAIL` 이행 폴백)는 v1.0 에서 지움 (B119, P12-05 L1) — 운영 관리자 role 확인은 docs/release/v1.0-runbook.md.
 *
 * 판별 대상은 `auth.getUser()` 결과(요청마다 Auth 서버에서 새로 읽음)여야 함. JWT 의 app_metadata 는
 * 토큰을 갱신하기 전까지 예전 값이라, role 을 바꾼 직후 판별이 늦거나(부여) 남을(회수) 수 있음.
 */
export type AdminCandidate = Pick<User, 'app_metadata'>;

export function isAdminUser(user: AdminCandidate | null | undefined): boolean {
  return user?.app_metadata?.role === 'admin';
}

export async function isAdmin(): Promise<boolean> {
  const { user } = await getAuthUser();
  return isAdminUser(user);
}
