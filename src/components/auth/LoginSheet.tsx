'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { PybaemRig } from '@/components/characters/rig/MascotRig';
import { track } from '@/lib/analytics/track';
import { cn } from '@/lib/utils';
import { readLastLogin } from '@/lib/auth/lastLogin';
import type { SocialProvider } from '@/lib/auth/socialLogin';
import {
  SocialLoginButtons,
  type SocialLoginButtonsProps,
} from './SocialLoginButtons';

export interface LoginSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 어느 랜딩 CTA에서 열었나: provider 버튼을 누를 때 `landing_cta_click`(cta·provider)을 보낸다 (P1-17). 없으면 보내지 않음 */
  cta?: 'hero' | 'header';
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
}

/** 시트 설명에 쓰는 짧은 이름 ("카카오로 들어왔어") */
const SHORT_NAME: Record<SocialProvider, string> = {
  kakao: '카카오',
  naver: '네이버',
  google: 'Google',
};

/**
 * 로그인 시트 (P3-05). 모바일은 아래에서 올라오는 시트, 768px 이상은 가운데 대화 상자(`Sheet`).
 * 손 흔드는 파이뱀(리그 `wave`, 연출 단계·동작 줄이기를 따름) + 질문 + 소셜 로그인 버튼 3종 + 공개 정보 안내 한 줄.
 * 이 기기에서 최근에 쓴 수단이 있으면(P3-08) 그 버튼이 맨 위 + "최근에 사용" 이름표, 설명은 같은 계정으로 들어오라는 한마디.
 *
 * 랜딩 첫 화면에는 싣지 않는다: `LoginSheetButton`이 누를 때(올려놓기·포커스 때 미리) 이 모듈을 불러온다 (§2.10).
 * Phase 4 P4-09에서 전체 로그인 모달로 다시 만든다.
 */
export function LoginSheet({
  open,
  onOpenChange,
  cta,
  preview,
  className,
  lastUsed: lastUsedProp,
}: LoginSheetProps) {
  const [stored, setStored] = useState<SocialProvider | null>(null);
  useEffect(() => {
    // 열 때마다 다시 읽는다 (다른 탭에서 로그인했을 수 있음). 저장소를 못 쓰면 null
    if (open && lastUsedProp === undefined)
      setStored(readLastLogin()?.provider ?? null);
  }, [open, lastUsedProp]);
  const lastUsed = lastUsedProp === undefined ? stored : lastUsedProp;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      align="center"
      media={
        <PybaemRig
          state="wave"
          size={112}
          framing="avatar"
          label=""
          // 시트가 닫혀 있는 동안(닫힘 연출 포함)에는 엔진을 쉬게 한다
          paused={!open}
        />
      }
      // 좁은 화면(320px)에서 한 낱말만 다음 줄로 떨어지지 않게 줄 길이를 고르게
      title={
        <span className="block text-balance">
          어떤 계정으로 모험을 시작할까?
        </span>
      }
      description={
        <span className="block text-balance" data-testid="login-sheet-hint">
          {lastUsed
            ? // 같은 수단으로 들어와야 같은 계정 (자동 연결 없음, §2.8 · P3-07)
              `지난번엔 ${SHORT_NAME[lastUsed]}로 들어왔어. 같은 계정으로 들어와야 모험이 이어져!`
            : '가지고 있는 계정 하나를 골라 줘.'}
        </span>
      }
      data-testid="login-sheet"
      className={cn('font-sans', className)}
    >
      <SocialLoginButtons
        className="mt-1"
        lastUsed={lastUsed}
        preview={preview}
        // 인앱 안내 대화 상자도 body로 포털되므로 같은 글꼴 변수를 넘긴다 (P3-09)
        portalClassName={className}
        onBeforeLogin={(provider) => {
          // OAuth 로 바로 떠나므로 지금 보낸다 (P1-17)
          if (cta)
            track('landing_cta_click', { cta, provider }, { immediate: true });
        }}
      />
      <p className="flex items-center justify-center gap-1.5 text-center text-caption text-muted-foreground">
        <ShieldCheck
          aria-hidden
          className="size-4 shrink-0 text-primary-text"
        />
        이름·사진은 다른 친구에게 보이지 않아요
      </p>
    </Sheet>
  );
}
