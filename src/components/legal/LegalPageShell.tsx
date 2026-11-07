import type { ReactNode } from 'react';
import Link from 'next/link';
import { LEGAL_LINKS, LEGAL_OPERATOR, type LegalPath } from '@/lib/legal/meta';
import { cn } from '@/lib/utils';

/**
 * 법적 고지 페이지 틀 (P3-14): `/terms` · `/privacy` · `/licenses`.
 * 비로그인 열람 + 빌드 때 정적 HTML(CSP 정적 정책, `STATIC_PAGE_PATHS`)이라 요청·로그인 정보를 읽지 않는다.
 * 위 "pyRoad"는 `/`로 가고, 로그인한 사람은 미들웨어가 월드맵으로 보낸다. 360px에서 가로 스크롤이 생기지 않게 한 줄 폭을 줄인다.
 */
export function LegalPageShell({
  current,
  children,
}: {
  current: LegalPath;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <Link
            href="/"
            className="focus-ring rounded-md font-display text-h3 text-primary-text"
          >
            {LEGAL_OPERATOR.serviceName}
          </Link>
          <LegalNav current={current} />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-6 pb-16">{children}</main>
    </div>
  );
}

/** 이용약관 · 개인정보처리방침 · 오픈소스 고지 사이 이동 (지금 페이지는 `aria-current`) */
export function LegalNav({
  current,
  className,
}: {
  current?: LegalPath;
  className?: string;
}) {
  return (
    <nav aria-label="약관과 정책" className={className}>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-caption">
        {LEGAL_LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={l.href === current ? 'page' : undefined}
              className={cn(
                'focus-ring inline-flex min-h-10 items-center rounded-md underline-offset-4 hover:underline',
                l.href === current
                  ? 'font-semibold text-foreground underline'
                  : 'text-muted-foreground',
              )}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
