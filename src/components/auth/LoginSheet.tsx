'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ShieldCheck, UsersRound } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { PybaemRig } from '@/components/characters/rig/MascotRig';
import { track } from '@/lib/analytics/track';
import type { AnalyticsEventProps } from '@/lib/analytics/events';
import { cn } from '@/lib/utils';
import { readLastLogin } from '@/lib/auth/lastLogin';
import { ENABLED_LOGIN_PROVIDERS } from '@/lib/auth/enabledProviders';
import { readSharedDevice, writeSharedDevice } from '@/lib/auth/sharedDevice';
import {
  detectInAppBrowser,
  type InAppBrowserInfo,
} from '@/lib/browser/detectInAppBrowser';
import { SharedDeviceCheck } from './SharedDeviceCheck';
import type { SocialProvider } from '@/lib/auth/socialLogin';
import type { LoginErrorReason } from '@/lib/auth/loginError';
import { loginErrorCopy } from './loginErrorCopy';
import {
  SocialLoginButtons,
  type SocialLoginButtonsProps,
} from './SocialLoginButtons';

/** 랜딩 CTA 이름 = 분석 스키마의 `landing_cta_click.cta` (스키마에 값이 늘면 여기도 따라 늘어난다) */
export type LandingCta = AnalyticsEventProps['landing_cta_click']['cta'];

/**
 * 어디서 열었나 → 머리말 (P4-09). hero = 히어로 "모험 시작!", header = 헤더 "로그인",
 * trial = 30초 체험 성공 뒤 "모험을 저장하려면 로그인!" (P4-03)
 */
export type LoginSheetContext = 'hero' | 'header' | 'trial';

export const LOGIN_SHEET_HEADINGS: Record<LoginSheetContext, string> = {
  hero: '어떤 계정으로 모험을 시작할까?',
  header: '어떤 계정으로 들어갈까?',
  trial: '모험을 저장하려면 로그인!',
};

/** 처음(이 기기에 최근 로그인 기록 없음) 안내: 아무거나 괜찮고, 다음에도 같은 걸로 (P3-08 X3 중복 계정 막기) */
export const LOGIN_SHEET_FIRST_HINT =
  '어떤 걸로 들어가도 돼. 다음에도 같은 걸로 들어와 줘!';

/** 보호자 동의 안내 (P3-15 온보딩: 나이 확인 → 만 14세 미만이면 보호자 동의, 나중에 해도 학습은 됨) */
export const LOGIN_SHEET_GUARDIAN_NOTE =
  '만 14세가 안 된 친구는 들어온 뒤 보호자님과 함께 동의해요';

/** cta로 머리말 맥락 고르기 (context를 따로 주지 않았을 때) */
export function loginSheetContextOf(
  cta: string | undefined,
): LoginSheetContext {
  if (cta === 'header' || cta === 'trial') return cta;
  return 'hero';
}

export interface LoginSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 어느 랜딩 CTA에서 열었나: provider 버튼을 누를 때 `landing_cta_click`(cta·provider)을 보낸다 (P1-17). 없으면 보내지 않음 */
  cta?: LandingCta;
  /** 머리말 맥락 (P4-09). 주지 않으면 `cta`로 고른다(header → header, trial → trial, 그 밖 → hero) */
  context?: LoginSheetContext;
  /** 제목을 직접 (맥락 기본 문구 대신). 실패 안내(`notice`)가 있으면 그쪽이 먼저 */
  heading?: ReactNode;
  /** 보일 provider (카탈로그: 세 개 모두 보기). 주지 않으면 `NEXT_PUBLIC_LOGIN_PROVIDERS` */
  providers?: SocialLoginButtonsProps['providers'];
  /** 카탈로그용 가짜 로그인 (`SocialLoginButtons.preview`) */
  preview?: SocialLoginButtonsProps['preview'];
  /**
   * 시트 상자에 더할 클래스. 랜딩은 텍스트 서브셋 글꼴 변수(`--font-*-landing`)를 여기로 넘긴다:
   * 시트는 body로 포털되어 랜딩 래퍼(`page.tsx`)의 변수를 물려받지 못한다
   */
  className?: string;
  /**
   * 최근에 쓴 로그인 수단 (P3-08). 주지 않으면(undefined) 시트를 열 때마다 이 기기 저장값(`readLastLogin`)을 읽는다.
   * 카탈로그·테스트는 값을 직접 준다(null = 기록 없음)
   */
  lastUsed?: SocialProvider | null;
  /**
   * 방금 실패한 로그인 (P3-10, 랜딩 `LandingLoginError`가 주소에서 읽어 줌). 있으면 파이뱀 표정·제목·설명이 그 사유의
   * 안내로 바뀌고(`loginErrorCopy`), 버튼 위에 "다른 방법" 한마디가 붙는다. 버튼은 그대로라 바로 다시 해 볼 수 있다
   */
  notice?: { reason: LoginErrorReason; via: SocialProvider | null } | null;
  /** 인앱 판별 결과를 직접 줌 (카탈로그·테스트, `SocialLoginButtons.browser`) */
  browser?: SocialLoginButtonsProps['browser'];
}

/** 시트 설명에 쓰는 짧은 이름 ("카카오로 들어왔어") */
const SHORT_NAME: Record<SocialProvider, string> = {
  kakao: '카카오',
  naver: '네이버',
  google: 'Google',
};

/**
 * 로그인 시트·모달 (P3-05 → P4-09). 768px 미만은 아래에서 스프링으로 올라오는 시트, 768px 이상은 살짝 커지며 떠오르는
 * 가운데 대화 상자(공통 `Sheet`). 기기 뒤로 가기로 닫히고(`closeOnBack`, 랜딩을 떠나지 않게), 닫으면 연 버튼으로 포커스가 돌아간다.
 *
 * 머리: 손 흔드는 파이뱀(리그 `wave`, 연출 단계·동작 줄이기를 따름) + 맥락별 제목(`context`: 히어로·헤더·체험) + 한마디.
 * 이 기기에서 최근에 쓴 수단이 있으면(P3-08) 그 버튼이 맨 위 + 금색 "최근에 사용" 이름표(full은 한 번 살랑), 한마디는
 * 같은 계정으로 들어오라는 말. 기록이 없으면 "어떤 걸로 들어가도 돼. 다음에도 같은 걸로!"
 * 버튼 아래 공용 기기 체크 "학교·도서관 컴퓨터예요"(P4-09, §12-Q44): 켜면 이 기기에 기억하고 provider가 매번 다시 묻게 하며
 * (`getOAuthCredentials`), 최근 로그인 기록은 앞 사람 것이라 쓰지 않는다. 카카오톡 인앱에서는 숨긴다.
 * 아래: 공개 정보 안내 + 보호자 동의 안내(만 14세 미만, P3-15) 두 줄.
 * 로그인이 방금 실패했으면(P3-10 `notice`) 사유별 표정·제목·설명 + "다른 방법" 한마디, 버튼은 그대로(바로 다시 해 보기).
 *
 * 랜딩 첫 화면에는 싣지 않는다: `LoginSheetButton`이 누를 때(올려놓기·포커스 때 미리) 이 모듈을 불러온다 (§2.10).
 */
export function LoginSheet({
  open,
  onOpenChange,
  cta,
  context,
  heading,
  providers,
  preview,
  className,
  lastUsed: lastUsedProp,
  notice = null,
  browser,
}: LoginSheetProps) {
  const [stored, setStored] = useState<SocialProvider | null>(null);
  // 공용 기기 표시 (P4-09): 이 기기 저장값, 열 때마다 다시 읽는다
  const [shared, setShared] = useState(false);
  // 인앱 판별 (서버·첫 렌더는 일반 브라우저, 마운트 뒤). 버튼 묶음에도 넘겨 한 번만 판별
  const [detected, setDetected] = useState<InAppBrowserInfo | null>(null);
  useEffect(() => {
    if (!browser) setDetected(detectInAppBrowser());
  }, [browser]);
  const info = browser ?? detected ?? undefined;
  useEffect(() => {
    if (!open) return;
    // 열 때마다 다시 읽는다 (다른 탭에서 로그인했을 수 있음). 저장소를 못 쓰면 null
    if (lastUsedProp === undefined)
      setStored(readLastLogin()?.provider ?? null);
    setShared(readSharedDevice());
  }, [open, lastUsedProp]);
  const remembered = lastUsedProp === undefined ? stored : lastUsedProp;
  // 기록 없음으로 보는 때:
  // - 지난번 수단이 지금 숨겨져 있으면(예: 네이버 검수 전 `NEXT_PUBLIC_LOGIN_PROVIDERS`) 없는 버튼을 가리키지 않게
  // - 공용 기기면 그 기록은 앞 사람 것이라 (P4-09)
  const lastUsed =
    remembered &&
    !shared &&
    (providers ?? ENABLED_LOGIN_PROVIDERS).includes(remembered)
      ? remembered
      : null;
  // 카카오톡 인앱은 그 사람 휴대폰의 카카오톡이고, 카카오 재로그인(prompt=login)도 제공하지 않아 체크를 숨긴다
  const showShared = info?.type !== 'kakaotalk';
  const copy = notice ? loginErrorCopy(notice.reason, notice.via) : null;
  const ctx = context ?? loginSheetContextOf(cta);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      align="center"
      // 모바일 뒤로 가기 = 시트 닫기 (랜딩을 떠나지 않음)
      closeOnBack
      media={
        <PybaemRig
          state={copy?.rig ?? 'wave'}
          size={112}
          framing="avatar"
          label=""
          // 시트가 닫혀 있는 동안(닫힘 연출 포함)에는 엔진을 쉬게 한다
          paused={!open}
        />
      }
      // 좁은 화면(320px)에서 한 낱말만 다음 줄로 떨어지지 않게 줄 길이를 고르게
      title={
        <span className="block text-balance" data-context={ctx}>
          {copy?.title ?? heading ?? LOGIN_SHEET_HEADINGS[ctx]}
        </span>
      }
      description={
        <span className="block text-balance" data-testid="login-sheet-hint">
          {copy
            ? copy.body
            : lastUsed
              ? // 같은 수단으로 들어와야 같은 계정 (자동 연결 없음, §2.8 · P3-07)
                `지난번엔 ${SHORT_NAME[lastUsed]}로 들어왔어. 같은 계정으로 들어와야 모험이 이어져!`
              : LOGIN_SHEET_FIRST_HINT}
        </span>
      }
      data-testid="login-sheet"
      className={cn('font-sans', className)}
    >
      <SocialLoginButtons
        className="mt-1"
        providers={providers}
        lastUsed={lastUsed}
        failure={notice}
        browser={info}
        preview={preview}
        // 인앱 안내 대화 상자도 body로 포털되므로 같은 글꼴 변수를 넘긴다 (P3-09)
        portalClassName={className}
        onBeforeLogin={(provider) => {
          // OAuth 로 바로 떠나므로 지금 보낸다 (P1-17)
          if (cta)
            track(
              'landing_cta_click',
              { cta, provider, shared: showShared && shared },
              { immediate: true },
            );
        }}
      />
      {showShared && (
        <SharedDeviceCheck
          checked={shared}
          onCheckedChange={(next) => {
            writeSharedDevice(next);
            setShared(next);
          }}
        />
      )}
      {/* 두 줄 안내: 아이콘은 글자 안에 놓아(inline) 좁은 화면에서 줄이 바뀌어도 첫 낱말 옆에 붙어 있게 */}
      <ul
        className="mx-auto grid w-full max-w-sm gap-1 border-t border-line pt-3 text-center text-caption text-balance text-muted-foreground"
        data-testid="login-sheet-notes"
      >
        <li>
          <ShieldCheck
            aria-hidden
            className="mr-1 inline-block size-4 align-[-0.2em] text-primary-text"
          />
          이름·사진은 다른 친구에게 보이지 않아요
        </li>
        <li data-testid="login-sheet-guardian">
          <UsersRound
            aria-hidden
            className="mr-1 inline-block size-4 align-[-0.2em] text-accent-text"
          />
          {LOGIN_SHEET_GUARDIAN_NOTE}
        </li>
      </ul>
    </Sheet>
  );
}
