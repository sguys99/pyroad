'use client';

import { useRouter } from 'next/navigation';
import type { MouseEvent } from 'react';

import { useMotionTier } from '@/lib/motion/MotionTierProvider';

/**
 * 책 ↔ 지도 전환 (P5-01). View Transitions API가 있으면 쓴다:
 * - morph(full): 누른 표지(`from`)와 새 화면의 대상(`target` 선택자, 예: 지도 `.world-map`)에 같은 이름(world-book)을 붙여
 *   표지가 지도 자리로 펼쳐지듯 커진다(반대로 지도 → 책장 표지로 접힘). 나머지 화면은 교차 페이드
 * - fade(lite): 짧은 교차 페이드만
 * - none(minimal·동작 줄이기) 또는 미지원 브라우저: 그냥 이동 (새 화면 등장은 PageTransition 규칙: lite 페이드·minimal 즉시)
 * 길이·곡선은 worldBook.css(`<html data-book-vt>`)가 토큰으로 정한다. 한 번만 재생, 반복 없음
 */
export type BookTransitionMode = 'morph' | 'fade' | 'none';

const NAME = 'world-book';
/** 새 화면 렌더(서버 왕복)를 기다리는 최대 시간. 넘으면 있는 그대로 전환을 끝낸다 (브라우저가 화면을 오래 멈추지 않게) */
const WAIT_MS = 2500;

type VtDocument = Document & {
  startViewTransition?: (update: () => Promise<void>) => {
    finished: Promise<void>;
  };
};

export function bookTransitionMode(
  tier: 'full' | 'lite' | 'minimal',
  reduced: boolean,
): BookTransitionMode {
  if (reduced || tier === 'minimal') return 'none';
  return tier === 'full' ? 'morph' : 'fade';
}

export function navigateWithBook(
  push: (href: string) => void,
  href: string,
  mode: BookTransitionMode,
  from: HTMLElement | null,
  target: string,
): void {
  const doc = document as VtDocument;
  if (mode === 'none' || !doc.startViewTransition) {
    push(href);
    return;
  }
  const path = new URL(href, window.location.href).pathname;
  const root = document.documentElement;
  let to: HTMLElement | null = null;
  if (mode === 'morph' && from) from.style.viewTransitionName = NAME;
  root.dataset.bookVt = mode;

  const transition = doc.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        // 옛 화면은 이미 찍혔다: 이름을 떼어 새 화면의 대상만 그 이름을 갖게
        if (from) from.style.viewTransitionName = '';
        push(href);
        const start = performance.now();
        // 렌더가 멈춘 동안이라 rAF 대신 타이머로 새 화면을 기다린다
        const wait = () => {
          to =
            window.location.pathname === path
              ? document.querySelector<HTMLElement>(target)
              : null;
          if (to || performance.now() - start > WAIT_MS) {
            if (to && mode === 'morph') to.style.viewTransitionName = NAME;
            resolve();
          } else setTimeout(wait, 16);
        };
        wait();
      }),
  );
  transition.finished.finally(() => {
    if (to) to.style.viewTransitionName = '';
    delete root.dataset.bookVt;
  });
}

/**
 * 링크 onClick 에 붙이는 손잡이. 새 탭·수정 키 클릭은 브라우저 기본 동작 그대로.
 * `from`은 누른 링크 안의 `[data-vt-book]`(표지) 또는 직접 준 요소
 */
export function useBookNavigate() {
  const router = useRouter();
  const { tier, reduced } = useMotionTier();
  const mode = bookTransitionMode(tier, reduced);
  return (
    event: MouseEvent<HTMLElement>,
    href: string,
    target: string,
    from?: HTMLElement | null,
  ) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    navigateWithBook(
      (h) => router.push(h),
      href,
      mode,
      from ??
        event.currentTarget.querySelector<HTMLElement>('[data-vt-book]') ??
        null,
      target,
    );
  };
}
