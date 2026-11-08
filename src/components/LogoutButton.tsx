'use client';

import { useState } from 'react';
import { loadBrowserClient } from '@/lib/supabase/loadClient';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Modal, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { readSharedDevice } from '@/lib/auth/sharedDevice';
import { loginProviderFromUser } from '@/lib/auth/loginProvider';
import type { SocialProvider } from '@/lib/auth/socialLogin';

const SITE_NAME: Record<SocialProvider, string> = {
  kakao: '카카오',
  naver: '네이버',
  google: 'Google',
};

/**
 * 공용 기기 로그아웃 안내 문장 (P4-09, §12-Q44). pyRoad 로그아웃은 provider 사이트 로그인을 지우지 못한다
 * (네이버는 로그아웃 API가 없음). 어느 수단으로 들어왔는지 알면 그 이름, 모르면 셋 다
 */
export function sharedLogoutMessage(provider: SocialProvider | null): string {
  const site = provider
    ? `${SITE_NAME[provider]} 사이트`
    : '카카오·네이버·Google 사이트';
  return `pyRoad에서는 나왔어. 학교·도서관 컴퓨터라면 브라우저에서 ${site}에도 들어가서 로그아웃해 줘. 그래야 다음 친구가 내 계정으로 들어오지 못해!`;
}

export function LogoutButton() {
  const router = useRouter();
  // 공용 기기 모드였으면 로그아웃 뒤 안내를 띄우고, 닫으면 처음 화면으로
  const [sharedNotice, setSharedNotice] = useState<{
    provider: SocialProvider | null;
  } | null>(null);

  const handleLogout = async () => {
    const supabase = await loadBrowserClient();
    const shared = readSharedDevice();
    let provider: SocialProvider | null = null;
    if (shared) {
      try {
        const { data } = await supabase.auth.getUser();
        provider = loginProviderFromUser(data.user);
      } catch {
        // 모르면 셋 다 안내
      }
    }
    await supabase.auth.signOut();
    if (shared) setSharedNotice({ provider });
    else router.push('/');
  };

  return (
    <>
      <button
        onClick={handleLogout}
        aria-label="로그아웃"
        className="inline-flex items-center gap-0.5 sm:gap-1.5 rounded-full bg-error-soft px-2 sm:px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">로그아웃</span>
      </button>
      {sharedNotice && (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open) router.push('/');
          }}
          title="로그아웃했어!"
          description={sharedLogoutMessage(sharedNotice.provider)}
          showClose={false}
          footer={
            <SheetClose render={<Button data-testid="shared-logout-ok" />}>
              알겠어
            </SheetClose>
          }
          data-testid="shared-logout-notice"
        />
      )}
    </>
  );
}
