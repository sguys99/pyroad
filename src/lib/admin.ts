import { getAuthUser } from '@/lib/supabase/auth';

/** ADMIN_EMAIL이 설정되지 않았거나 이메일이 없는 계정은 관리자가 아님 */
export function isAdminUser(user: { email?: string | null } | null): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  return !!adminEmail && !!user?.email && user.email === adminEmail;
}

export async function isAdmin(): Promise<boolean> {
  const { user } = await getAuthUser();
  return isAdminUser(user);
}
