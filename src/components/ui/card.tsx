import type { ComponentProps, ReactNode } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

// 모양 (P4-12: 전역 game-ui.css에서 떼어 이 컴포넌트를 쓰는 화면에만 싣는다)
import './card.css';
/**
 * 카드 (P2-11, docs/design/components.md §2). 최종 시안: 테두리 없이 흰 면 + 그림자 한 종류(`shadow-card`).
 * - 반경: m = 14px(기본, 작은 카드) · l = 20px(큰 카드·패널)
 * - `data-surface="raised"`: 안의 흰 버튼(secondary)·진행바 홈이 묻히지 않게 보조 면 색으로 바뀐다
 * - 누를 수 있는 카드는 `CardButton`(버튼 또는 `href` 링크): 올려놓으면 2px 뜨고 누르면 내려앉음(body 스프링),
 *   lite는 face 스프링, minimal은 즉시, 동작 줄이기는 움직임 없이 면 색만 (`.g-card-i`)
 */
type Radius = 'm' | 'l';
type Padding = 'none' | 'sm' | 'md' | 'lg';

const RADIUS: Record<Radius, string> = { m: 'rounded-xl', l: 'rounded-2xl' };
const PADDING: Record<Padding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

interface CardStyleProps {
  radius?: Radius;
  padding?: Padding;
}

function cardClass({ radius = 'm', padding = 'md' }: CardStyleProps) {
  return cn(
    'bg-card text-card-foreground shadow-card',
    RADIUS[radius],
    PADDING[padding],
  );
}

function Card({
  radius,
  padding,
  className,
  ...props
}: ComponentProps<'div'> & CardStyleProps) {
  return (
    <div
      data-slot="card"
      data-surface="raised"
      className={cn(cardClass({ radius, padding }), className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return (
    <h3
      data-slot="card-title"
      className={cn('font-display text-h3 text-foreground', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-small text-muted-foreground', className)}
      {...props}
    />
  );
}

type CardButtonProps = CardStyleProps & {
  className?: string;
  children?: ReactNode;
} & (
    | ({ href: string } & Omit<
        ComponentProps<typeof Link>,
        'href' | 'className'
      >)
    | ({ href?: undefined } & Omit<ComponentProps<'button'>, 'className'>)
  );

/** 누를 수 있는 카드: `href`가 있으면 링크, 없으면 버튼 */
function CardButton({ radius, padding, className, ...props }: CardButtonProps) {
  const cls = cn(
    cardClass({ radius, padding }),
    'g-card-i block w-full text-left',
    className,
  );
  if (props.href !== undefined) {
    return (
      <Link data-slot="card" data-surface="raised" className={cls} {...props} />
    );
  }
  const { type = 'button', ...rest } = props as ComponentProps<'button'>;
  return (
    <button
      data-slot="card"
      data-surface="raised"
      type={type}
      className={cls}
      {...rest}
    />
  );
}

export { Card, CardButton, CardDescription, CardTitle };
