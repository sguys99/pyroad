'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/sheet';
import { PybaemSvg } from '@/components/characters/PybaemSvg';
import type { InAppBrowserType } from '@/lib/browser/detectInAppBrowser';
import { openExternalBrowser } from '@/lib/browser/openExternalBrowser';
import type { InAppBrowserInfo } from '@/lib/browser/detectInAppBrowser';

interface InAppBrowserGuideProps {
  isOpen: boolean;
  onClose: () => void;
  browserInfo: InAppBrowserInfo;
}

/**
 * 인앱 브라우저에서 **Google 로그인**을 누르면 보이는 안내 (B16).
 * Google만 웹뷰 OAuth를 막으므로(`disallowed_useragent`) Google 전용입니다.
 * 카카오·네이버 로그인은 인앱에서 그대로 진행하므로 이 안내를 띄우지 않습니다(`needsExternalBrowser`).
 */
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
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      media={<PybaemSvg expression="surprised" size={80} />}
      align="center"
      title="앗! 여기서는 Google 로그인이 안 돼요"
      description={
        <>
          {appName} 안에서 열린 화면에서는 Google 로그인을
          <br />할 수 없어요. 외부 브라우저에서 열어 주세요!
        </>
      }
      className="max-w-sm"
    >
      <div className="flex w-full flex-col gap-2.5">
        <Button
          size="lg"
          onClick={handleOpenExternal}
          icon={<ExternalLink aria-hidden />}
          className="w-full"
        >
          외부 브라우저로 열기
        </Button>

        <Button
          variant="secondary"
          size="lg"
          onClick={handleCopyUrl}
          icon={
            copied ? (
              <Check aria-hidden className="text-primary-text" />
            ) : (
              <Copy aria-hidden />
            )
          }
          className="w-full"
        >
          {copied ? '복사 완료!' : 'URL 복사하기'}
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground/70">
        Chrome 또는 Safari에서{' '}
        <span className="font-medium text-foreground">pyroad.vercel.app</span>을
        입력해도 돼요
      </p>
    </Modal>
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
