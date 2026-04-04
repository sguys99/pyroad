'use client';

import { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Copy, Check, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PybaemSvg } from '@/components/characters/PybaemSvg';
import type { InAppBrowserType } from '@/lib/browser/detectInAppBrowser';
import { openExternalBrowser } from '@/lib/browser/openExternalBrowser';
import type { InAppBrowserInfo } from '@/lib/browser/detectInAppBrowser';

interface InAppBrowserGuideProps {
  isOpen: boolean;
  onClose: () => void;
  browserInfo: InAppBrowserInfo;
}

export function InAppBrowserGuide({
  isOpen,
  onClose,
  browserInfo,
}: InAppBrowserGuideProps) {
  const [copied, setCopied] = useState(false);

  const handleOpenExternal = () => {
    openExternalBrowser(window.location.href, browserInfo);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const appName = getAppName(browserInfo.type);

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        >
          <m.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
          >
            <button
              onClick={onClose}
              className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col items-center gap-4 text-center">
              <PybaemSvg expression="surprised" size={80} />

              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-foreground">
                  앗! 이 브라우저에서는 로그인이 안 돼요
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {appName} 내부 브라우저에서는 Google 로그인이
                  <br />
                  지원되지 않아요. 외부 브라우저에서 열어주세요!
                </p>
              </div>

              <div className="flex w-full flex-col gap-2.5">
                <Button
                  size="lg"
                  onClick={handleOpenExternal}
                  className="w-full gap-2"
                >
                  <ExternalLink size={16} />
                  외부 브라우저로 열기
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleCopyUrl}
                  className="w-full gap-2"
                >
                  {copied ? (
                    <>
                      <Check size={16} className="text-green-500" />
                      복사 완료!
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      URL 복사하기
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground/70">
                Chrome 또는 Safari에서{' '}
                <span className="font-medium text-foreground">
                  pyroad.vercel.app
                </span>
                을 입력해도 돼요
              </p>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function getAppName(type: InAppBrowserType): string {
  switch (type) {
    case 'kakaotalk':
      return '카카오톡';
    case 'naver':
      return '네이버';
    case 'instagram':
      return '인스타그램';
    case 'facebook':
      return '페이스북';
    case 'line':
      return '라인';
    case 'band':
      return '밴드';
    default:
      return '앱';
  }
}
