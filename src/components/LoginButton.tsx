'use client';

import { Button } from '@/components/ui/button';
import { useSocialLogin } from '@/lib/hooks/useSocialLogin';
import { InAppBrowserGuide } from '@/components/InAppBrowserGuide';

interface LoginButtonProps {
  /** 로그인 흐름을 시작하기 직전에 부름 (예: 랜딩 CTA 분석 이벤트, P1-17) */
  onBeforeLogin?: () => void;
}

export function LoginButton({ onBeforeLogin }: LoginButtonProps = {}) {
  const { handleLogin, showBrowserGuide, setShowBrowserGuide, browserInfo } =
    useSocialLogin('google');

  return (
    <>
      {/* 눌림 피드백은 게임 버튼 자체 (아랫면 3px → jellyB 복귀, P2-11) */}
      <Button
        size="lg"
        onClick={() => {
          onBeforeLogin?.();
          void handleLogin();
        }}
      >
        Google로 시작하기 🚀
      </Button>

      {browserInfo && (
        <InAppBrowserGuide
          isOpen={showBrowserGuide}
          onClose={() => setShowBrowserGuide(false)}
          browserInfo={browserInfo}
        />
      )}
    </>
  );
}
