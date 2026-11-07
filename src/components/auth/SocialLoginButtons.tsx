'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleAlert, ExternalLink, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SocialProvider } from '@/lib/auth/socialLogin';
import { orderProviders } from '@/lib/auth/providerOrder';
import { ENABLED_LOGIN_PROVIDERS } from '@/lib/auth/enabledProviders';
import {
  detectInAppBrowser,
  type InAppBrowserInfo,
} from '@/lib/browser/detectInAppBrowser';
import {
  useSocialLogin,
  type SocialLoginResult,
} from '@/lib/hooks/useSocialLogin';
import { InAppBrowserGuide } from '@/components/InAppBrowserGuide';
import { SocialLoginButton } from './SocialLoginButton';
import { SOCIAL_PENDING } from './brandMarks';
import { loginErrorHint } from './loginErrorCopy';
import type { LoginErrorReason } from '@/lib/auth/loginError';

/** 기본 순서: 카카오(카카오톡 인앱 사용자가 가장 많음) → 네이버 → Google. 인앱·최근 로그인에 따라 `orderProviders`가 바꾼다 */
export const DEFAULT_SOCIAL_ORDER: readonly SocialProvider[] = [
  'kakao',
  'naver',
  'google',
];

const ERROR_TEXT = '앗, 로그인을 시작하지 못했어요. 잠시 뒤에 다시 눌러 줘!';
/** 인앱에서 Google을 눌러 외부 브라우저를 열었을 때 (이 화면은 그대로 남음) */
const EXTERNAL_TEXT =
  '브라우저를 열었어요. 거기서 Google 로그인을 한 번 더 눌러 줘!';

export interface SocialLoginButtonsProps {
  /**
   * 보일 provider (기본: `NEXT_PUBLIC_LOGIN_PROVIDERS`로 켠 것, 비우면 세 개 모두 — P3-09).
   * 순서는 카카오톡 인앱 → 최근 사용 → 이 목록 순서
   */
  providers?: readonly SocialProvider[];
  /**
   * 이 기기에서 최근에 쓴 로그인 수단 (P3-08, `readLastLogin()`): 그 버튼을 맨 위로 올리고 "최근에 사용" 이름표를 단다.
   * 같은 수단으로 들어와야 같은 계정이 된다(자동 연결 없음, §2.8)
   */
  lastUsed?: SocialProvider | null;
  /** 로그인 흐름을 시작하기 직전 (예: 랜딩 CTA 분석 이벤트 `landing_cta_click`, P1-17) */
  onBeforeLogin?: (provider: SocialProvider) => void;
  /**
   * 카탈로그·미리 보기용: 실제 로그인 대신 이 함수를 부른다(바쁨·오류 표시 확인).
   * 앱에서는 주지 않는다 → `useSocialLogin(provider).handleLogin()`
   */
  preview?: (provider: SocialProvider) => Promise<SocialLoginResult>;
  /** 인앱 판별 결과를 직접 줌 (카탈로그·테스트). 주지 않으면 마운트 뒤 `detectInAppBrowser()` */
  browser?: InAppBrowserInfo;
  /**
   * 방금 실패한 로그인 (P3-10). 있으면 버튼 위에 "다른 방법으로 들어가기" 한마디(`loginErrorHint`, 해당할 때만).
   * 제목·설명·표정은 시트(`LoginSheet notice`)가 바꾼다
   */
  failure?: { reason: LoginErrorReason; via: SocialProvider | null } | null;
  /** 인앱 안내 대화 상자에 더할 클래스 (랜딩 서브셋 글꼴 변수, body로 포털되므로) */
  portalClassName?: string;
  className?: string;
}

/**
 * 소셜 로그인 버튼 묶음 (P3-05). 로그인 호출은 provider마다 `useSocialLogin(provider)`(P1-14 헬퍼)로만 한다.
 *
 * - 하나를 누르면 그 버튼은 바쁨(`aria-busy` + 바쁨 표시), 나머지는 비활성 → 두 번 눌림·동시 로그인 없음
 * - 결과가 `error`면 버튼을 되살리고 아래에 오류 문구(`role="alert"`), 외부 브라우저·안내 모달이면 바로 되살림
 * - provider 화면에서 뒤로 가기로 돌아오면(bfcache `pageshow`) 바쁨을 푼다
 * - 최근에 쓴 수단(`lastUsed`, P3-08)은 맨 위 + "최근에 사용" 이름표
 * - 인앱 브라우저 (P3-09):
 *   - **카카오톡 인앱**이면 카카오 버튼을 맨 위에 크게(`size="lg"`) — 카카오톡 안에서 바로 로그인된다
 *   - Google만 누를 때 외부 브라우저로 보낸다(`signInWithOAuth` 전에, 훅이 처리). 안 되면 `InAppBrowserGuide`
 *     (이 앱 안에서 되는 카카오·네이버 버튼도 함께). 네이버·카카오는 인앱에서 그대로
 *   - 인앱이면 Google 버튼 아래에 "브라우저에서 열려요" 한 줄
 */
export function SocialLoginButtons({
  providers = ENABLED_LOGIN_PROVIDERS,
  lastUsed = null,
  onBeforeLogin,
  preview,
  browser,
  portalClassName,
  failure = null,
  className,
}: SocialLoginButtonsProps) {
  const [pending, setPending] = useState<SocialProvider | null>(null);
  const [failed, setFailed] = useState(false);
  const [openedExternal, setOpenedExternal] = useState(false);
  // 서버·첫 렌더는 일반 브라우저로 두고 마운트 뒤 판별 (하이드레이션 불일치 없음)
  const [detected, setDetected] = useState<InAppBrowserInfo | null>(null);
  const info = browser ?? detected;
  // 같은 프레임의 두 번 눌림은 상태가 바뀌기 전이라 ref로 막는다
  const busy = useRef(false);

  // 훅은 provider마다 하나, 늘 같은 순서로 (보이지 않는 provider도 불러 두기만 함)
  const logins = {
    kakao: useSocialLogin('kakao'),
    naver: useSocialLogin('naver'),
    google: useSocialLogin('google'),
  };
  const google = logins.google;
  const loginsRef = useRef(logins);
  loginsRef.current = logins;

  const inKakaoTalk = info?.type === 'kakaotalk';
  const primary: SocialProvider | null =
    inKakaoTalk && providers.includes('kakao') ? 'kakao' : null;
  const ordered = orderProviders(providers, [primary, lastUsed]);
  // 인앱에서도 바로 되는 수단 (Google 안내에서 대신 고르기)
  const inAppFriendly = ordered.filter((p) => p !== 'google');
  const hint = failure
    ? loginErrorHint(failure.reason, {
        via: failure.via,
        inApp: info?.type ?? null,
        available: providers,
      })
    : null;

  useEffect(() => {
    if (!browser) setDetected(detectInAppBrowser());
  }, [browser]);

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
    async (provider: SocialProvider) => {
      if (busy.current) return;
      busy.current = true;
      setPending(provider);
      setFailed(false);
      setOpenedExternal(false);
      onBeforeLogin?.(provider);
      const result = await (preview
        ? preview(provider)
        : loginsRef.current[provider].handleLogin());
      if (result === 'redirecting') return; // 떠나는 중: 바쁨 유지
      busy.current = false;
      setPending(null);
      if (result === 'error') setFailed(true);
      if (result === 'external-browser') setOpenedExternal(true);
    },
    [onBeforeLogin, preview],
  );

  return (
    <div
      className={cn('mx-auto grid w-full max-w-sm gap-2.5', className)}
      data-inapp={info?.isInApp ? (info.type ?? 'unknown') : undefined}
    >
      {hint && (
        <p
          className="flex items-start gap-2 rounded-xl bg-accent-soft px-3 py-2.5 text-small text-foreground"
          data-testid="login-error-hint"
        >
          <Lightbulb
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-accent-text"
          />
          {hint}
        </p>
      )}
      <div
        role="group"
        aria-label="로그인할 계정 고르기"
        className="grid gap-2.5"
      >
        {ordered.map((provider) => (
          <SocialLoginButton
            key={provider}
            provider={provider}
            size={provider === primary ? 'lg' : 'md'}
            recent={provider === lastUsed}
            loading={pending === provider}
            disabled={pending !== null && pending !== provider}
            data-testid={`social-login-${provider}`}
            onClick={() => void start(provider)}
          />
        ))}
      </div>
      {info?.isInApp && providers.includes('google') && (
        <p
          className="flex items-center justify-center gap-1.5 text-center text-caption text-muted-foreground"
          data-testid="social-login-inapp-note"
        >
          <ExternalLink aria-hidden className="size-4 shrink-0" />
          Google 로그인은 Chrome·Safari 같은 브라우저에서 열려요
        </p>
      )}
      {/* 낭독기: 어디로 가는 중인지 (화면 글자는 버튼의 바쁨 표시) */}
      <p role="status" className="sr-only">
        {pending ? SOCIAL_PENDING[pending] : ''}
      </p>
      {openedExternal && (
        <p
          className="text-center text-small text-foreground"
          role="status"
          data-testid="social-login-external"
        >
          {EXTERNAL_TEXT}
        </p>
      )}
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
      {google.browserInfo && (
        <InAppBrowserGuide
          isOpen={google.showBrowserGuide}
          onClose={() => google.setShowBrowserGuide(false)}
          browserInfo={google.browserInfo}
          provider="google"
          alternatives={inAppFriendly}
          onAlternative={(p) => {
            google.setShowBrowserGuide(false);
            void start(p);
          }}
          className={portalClassName}
        />
      )}
    </div>
  );
}

export { ERROR_TEXT as SOCIAL_LOGIN_ERROR_TEXT };
