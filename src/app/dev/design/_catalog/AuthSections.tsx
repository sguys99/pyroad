'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SocialLoginButton } from '@/components/auth/SocialLoginButton';
import {
  DEFAULT_SOCIAL_ORDER,
  SocialLoginButtons,
} from '@/components/auth/SocialLoginButtons';
import {
  LOGIN_SHEET_HEADINGS,
  LoginSheet,
  type LoginSheetContext,
} from '@/components/auth/LoginSheet';
import { InAppBrowserGuide } from '@/components/InAppBrowserGuide';
import { SharedDeviceCheck } from '@/components/auth/SharedDeviceCheck';
import { sharedLogoutMessage } from '@/components/LogoutButton';
import { LoginErrorPanel } from '@/components/auth/LoginErrorPanel';
import { LinkedAccountsList } from '@/components/settings/LinkedAccountsSection';
import { accountLinkRows } from '@/lib/auth/accountLinks';
import {
  LOGIN_ERROR_REASONS,
  type LoginErrorReason,
} from '@/lib/auth/loginError';
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

/** 사유별 견본: 시도한 provider·인앱 (P3-10 "다른 방법" 한마디가 보이게 고른 값) */
const ERROR_SAMPLES: Record<
  LoginErrorReason,
  { via: SocialProvider | null; inApp?: boolean }
> = {
  cancelled: { via: 'kakao' },
  identity_taken: { via: 'google' },
  expired: { via: 'google', inApp: true },
  reused: { via: null },
  other_browser: { via: 'naver' },
  unavailable: { via: 'naver' },
  unknown: { via: 'google' },
};

/** 계정 연결 견본 (P3-07): identity 모양만 (이메일·식별자 없음) */
const ALL_PROVIDERS = ['kakao', 'naver', 'google'] as const;
const id = (provider: string, created_at: string) => ({ provider, created_at });
const LINK_SAMPLES: { label: string; note: string; identities: ReturnType<typeof id>[]; busy?: SocialProvider }[] = [
  {
    label: 'Google만',
    note: '카카오·네이버를 붙일 수 있음(확인된 방향). 하나뿐이라 끊기 막힘',
    identities: [id('google', '2026-11-01T00:00:00Z')],
  },
  {
    label: '카카오만',
    note: 'Google은 붙일 수 있음(스모크 L-3). 네이버는 이메일 없는 계정끼리라 막고 이유를 글로',
    identities: [id('kakao', '2026-11-02T00:00:00Z')],
  },
  {
    label: 'Google + 카카오 (카카오 끊는 중)',
    note: '둘 다 끊을 수 있음. 진행 중에는 다른 버튼 비활성',
    identities: [
      id('google', '2026-11-01T00:00:00Z'),
      id('kakao', '2026-11-03T00:00:00Z'),
    ],
    busy: 'kakao',
  },
  {
    label: '셋 다',
    note: '모두 연결됨 · 연결한 날짜',
    identities: [
      id('google', '2026-11-01T00:00:00Z'),
      id('kakao', '2026-11-03T00:00:00Z'),
      id('custom:naver', '2026-11-05T00:00:00Z'),
    ],
  },
];

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
  const [sheetContext, setSheetContext] = useState<LoginSheetContext>('hero');
  const [last, setLast] = useState<SocialProvider | null>(null);
  const [recent, setRecent] = useState<SocialProvider>('naver');
  const [replay, setReplay] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  const [errorSheet, setErrorSheet] = useState<LoginErrorReason | null>(null);
  const [sharedDemo, setSharedDemo] = useState(false);

  return (
    <Section
      id="social-login"
      kicker="컴포넌트 §12 · P3-05 · P3-07~P3-10"
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
          note="이 기기에서 최근에 쓴 수단이 맨 위로 + 금색 이름표(full 팝 + 한 번 살랑 · lite 짧은 팝 · minimal 페이드 · 동작 줄이기 없음). 낭독기는 '최근에 ○○로 로그인했어요'를 설명으로 읽어요"
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
          label="공용 기기 체크 (P4-09, §12-Q44)"
          note="시트 버튼 아래. 켜면 이 기기에 기억(pyroad.sharedDevice.v1)하고 카카오·네이버는 prompt=login, Google은 prompt=select_account로 매번 다시 묻는다. 최근 로그인 기록은 앞 사람 것이라 안 씀, 카카오톡 인앱에서는 숨김. 로그아웃하면 아래 안내(이 견본은 저장하지 않음)"
          surface="card"
          data-testid="social-shared-device"
        >
          <SharedDeviceCheck
            checked={sharedDemo}
            onCheckedChange={setSharedDemo}
          />
          <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-small text-foreground">
            <span className="font-semibold">로그아웃했어!</span>{' '}
            {sharedLogoutMessage('naver')}
          </p>
        </Demo>
        <Demo
          label="로그인 시트 · 모달 (P3-05 → P4-09)"
          note="768px 미만은 아래에서 body 스프링으로 올라오는 시트, 이상은 살짝 커지며 떠오르는 가운데 상자. 뒤로 가기·Esc·덮개·닫기로 닫히고 연 버튼으로 포커스 복귀. 손 흔드는 파이뱀 + 맥락별 제목(히어로·헤더·체험) + 한마디 + 버튼 3종 + 공개 정보·보호자 동의 안내. 버튼은 가짜 로그인(1.6초 뒤 되살아남)"
          data-testid="social-login-sheet-demo"
        >
          <div className="flex flex-wrap gap-3">
            {(Object.keys(LOGIN_SHEET_HEADINGS) as LoginSheetContext[]).map(
              (ctx) => (
                <Button
                  key={ctx}
                  variant="secondary"
                  sfx={false}
                  onClick={() => {
                    setSheetLast(null);
                    setSheetContext(ctx);
                    setSheetOpen(true);
                  }}
                  data-testid={
                    ctx === 'hero' ? 'open-login-sheet' : `open-login-sheet-${ctx}`
                  }
                >
                  {ctx === 'hero' ? '히어로' : ctx === 'header' ? '헤더' : '체험 성공'}
                </Button>
              ),
            )}
            <Button
              variant="secondary"
              sfx={false}
              onClick={() => {
                setSheetLast('kakao');
                setSheetContext('hero');
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
            context={sheetContext}
            lastUsed={sheetLast}
            providers={ALL_PROVIDERS}
            preview={fakeLogin('external-browser')}
          />
        </Demo>
      </div>
      <Demo
        label="로그인 실패 안내 · 시트 (P3-10)"
        note="랜딩에서 시작한 로그인이 실패하면 /?login_error=<사유>&via=<provider>로 돌아와 시트가 저절로 열린다. 사유별 파이뱀 표정·제목·설명 + (해당할 때만) 다른 방법 한마디, 버튼은 그대로. expired는 카카오톡 인앱 + Google 실패 견본"
        data-testid="social-error-sheet"
      >
        <div className="flex flex-wrap gap-2">
          {LOGIN_ERROR_REASONS.map((reason) => (
            <Button
              key={reason}
              size="sm"
              variant="secondary"
              sfx={false}
              onClick={() => setErrorSheet(reason)}
              data-testid={`open-error-sheet-${reason}`}
            >
              {reason}
            </Button>
          ))}
        </div>
        <LoginSheet
          open={errorSheet !== null}
          onOpenChange={(o) => {
            if (!o) setErrorSheet(null);
          }}
          lastUsed={null}
          notice={
            errorSheet
              ? { reason: errorSheet, via: ERROR_SAMPLES[errorSheet].via }
              : null
          }
          browser={
            errorSheet && ERROR_SAMPLES[errorSheet].inApp ? KAKAOTALK : undefined
          }
          preview={fakeLogin('external-browser')}
        />
      </Demo>
      <Demo
        label="로그인 실패 안내 · 화면 /auth/error (P3-10)"
        note="랜딩 밖에서 시작한 흐름(설정의 계정 연결 등 next가 있음)이 실패하면 이 패널 화면. 정지 파이뱀(움직임 없음) + 돌아가기(next) + 처음 화면으로"
        data-testid="social-error-panels"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {LOGIN_ERROR_REASONS.map((reason) => (
            <LoginErrorPanel
              key={reason}
              reason={reason}
              via={ERROR_SAMPLES[reason].via}
              headingLevel="h2"
              backHref={reason === 'identity_taken' ? '/settings' : null}
              backLabel="설정으로 돌아가기"
            />
          ))}
        </div>
      </Demo>
      <Demo
        label="로그인 계정 연결 · 설정 (P3-07)"
        note="설정 → 로그인 계정 연결. 브랜드 로고 원 + 이름 + 연결됨 · 날짜(이메일·이름·식별자 없음). 연결은 linkIdentity(P1-14 헬퍼), 끊기는 확인 창 → POST /api/account/unlink"
        data-testid="social-linked-accounts"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {LINK_SAMPLES.map((sample) => (
            <div key={sample.label} className="space-y-2">
              <p className="text-caption font-semibold text-foreground">
                {sample.label}
              </p>
              <p className="text-caption text-muted-foreground">{sample.note}</p>
              <LinkedAccountsList
                rows={accountLinkRows(sample.identities, ALL_PROVIDERS)}
                busy={sample.busy ?? null}
              />
            </div>
          ))}
        </div>
      </Demo>
      <CodeSample
        code={`// 랜딩 CTA: 누르면 로그인 시트 (시트 모듈은 그때 불러옴, 닫힌 채 그린 뒤 열어 등장 연출)\n<LoginSheetButton cta="hero" size="lg" iconRight={<Rocket aria-hidden />}>모험 시작하기</LoginSheetButton>\n\n// 30초 체험 성공 CTA (P4-03, 분석 스키마에 trial이 들어간 뒤): 머리말 "모험을 저장하려면 로그인!"\n<LoginSheetButton cta="trial" size="lg">모험 저장하기</LoginSheetButton>\n\n// 버튼 묶음만: 호출은 provider마다 useSocialLogin(provider)\n<SocialLoginButtons onBeforeLogin={(p) => track('landing_cta_click', { cta, provider: p })} />`}
      />
    </Section>
  );
}
