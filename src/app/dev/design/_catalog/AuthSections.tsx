'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SocialLoginButton } from '@/components/auth/SocialLoginButton';
import {
  DEFAULT_SOCIAL_ORDER,
  SocialLoginButtons,
} from '@/components/auth/SocialLoginButtons';
import { LoginSheet } from '@/components/auth/LoginSheet';
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

/** 가짜 로그인: 1.6초 바쁨 뒤 결과 (실제 OAuth로 떠나지 않음) */
function fakeLogin(result: SocialLoginResult) {
  return () =>
    new Promise<SocialLoginResult>((resolve) =>
      setTimeout(() => resolve(result), 1600),
    );
}

export function SocialLoginSection() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [last, setLast] = useState<SocialProvider | null>(null);

  return (
    <Section
      id="social-login"
      kicker="컴포넌트 §12 · P3-05"
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
          <Button
            variant="secondary"
            sfx={false}
            onClick={() => setSheetOpen(true)}
            data-testid="open-login-sheet"
          >
            로그인 시트 열기
          </Button>
          <LoginSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
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
