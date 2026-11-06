'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SocialProvider } from '@/lib/auth/socialLogin';
import {
  useSocialLogin,
  type SocialLoginResult,
} from '@/lib/hooks/useSocialLogin';
import { InAppBrowserGuide } from '@/components/InAppBrowserGuide';
import { SocialLoginButton } from './SocialLoginButton';
import { SOCIAL_PENDING } from './brandMarks';

/** 기본 순서: 카카오(카카오톡 인앱 사용자가 가장 많음) → 네이버 → Google. P3-09에서 인앱·최근 로그인에 따라 바꾼다 */
export const DEFAULT_SOCIAL_ORDER: readonly SocialProvider[] = [
  'kakao',
  'naver',
  'google',
];

const ERROR_TEXT = '앗, 로그인을 시작하지 못했어요. 잠시 뒤에 다시 눌러 줘!';

export interface SocialLoginButtonsProps {
  /** 보일 provider와 순서 (기본 카카오 → 네이버 → Google) */
  providers?: readonly SocialProvider[];
  /** 로그인 흐름을 시작하기 직전 (예: 랜딩 CTA 분석 이벤트 `landing_cta_click`, P1-17) */
  onBeforeLogin?: (provider: SocialProvider) => void;
  /**
   * 카탈로그·미리 보기용: 실제 로그인 대신 이 함수를 부른다(바쁨·오류 표시 확인).
   * 앱에서는 주지 않는다 → `useSocialLogin(provider).handleLogin()`
   */
  preview?: (provider: SocialProvider) => Promise<SocialLoginResult>;
  className?: string;
}

/**
 * 소셜 로그인 버튼 묶음 (P3-05). 로그인 호출은 provider마다 `useSocialLogin(provider)`(P1-14 헬퍼)로만 한다.
 *
 * - 하나를 누르면 그 버튼은 바쁨(`aria-busy` + 바쁨 표시), 나머지는 비활성 → 두 번 눌림·동시 로그인 없음
 * - 결과가 `error`면 버튼을 되살리고 아래에 오류 문구(`role="alert"`), 외부 브라우저·안내 모달이면 바로 되살림
 * - provider 화면에서 뒤로 가기로 돌아오면(bfcache `pageshow`) 바쁨을 푼다
 * - Google은 인앱 브라우저에서 외부 브라우저로 보내고, 안 되면 `InAppBrowserGuide`를 띄운다(B16, P3-09에서 갱신)
 */
export function SocialLoginButtons({
  providers = DEFAULT_SOCIAL_ORDER,
  onBeforeLogin,
  preview,
  className,
}: SocialLoginButtonsProps) {
  const [pending, setPending] = useState<SocialProvider | null>(null);
  const [failed, setFailed] = useState(false);
  // 같은 프레임의 두 번 눌림은 상태가 바뀌기 전이라 ref로 막는다
  const busy = useRef(false);

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      busy.current = false;
      setPending(null);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const start = useCallback(
    async (
      provider: SocialProvider,
      login: () => Promise<SocialLoginResult>,
    ) => {
      if (busy.current) return;
      busy.current = true;
      setPending(provider);
      setFailed(false);
      onBeforeLogin?.(provider);
      const result = await (preview ? preview(provider) : login());
      if (result === 'redirecting') return; // 떠나는 중: 바쁨 유지
      busy.current = false;
      setPending(null);
      if (result === 'error') setFailed(true);
    },
    [onBeforeLogin, preview],
  );

  return (
    <div className={cn('mx-auto grid w-full max-w-sm gap-2.5', className)}>
      <div
        role="group"
        aria-label="로그인할 계정 고르기"
        className="grid gap-2.5"
      >
        {providers.map((provider) => (
          <ProviderLogin
            key={provider}
            provider={provider}
            loading={pending === provider}
            disabled={pending !== null && pending !== provider}
            onStart={start}
          />
        ))}
      </div>
      {/* 낭독기: 어디로 가는 중인지 (화면 글자는 버튼의 바쁨 표시) */}
      <p role="status" className="sr-only">
        {pending ? SOCIAL_PENDING[pending] : ''}
      </p>
      {failed && (
        <p
          role="alert"
          className="flex items-start justify-center gap-1.5 text-center text-small text-error"
          data-testid="social-login-error"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {ERROR_TEXT}
        </p>
      )}
    </div>
  );
}

/** provider 하나: 훅은 컴포넌트마다 하나씩 (provider가 고정이라 훅 순서가 바뀌지 않음) */
function ProviderLogin({
  provider,
  loading,
  disabled,
  onStart,
}: {
  provider: SocialProvider;
  loading: boolean;
  disabled: boolean;
  onStart: (
    provider: SocialProvider,
    login: () => Promise<SocialLoginResult>,
  ) => void;
}) {
  const { handleLogin, showBrowserGuide, setShowBrowserGuide, browserInfo } =
    useSocialLogin(provider);

  return (
    <>
      <SocialLoginButton
        provider={provider}
        loading={loading}
        disabled={disabled}
        data-testid={`social-login-${provider}`}
        onClick={() => onStart(provider, handleLogin)}
      />
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

export { ERROR_TEXT as SOCIAL_LOGIN_ERROR_TEXT };
