'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LoginSheetButton } from '@/components/auth/LoginSheetButton';
import { LogoMark } from './LogoMark';
import { ScrollLink } from './ScrollLink';

/**
 * 랜딩 헤더 (P4-01, 최종 시안 `f-topnav`): 로고 + 바로가기(30초 체험·보호자 안내) + 로그인.
 * 히어로 위에서는 투명하고, 조금 내려가면 바탕색 면이 깔린다(흐림은 full 단계만, landing.css).
 * 360px에서는 로고 + "30초 체험" + 로그인, "보호자 안내"는 640px부터.
 */
export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      setScrolled(window.scrollY > 12);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header className="ld-header" data-scrolled={scrolled}>
      <div className="ld-header-in">
        <Link
          href="/"
          className="ld-logo font-display"
          aria-label="pyRoad 처음 화면"
        >
          <LogoMark size={32} />
          <span>pyRoad</span>
        </Link>
        <nav className="ld-nav" aria-label="랜딩 바로가기">
          <ScrollLink target="try">30초 체험</ScrollLink>
          <ScrollLink target="parents" data-wide="">
            보호자 안내
          </ScrollLink>
        </nav>
        {/* 로그인 시트(카카오·네이버·Google)를 연다 (P3-05) */}
        <LoginSheetButton
          cta="header"
          size="sm"
          variant="secondary"
          sfx={false}
        >
          로그인
        </LoginSheetButton>
      </div>
    </header>
  );
}
