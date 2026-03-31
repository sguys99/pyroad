import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { LogoutButton } from '@/components/LogoutButton';

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data: profile } = await supabase
    .from('users')
    .select('display_name, avatar_url, total_xp, current_level')
    .eq('id', user.id)
    .single();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">프로필</h1>
      {profile && (
        <>
          {profile.avatar_url && (
            <img
              src={profile.avatar_url}
              alt="아바타"
              className="h-20 w-20 rounded-full"
            />
          )}
          <p className="text-lg font-bold">{profile.display_name}</p>
          <p className="text-foreground/70">
            Lv.{profile.current_level} · {profile.total_xp} XP
          </p>
        </>
      )}
      <LogoutButton />
    </main>
  );
}
