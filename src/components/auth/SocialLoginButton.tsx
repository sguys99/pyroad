'use client';

import { useId, useState, type ComponentProps } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SocialProvider } from '@/lib/auth/socialLogin';
import { lastLoginBadgeText } from '@/lib/auth/loginProvider';
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
  /**
   * 이 기기에서 최근에 쓴 로그인 수단 (P3-08): 오른쪽 위에 금색 "최근에 사용" 이름표 + 낭독기용 설명
   * ("최근에 카카오로 로그인했어요", `aria-describedby`). 버튼 이름(브랜드 문구)은 그대로
   */
  recent?: boolean;
  /**
   * lg: 60px 높이 + 큰 글자·로고 (P3-09, 카카오톡 인앱의 카카오 버튼처럼 그 화면에서 가장 쉬운 수단). 기본 md 54px.
   * 비율을 함께 키워 카카오 가이드(레이블 높이 ≤ 1/3)를 지킨다
   */
  size?: 'md' | 'lg';
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
  recent = false,
  size = 'md',
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
  const recentId = useId();
  const describedBy =
    cn(props['aria-describedby'], recent && recentId) || undefined;

  return (
    <>
      <button
        type={type}
        {...props}
        data-provider={provider}
        data-size={size === 'lg' ? 'lg' : undefined}
        data-loading={loading || undefined}
        data-pressed={pressed || forcePressed || undefined}
        data-hover={hovered || undefined}
        aria-busy={loading || undefined}
        aria-describedby={describedBy}
        data-recent={recent || undefined}
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
          if (!inactive && (e.key === ' ' || e.key === 'Enter'))
            setPressed(true);
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
        {/* 그림 이름표는 장식(이름에 섞이지 않게 aria-hidden), 같은 뜻의 문장은 버튼 밖에서 설명으로 읽는다 */}
        {recent && (
          <span className="g-social-recent" aria-hidden>
            최근에 사용
          </span>
        )}
        {loading && (
          <span className="g-social-busy">
            <Loader2
              aria-hidden
              className="animate-spin reduced:animate-none"
            />
          </span>
        )}
      </button>
      {recent && (
        <span id={recentId} className="sr-only">
          {lastLoginBadgeText(provider)}
        </span>
      )}
    </>
  );
}
