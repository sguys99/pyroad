'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { PybaemSvg } from '@/components/characters/PybaemSvg';
import { LoginSheetButton } from '@/components/auth/LoginSheetButton';

export function LandingHeader() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-(--dur-slow)',
          isScrolled
            ? 'bg-background/80 backdrop-blur-md no-blur:bg-background/95 shadow-card'
            : 'bg-transparent',
        )}
      >
        <nav
          aria-label="메인 네비게이션"
          className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6"
        >
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight text-primary-text"
          >
            <PybaemSvg expression="happy" size={32} />
            pyRoad
          </Link>

          {/* 좁은 화면(320~390px)에서 로그인 버튼이 화면 밖으로 밀리지 않게: 간격을 줄이고 About(같은 화면 아래 절)은 sm부터 */}
          <div className="flex items-center gap-1 sm:gap-4">
            <a
              href="#about"
              className="hidden sm:flex min-h-[44px] min-w-[44px] items-center justify-center text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              About
            </a>

            <Link
              href="/notice"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              공지사항
            </Link>

            <a
              href="https://github.com/sguys99/pyroad"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub 저장소 (새 창)"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
              </svg>
              <span className="hidden sm:inline">GitHub</span>
            </a>

            {/* 로그인 시트(카카오·네이버·Google)를 연다 (P3-05) */}
            <LoginSheetButton cta="header" size="sm" sfx={false}>
              로그인
            </LoginSheetButton>
          </div>
        </nav>
      </header>
    </>
  );
}
