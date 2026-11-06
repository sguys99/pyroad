'use client';

import { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import Link from 'next/link';
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { jelly, springTiming } from '@/lib/motion/tokens';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
// 가벼운 컨텍스트 모듈: 랜딩에서 매니페스트·엔진 문구를 끌고 오지 않게 (fonts:check 랜딩 서브셋)
import { useSfx } from '@/components/providers/soundContext';
import type { SfxId } from '@/lib/sound/manifest';

/**
 * 게임 버튼 (P2-11, docs/design/components.md §1). 최종 시안 `InkButton`: 테두리 없는 면 + 아랫면 3px(`--lip-h`).
 * 스타일은 `game-ui.css`의 `.g-btn`.
 *
 * - 변형: primary(초록, 주요 행동) · secondary(흰 면) · reward(금색, 보상 받기) · danger(흰 면 + 오류색 글자) · ghost(글자 버튼)
 * - 크기: sm(45+3=48px) · md(48+3) · lg(54+3). 아이콘 슬롯 `icon`·`iconRight`, `loading`(바쁨 표시 + 누를 수 없음)
 * - 눌림: 아랫면만큼 내려감(CSS `:active`·`data-pressed`) → 손을 떼면 복귀. full은 jellyB 출렁임(여기 WAAPI, 시안 `pressRelease`),
 *   lite는 face 스프링, minimal은 즉시, 동작 줄이기는 움직이지 않고 면 색만 진해짐 (CSS가 `<html data-motion data-reduced>`를 본다)
 * - 탭 효과음: 기본은 primary·reward(주요 CTA)만 `tap`. 다른 소리를 내는 버튼(실행 → `run`, 힌트)은 `sfx={false}`
 * - `href`를 주면 Next `<Link>`로 그린다. Base UI `render`(대화 상자 Trigger·Close가 이 버튼을 그릴 때)도 그대로 받는다
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'reward'
  | 'danger'
  | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonPrimitive.Props, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 글자 앞 아이콘 (lucide 등). 크기는 글자에 맞춰진다 */
  icon?: ReactNode;
  /** 글자 뒤 아이콘 */
  iconRight?: ReactNode;
  /** 바쁨: 앞 아이콘 자리에 도는 표시, `aria-busy`, 누를 수 없음 (변형 색은 유지) */
  loading?: boolean;
  /** 누를 때 효과음. 기본: primary·reward는 `tap`, 나머지는 없음 */
  sfx?: SfxId | false;
  /** 링크 버튼 (Next `<Link>`, 소프트 내비게이션) */
  href?: string;
  /** 눌린 모양으로 고정 (카탈로그·미리 보기용, P2-12) */
  pressed?: boolean;
  className?: string;
}

/** 원래 핸들러의 이벤트 타입 (Base UI 이벤트) */
type Ev<K extends keyof ButtonProps> = Parameters<
  NonNullable<ButtonProps[K]>
>[0];

const DEFAULT_SFX: Record<ButtonVariant, SfxId | false> = {
  primary: 'tap',
  reward: 'tap',
  secondary: false,
  danger: false,
  ghost: false,
};

function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  sfx,
  href,
  pressed: forcePressed = false,
  render,
  nativeButton,
  disabled,
  className,
  children,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  onKeyDown,
  onKeyUp,
  onBlur,
  ...props
}: ButtonProps) {
  const faceRef = useRef<HTMLSpanElement>(null);
  const [pressed, setPressed] = useState(false);
  const { tier, reduced } = useMotionTier();
  const play = useSfx();
  const sound = sfx ?? DEFAULT_SFX[variant];
  const inactive = !!disabled || loading;

  // 손을 뗄 때 full 단계만 젤리 출렁임 (시작 키프레임 하나 → CSS가 정한 지금 값으로 돌아감)
  const release = () => {
    if (!pressed) return;
    setPressed(false);
    const face = faceRef.current;
    if (reduced || tier !== 'full' || inactive || !face?.animate) return;
    // 아랫면 깊이는 토큰 변수(--lip-h)에서 읽는다 (tokens.ts를 import하면 랜딩 서브셋에 대비표 문구가 들어감)
    const lip =
      getComputedStyle(face).getPropertyValue('--lip-h').trim() || '3px';
    face.animate(
      [
        {
          transform: `translateY(${lip}) scale(1.03, 0.96) rotate(-0.6deg)`,
          offset: 0,
        },
      ],
      springTiming(jelly()),
    );
  };

  const leading = loading ? (
    <Loader2 aria-hidden className="animate-spin reduced:animate-none" />
  ) : (
    icon
  );

  const face = (
    <span
      ref={faceRef}
      className={cn(
        'g-btn-face',
        variant === 'ghost' ? 'font-sans' : 'font-display',
      )}
    >
      {leading && <span className="g-btn-icon">{leading}</span>}
      {children}
      {iconRight && <span className="g-btn-icon">{iconRight}</span>}
    </span>
  );

  // 눌림 상태·소리 (버튼·링크 공통). 이벤트 타입은 요소마다 달라 넓게 받는다
  const shared = {
    'data-slot': 'button',
    'data-variant': variant,
    'data-size': size,
    'data-pressed': pressed || forcePressed || undefined,
    'data-loading': loading || undefined,
    'aria-busy': loading || undefined,
    className: cn('g-btn', className),
    onPointerDown: (e: Ev<'onPointerDown'>) => {
      if (!inactive && e.button === 0) setPressed(true);
      onPointerDown?.(e);
    },
    onPointerUp: (e: Ev<'onPointerUp'>) => {
      release();
      onPointerUp?.(e);
    },
    onPointerLeave: (e: Ev<'onPointerLeave'>) => {
      setPressed(false);
      onPointerLeave?.(e);
    },
    onPointerCancel: (e: Ev<'onPointerCancel'>) => {
      setPressed(false);
      onPointerCancel?.(e);
    },
    onKeyDown: (e: Ev<'onKeyDown'>) => {
      if (!inactive && (e.key === ' ' || e.key === 'Enter')) setPressed(true);
      onKeyDown?.(e);
    },
    onKeyUp: (e: Ev<'onKeyUp'>) => {
      if (e.key === ' ' || e.key === 'Enter') release();
      onKeyUp?.(e);
    },
    onBlur: (e: Ev<'onBlur'>) => {
      setPressed(false);
      onBlur?.(e);
    },
  };

  // 링크 버튼: 역할은 그대로 link (Base UI는 a에 role="button"을 붙이므로 쓰지 않는다)
  if (href) {
    return (
      <Link
        href={href}
        aria-disabled={inactive || undefined}
        {...(props as Omit<ComponentProps<typeof Link>, 'href'>)}
        {...(shared as unknown as ComponentProps<'a'>)}
        onClick={(e) => {
          if (inactive) {
            e.preventDefault();
            return;
          }
          if (sound) play(sound);
          onClick?.(e as unknown as Ev<'onClick'>);
        }}
      >
        {face}
      </Link>
    );
  }

  return (
    <ButtonPrimitive
      {...props}
      {...shared}
      disabled={inactive}
      render={render}
      nativeButton={nativeButton}
      onClick={(e) => {
        if (inactive) return;
        if (sound) play(sound);
        onClick?.(e);
      }}
    >
      {face}
    </ButtonPrimitive>
  );
}

export interface IconButtonProps extends Omit<
  ComponentProps<'button'>,
  'aria-label'
> {
  /** 접근성 이름 (아이콘만 있으므로 필수) */
  label: string;
  /** md: 48px 원 · sm: 40px 원(누르는 자리는 48px) */
  size?: 'md' | 'sm';
  /** 눌린 모양으로 고정 (카탈로그·미리 보기용, P2-12) */
  pressed?: boolean;
}

/** 아이콘만 있는 둥근 버튼: HUD 소리 토글, 시트·토스트 닫기 (`.g-icon-btn`) */
function IconButton({
  label,
  size = 'md',
  pressed = false,
  className,
  type = 'button',
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      data-size={size}
      data-pressed={pressed || undefined}
      className={cn('g-icon-btn', className)}
      {...props}
    >
      {children}
    </button>
  );
}

export { Button, IconButton };
