import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 화면 위 뒤로 가기 "‹ 월드맵" (docs/design/components.md §15, B100). 글자는 갈 곳 이름만("월드맵"·"프로필"·"게시판").
 * 상점·프로필·업적 도감·갤러리·설정·게시판·공지가 같이 쓴다. 스타일은 Tailwind 유틸리티라 새 CSS 없음(랜딩 CSS 예산)
 */
export function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'focus-ring inline-flex min-h-touch items-center gap-0.5 rounded-sm pr-2 font-semibold text-primary-text [&>svg]:size-5',
        className,
      )}
    >
      <ChevronLeft aria-hidden />
      {children}
    </Link>
  );
}
