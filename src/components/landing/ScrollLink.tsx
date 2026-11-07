'use client';

import type { ComponentProps, MouseEvent } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { scrollToSection } from './scrollToSection';

function useJump(target: string) {
  const { reduced } = useMotionTier();
  return (e: MouseEvent) => {
    // 새 탭·창으로 열기는 그대로 둔다
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (scrollToSection(target, reduced)) e.preventDefault();
  };
}

/** 같은 페이지 섹션으로 가는 글자 링크 (헤더 바로가기). 자바스크립트가 없으면 보통 앵커로 동작 */
export function ScrollLink({
  target,
  onClick,
  ...props
}: Omit<ComponentProps<'a'>, 'href'> & { target: string }) {
  const jump = useJump(target);
  return (
    <a
      href={`#${target}`}
      {...props}
      onClick={(e) => {
        jump(e);
        onClick?.(e);
      }}
    />
  );
}

/** 같은 페이지 섹션으로 가는 게임 버튼 (히어로 "30초 체험") */
export function ScrollButton({
  target,
  ...props
}: Omit<ButtonProps, 'href' | 'onClick'> & { target: string }) {
  const jump = useJump(target);
  return (
    <Button
      href={`#${target}`}
      {...props}
      onClick={(e) => jump(e as unknown as MouseEvent)}
    />
  );
}
