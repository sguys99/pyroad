'use client';

import { m } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useGoogleLogin } from '@/lib/hooks/useGoogleLogin';
import { InAppBrowserGuide } from '@/components/InAppBrowserGuide';

export function LoginButton() {
  const { handleLogin, showBrowserGuide, setShowBrowserGuide, browserInfo } =
    useGoogleLogin();

  return (
    <>
      <m.div
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      >
        <Button size="lg" onClick={handleLogin}>
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
