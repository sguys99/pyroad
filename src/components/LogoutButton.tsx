'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <button
      onClick={handleLogout}
      aria-label="로그아웃"
      className="inline-flex items-center gap-0.5 sm:gap-1.5 rounded-full bg-destructive/10 px-2 sm:px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">로그아웃</span>
    </button>
  );
}
