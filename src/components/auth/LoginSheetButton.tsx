'use client';

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { Button, type ButtonProps } from '@/components/ui/button';
// 랜딩 텍스트 서브셋 변수: page.tsx가 이미 import하므로 preload가 늘지 않는다 (fonts.md §1). 이 버튼은 랜딩 전용
import { displayLanding, sansLanding } from '@/fonts/landing';
import { cn } from '@/lib/utils';

// 로그인 시트(리그·브랜드 로고·대화 상자)는 첫 화면 JS에 넣지 않는다 (§2.10 랜딩 JS 예산). 누를 때 불러온다
const loadSheet = () => import('./LoginSheet');
const LoginSheet = dynamic(() => loadSheet().then((m) => m.LoginSheet), {
  ssr: false,
});

export interface LoginSheetButtonProps extends Omit<
  ButtonProps,
  'onClick' | 'href'
> {
  /** 분석 이벤트 `landing_cta_click`의 cta (P1-17) */
  cta: 'hero' | 'header';
}

/**
 * 랜딩 로그인 CTA (P3-05): 게임 버튼을 누르면 로그인 시트(카카오·네이버·Google)가 열린다. 랜딩 전용(랜딩 글꼴 변수를 씀).
 * 예전 `LoginButton`(Google 바로 로그인)을 대신한다. 시트 모듈은 올려놓기·포커스 때 미리 받고, 처음 누를 때 그린다.
 */
export function LoginSheetButton({
  cta,
  children,
  onPointerEnter,
  onFocus,
  ...props
}: LoginSheetButtonProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const prefetch = useCallback(() => {
    void loadSheet();
  }, []);

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
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        {children}
      </Button>
      {mounted && (
        <LoginSheet
          open={open}
          onOpenChange={setOpen}
          cta={cta}
          // 시트는 body로 포털되므로 랜딩 서브셋 글꼴 변수를 직접 넘긴다 (없으면 Jua·pyRoad Sans 대신 시스템 글꼴)
          className={cn(displayLanding.variable, sansLanding.variable)}
        />
      )}
    </>
  );
}
