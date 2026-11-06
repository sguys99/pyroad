'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SocialLoginButton } from '@/components/auth/SocialLoginButton';
import {
  DEFAULT_SOCIAL_ORDER,
  SocialLoginButtons,
} from '@/components/auth/SocialLoginButtons';
import { LoginSheet } from '@/components/auth/LoginSheet';
import { InAppBrowserGuide } from '@/components/InAppBrowserGuide';
import type { InAppBrowserInfo } from '@/lib/browser/detectInAppBrowser';
import type { SocialProvider } from '@/lib/auth/socialLogin';
import type { SocialLoginResult } from '@/lib/hooks/useSocialLogin';
import { CodeSample, Demo, Section } from './ui';

// ───────────────────────────── 소셜 로그인 버튼 (P3-05)

type StackState = 'default' | 'hover' | 'pressed' | 'loading' | 'disabled';

const STATES: { state: StackState; label: string; note: string }[] = [
  { state: 'default', label: '기본', note: '카카오 → 네이버 → Google' },
  {
    state: 'hover',
    label: '올려놓기',
    note: '1px 뜸 + 짙은 중립 5% 상태 층 (동작 줄이기는 색만)',
  },
  {
    state: 'pressed',
    label: '눌림',
    note: '1px 내려앉음 · 98.5% + 10% (동작 줄이기는 색만)',
  },
  {
    state: 'loading',
    label: '로딩 (카카오를 누름)',
    note: '누른 버튼은 오른쪽 바쁨 표시 + aria-busy, 나머지는 비활성',
  },
  {
    state: 'disabled',
    label: '비활성',
    note: '브랜드 색은 그대로, 45%로 흐리게',
  },
];

function Stack({ state }: { state: StackState }) {
  return (
    <div className="mx-auto grid w-full max-w-sm gap-2.5">
      {DEFAULT_SOCIAL_ORDER.map((provider) => (
        <SocialLoginButton
          key={provider}
          provider={provider}
          sfx={false}
          hovered={state === 'hover'}
          pressed={state === 'pressed'}
          loading={state === 'loading' && provider === 'kakao'}
          disabled={
            state === 'disabled' ||
            (state === 'loading' && provider !== 'kakao')
          }
          data-testid={`social-${state}-${provider}`}
        />
      ))}
    </div>
  );
}

const KAKAOTALK: InAppBrowserInfo = {
  isInApp: true,
  type: 'kakaotalk',
  isAndroid: true,
  isIOS: false,
};

/** 가짜 로그인: 1.6초 바쁨 뒤 결과 (실제 OAuth로 떠나지 않음) */
function fakeLogin(result: SocialLoginResult) {
  return () =>
    new Promise<SocialLoginResult>((resolve) =>
      setTimeout(() => resolve(result), 1600),
    );
}

export function SocialLoginSection() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetLast, setSheetLast] = useState<SocialProvider | null>(null);
  const [last, setLast] = useState<SocialProvider | null>(null);
  const [recent, setRecent] = useState<SocialProvider>('naver');
  const [replay, setReplay] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <Section
      id="social-login"
      kicker="컴포넌트 §12 · P3-05 · P3-08 · P3-09"
      title="소셜 로그인 버튼 · 로그인 시트"
      // tokens-allow: 브랜드 색 값을 설명하는 글자 (색으로 쓰지 않음)
      description="각 사 브랜드 가이드의 면 색·글자색·로고·문구를 그대로 씁니다(카카오 #FEE500 · 네이버 #03A94D · Google 흰 면 + #747775 테두리). 게임 버튼과 달리 아랫면이 없고, 눌림은 1px 움직임과 얇은 상태 층으로만 알려요. 높이 54px · 반경 12px."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {STATES.map(({ state, label, note }) => (
          <Demo
            key={state}
            label={label}
            note={note}
            data-testid={`social-state-${state}`}
          >
            <Stack state={state} />
          </Demo>
        ))}
        <Demo
          label="최근에 사용 (P3-08)"
          note="이 기기에서 최근에 쓴 수단이 맨 위로 + 금색 이름표(full 팝 · lite 짧게 · minimal 페이드 · 동작 줄이기 없음). 낭독기는 '최근에 ○○로 로그인했어요'를 설명으로 읽어요"
          data-testid="social-state-recent"
        >
          <div className="flex flex-wrap gap-2">
            {DEFAULT_SOCIAL_ORDER.map((p) => (
              <Button
                key={p}
                size="sm"
                variant={p === recent ? 'primary' : 'secondary'}
                sfx={false}
                onClick={() => {
                  setRecent(p);
                  setReplay((n) => n + 1);
                }}
              >
                {p}
              </Button>
            ))}
          </div>
          <SocialLoginButtons
            key={`${recent}-${replay}`}
            lastUsed={recent}
            preview={fakeLogin('external-browser')}
          />
        </Demo>
        <Demo
          label="카카오톡 인앱 (P3-09)"
          note="카카오가 맨 위에 크게(60px) — 카카오톡 안에서 바로 로그인. Google은 누를 때만 브라우저로 나가므로 한 줄 안내. Google을 누르면(가짜) '브라우저를 열었어요' 안내"
          data-testid="social-state-inapp"
        >
          <SocialLoginButtons
            browser={KAKAOTALK}
            lastUsed="google"
            preview={(p) =>
              p === 'google'
                ? fakeLogin('external-browser')()
                : fakeLogin('error')()
            }
          />
        </Demo>
        <Demo
          label="흰 면(시트·카드) 위"
          note="Google 버튼의 1px 테두리가 흰 면과 구분해 줘요"
          surface="card"
        >
          <Stack state="default" />
        </Demo>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Demo
          label="눌러 보기 (가짜 로그인 → 오류)"
          note="누른 버튼만 바쁨, 나머지 비활성 → 1.6초 뒤 '시작하지 못함' 오류 문구(role=alert)와 함께 되살아남"
          data-testid="social-live"
        >
          <SocialLoginButtons
            preview={(provider) => {
              setLast(provider);
              return fakeLogin('error')();
            }}
          />
          <p className="text-caption text-muted-foreground">
            마지막으로 누른 버튼: {last ?? '없음'}
          </p>
        </Demo>
        <Demo
          label="로그인 시트"
          note="모바일은 아래 시트, 768px 이상은 가운데 상자. 손 흔드는 파이뱀(리그 wave) + 질문 + 버튼 3종 + 공개 정보 안내. 버튼은 가짜 로그인(1.6초 뒤 되살아남)"
        >
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              sfx={false}
              onClick={() => {
                setSheetLast(null);
                setSheetOpen(true);
              }}
              data-testid="open-login-sheet"
            >
              로그인 시트 열기
            </Button>
            <Button
              variant="secondary"
              sfx={false}
              onClick={() => {
                setSheetLast('kakao');
                setSheetOpen(true);
              }}
              data-testid="open-login-sheet-recent"
            >
              최근 로그인 = 카카오
            </Button>
          </div>
          <Button
            variant="secondary"
            sfx={false}
            onClick={() => setGuideOpen(true)}
            data-testid="open-inapp-guide"
          >
            인앱 Google 안내 (P3-09)
          </Button>
          <InAppBrowserGuide
            isOpen={guideOpen}
            onClose={() => setGuideOpen(false)}
            browserInfo={KAKAOTALK}
            provider="google"
            alternatives={['kakao', 'naver']}
            onAlternative={() => setGuideOpen(false)}
          />
          <LoginSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            lastUsed={sheetLast}
            preview={fakeLogin('external-browser')}
          />
        </Demo>
      </div>
      <CodeSample
        code={`// 랜딩 CTA: 누르면 로그인 시트 (시트 모듈은 그때 불러옴)\n<LoginSheetButton cta="hero" size="lg" iconRight={<Rocket aria-hidden />}>모험 시작하기</LoginSheetButton>\n\n// 버튼 묶음만: 호출은 provider마다 useSocialLogin(provider)\n<SocialLoginButtons onBeforeLogin={(p) => track('landing_cta_click', { cta, provider: p })} />`}
      />
    </Section>
  );
}
