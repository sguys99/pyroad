'use client';

import { useState, type ComponentProps } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SocialProvider } from '@/lib/auth/socialLogin';
// 가벼운 컨텍스트 모듈: 랜딩에서 사운드 매니페스트를 끌고 오지 않게 (button.tsx와 같음)
import { useSfx } from '@/components/providers/soundContext';
import { SOCIAL_LABEL, SOCIAL_MARK } from './brandMarks';

export interface SocialLoginButtonProps extends Omit<
  ComponentProps<'button'>,
  'children'
> {
  provider: SocialProvider;
  /** 로그인 화면으로 떠나는 중: 오른쪽 끝 바쁨 표시 + `aria-busy`, 누를 수 없음 (로고·글자는 그대로) */
  loading?: boolean;
  /** 누를 때 탭 효과음 (기본 켬). 소리는 유일한 신호가 아니다: 눌림 모양·바쁨 표시가 같이 바뀜 */
  sfx?: boolean;
  /** 눌린 모양으로 고정 (카탈로그용) */
  pressed?: boolean;
  /** 올려놓은 모양으로 고정 (카탈로그용) */
  hovered?: boolean;
}

/**
 * 소셜 로그인 버튼 한 개 (P3-05, docs/design/components.md §12). 모양만 담당하고 로그인 호출은 하지 않는다:
 * 실제 로그인은 `SocialLoginButtons`가 `useSocialLogin(provider)`(P1-14 헬퍼)로만 한다.
 *
 * 각 사 브랜드 가이드의 면 색·글자색·로고·문구를 그대로 쓴다(`social-login.css`, `brandMarks.tsx`).
 * 높이 54px · 반경 12px · 로고+글자 묶음 가운데 · 19px 굵은 pyRoad Sans.
 */
export function SocialLoginButton({
  provider,
  loading = false,
  sfx = true,
  pressed: forcePressed = false,
  hovered = false,
  disabled,
  className,
  type = 'button',
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  onKeyDown,
  onKeyUp,
  onBlur,
  ...props
}: SocialLoginButtonProps) {
  const [pressed, setPressed] = useState(false);
  const play = useSfx();
  const inactive = !!disabled || loading;
  const Mark = SOCIAL_MARK[provider];

  return (
    <button
      type={type}
      {...props}
      data-provider={provider}
      data-loading={loading || undefined}
      data-pressed={pressed || forcePressed || undefined}
      data-hover={hovered || undefined}
      aria-busy={loading || undefined}
      // 로딩 중에도 disabled: 떠나는 중이라 다시 누를 일이 없고 두 번 눌림을 막는다 (진행 중 안내는 묶음의 status 영역)
      disabled={inactive}
      className={cn('g-social font-sans', className)}
      onClick={(e) => {
        if (inactive) return;
        if (sfx) play('tap');
        onClick?.(e);
      }}
      onPointerDown={(e) => {
        if (!inactive && e.button === 0) setPressed(true);
        onPointerDown?.(e);
      }}
      onPointerUp={(e) => {
        setPressed(false);
        onPointerUp?.(e);
      }}
      onPointerLeave={(e) => {
        setPressed(false);
        onPointerLeave?.(e);
      }}
      onPointerCancel={(e) => {
        setPressed(false);
        onPointerCancel?.(e);
      }}
      onKeyDown={(e) => {
        if (!inactive && (e.key === ' ' || e.key === 'Enter')) setPressed(true);
        onKeyDown?.(e);
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') setPressed(false);
        onKeyUp?.(e);
      }}
      onBlur={(e) => {
        setPressed(false);
        onBlur?.(e);
      }}
    >
      <span className="g-social-mark">
        <Mark />
      </span>
      <span>{SOCIAL_LABEL[provider]}</span>
      {loading && (
        <span className="g-social-busy">
          <Loader2 aria-hidden className="animate-spin reduced:animate-none" />
        </span>
      )}
    </button>
  );
}
