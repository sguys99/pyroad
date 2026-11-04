'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';

/**
 * 퀘스트 진입 링크. 지금 문서가 crossOriginIsolated가 아니면 하드 내비게이션(location.assign)으로
 * 퀘스트 문서를 새로 받아 COOP/COEP가 적용되게 하고, 이미 격리된 문서(퀘스트 → 퀘스트)에서는 소프트 내비게이션.
 */
export default function QuestLink(props: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        props.onClick?.(e);
        if (!self.crossOriginIsolated && !e.defaultPrevented) {
          e.preventDefault();
          window.location.assign(String(props.href));
        }
      }}
    />
  );
}
