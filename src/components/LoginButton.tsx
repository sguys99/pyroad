'use client';

import { m } from 'framer-motion';
import { framerSpring, jelly } from '@/lib/motion/tokens';
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
      <m.div
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={framerSpring(jelly())}
      >
        <Button
          size="lg"
          onClick={() => {
            onBeforeLogin?.();
            void handleLogin();
          }}
        >
          Google로 시작하기 🚀
        </Button>
      </m.div>

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
