import { getAuthUser } from '@/lib/supabase/auth';

export async function isAdmin(): Promise<boolean> {
  const { user } = await getAuthUser();
  if (!user) return false;
  return user.email === process.env.ADMIN_EMAIL;
}
