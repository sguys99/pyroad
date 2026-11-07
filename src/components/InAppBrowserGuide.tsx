'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/sheet';
import { PybaemSvg } from '@/components/characters/PybaemSvg';
import { SocialLoginButton } from '@/components/auth/SocialLoginButton';
import { cn } from '@/lib/utils';
import type { InAppBrowserType } from '@/lib/browser/detectInAppBrowser';
import { openExternalBrowser } from '@/lib/browser/openExternalBrowser';
import type { InAppBrowserInfo } from '@/lib/browser/detectInAppBrowser';
import type { SocialProvider } from '@/lib/auth/socialLogin';

interface InAppBrowserGuideProps {
  isOpen: boolean;
  onClose: () => void;
  browserInfo: InAppBrowserInfo;
  /** 막힌 로그인 수단. 지금은 Google만 웹뷰 OAuth를 막는다(`needsExternalBrowser`) */
  provider?: SocialProvider;
  /**
   * 이 앱 안에서 바로 되는 다른 수단 (P3-09): 카카오톡이면 카카오, 네이버 인앱도 되는 네이버.
   * 누르면 안내를 닫고 그 수단으로 로그인한다(`onAlternative`)
   */
  alternatives?: readonly SocialProvider[];
  onAlternative?: (provider: SocialProvider) => void;
  /** 상자에 더할 클래스. 랜딩은 텍스트 서브셋 글꼴 변수를 넘긴다(대화 상자는 body로 포털됨) */
  className?: string;
}

/** provider별 문구 (P3-09). 이름과 막는 이유 */
const BLOCKED: Record<SocialProvider, { name: string; reason: string }> = {
  google: {
    name: 'Google',
    reason: 'Google은 앱 안에서 열린 화면에서는 로그인을 막아요.',
  },
  kakao: { name: '카카오', reason: '이 앱 안에서는 카카오 로그인이 안 돼요.' },
  naver: { name: '네이버', reason: '이 앱 안에서는 네이버 로그인이 안 돼요.' },
};

/**
 * 인앱 브라우저에서 막힌 로그인을 눌렀을 때의 안내 (B16 → P3-09). 지금은 **Google**만 해당한다(웹뷰 OAuth 차단 `disallowed_useragent`).
 * 카카오·네이버 로그인은 인앱에서 그대로 진행하므로 이 안내를 띄우지 않는다.
 *
 * - 외부 브라우저로 열기(카카오톡·네이버·Android 앱) 또는 주소 복사 + "브라우저에서 로그인을 한 번 더 눌러 줘"
 * - 이 앱 안에서 바로 되는 다른 수단이 있으면(카카오톡 → 카카오) 그 버튼을 함께 보여 준다
 */
export function InAppBrowserGuide({
  isOpen,
  onClose,
  browserInfo,
  provider = 'google',
  alternatives = [],
  onAlternative,
  className,
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
  const blocked = BLOCKED[provider];
  const others = alternatives.filter((p) => p !== provider);

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      media={<PybaemSvg expression="surprised" size={80} />}
      align="center"
      title={
        <span className="block text-balance">
          앗! 여기서는 {blocked.name} 로그인이 안 돼요
        </span>
      }
      description={
        <span className="block text-balance">
          {appName} 안에서 열린 화면이라 그래요. {blocked.reason} 브라우저에서
          열고 로그인을 한 번 더 눌러 줘!
        </span>
      }
      className={cn('max-w-sm font-sans', className)}
      data-testid="inapp-guide"
    >
      <div className="flex w-full flex-col gap-2.5">
        <Button
          size="lg"
          onClick={handleOpenExternal}
          icon={<ExternalLink aria-hidden />}
          className="w-full"
        >
          브라우저에서 열기
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
          {copied ? '복사 완료!' : '주소 복사하기'}
        </Button>
      </div>

      <p className="text-center text-caption text-muted-foreground">
        Chrome 또는 Safari에서{' '}
        <span className="font-medium text-foreground">pyroad.vercel.app</span>을
        입력해도 돼요
      </p>

      {others.length > 0 && onAlternative && (
        <div className="grid gap-2.5 border-t border-border pt-4">
          <p className="text-center text-small font-semibold text-foreground">
            {appName} 안에서 바로 되는 방법도 있어요
          </p>
          {others.map((p) => (
            <SocialLoginButton
              key={p}
              provider={p}
              onClick={() => onAlternative(p)}
              data-testid={`inapp-guide-${p}`}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}

function getAppName(type: InAppBrowserType): string {
  switch (type) {
    case 'kakaotalk':
      return '카카오톡';
    case 'naver':
      return '네이버 앱';
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
