'use client';

import type { ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
// 랜딩 텍스트 서브셋 변수: page.tsx가 이미 import하므로 preload가 늘지 않는다 (fonts.md §1). 이 버튼은 랜딩 전용
import { displayLanding, sansLanding } from '@/fonts/landing';
import { cn } from '@/lib/utils';
// 타입만 (시트 모듈은 누를 때 불러온다, `useLazyLoginSheet`)
import type { LandingCta, LoginSheetContext } from './LoginSheet';
import { useLazyLoginSheet } from './useLazyLoginSheet';

export interface LoginSheetButtonProps extends Omit<
  ButtonProps,
  'onClick' | 'href'
> {
  /** 분석 이벤트 `landing_cta_click`의 cta (P1-17). 값은 분석 스키마를 따른다(`trial`은 P4-03이 스키마에 더함) */
  cta: LandingCta;
  /**
   * 시트 머리말 맥락 (P4-09): hero "어떤 계정으로 모험을 시작할까?" · header "어떤 계정으로 들어갈까?" ·
   * trial "모험을 저장하려면 로그인!". 주지 않으면 `cta`로 고른다
   */
  context?: LoginSheetContext;
  /** 시트 제목을 직접 (맥락 기본 문구 대신, 예: 체험 결과에 맞춘 한 줄) */
  heading?: ReactNode;
}

/**
 * 랜딩 로그인 CTA (P3-05): 게임 버튼을 누르면 로그인 시트(카카오·네이버·Google)가 열린다. 랜딩 전용(랜딩 글꼴 변수를 씀).
 * 예전 `LoginButton`(Google 바로 로그인)을 대신한다. 시트 모듈은 올려놓기·포커스 때 미리 받고, 처음 누를 때 그린다.
 *
 * 30초 체험 성공 CTA (P4-03) 예:
 * `<LoginSheetButton cta="trial" size="lg">모험 저장하기</LoginSheetButton>` → 머리말 "모험을 저장하려면 로그인!"
 * (분석 스키마에 `trial`이 더해지기 전에는 `cta="hero" context="trial"`)
 */
export function LoginSheetButton({
  cta,
  context,
  heading,
  children,
  onPointerEnter,
  onFocus,
  ...props
}: LoginSheetButtonProps) {
  const { Sheet, open, setOpen, show, prefetch } = useLazyLoginSheet();

  return (
    <>
      <Button
        {...props}
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerEnter={(e) => {
          prefetch();
          onPointerEnter?.(e);
        }}
        onFocus={(e) => {
          prefetch();
          onFocus?.(e);
        }}
        onClick={show}
      >
        {children}
      </Button>
      {Sheet && (
        <Sheet
          open={open}
          onOpenChange={setOpen}
          cta={cta}
          context={context}
          heading={heading}
          // 시트는 body로 포털되므로 랜딩 서브셋 글꼴 변수를 직접 넘긴다 (없으면 Jua·pyRoad Sans 대신 시스템 글꼴)
          className={cn(displayLanding.variable, sansLanding.variable)}
        />
      )}
    </>
  );
}
