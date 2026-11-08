import { LandingHeader } from '@/components/landing/LandingHeader';
import { HeroSection } from '@/components/landing/hero/HeroSection';
import { TrialSection } from '@/components/landing/sections/TrialSection';
import { WorldsSection } from '@/components/landing/sections/WorldsSection';
import { FunShowcaseSection } from '@/components/landing/sections/FunShowcaseSection';
import { FriendsSection } from '@/components/landing/sections/FriendsSection';
import { ParentsSection } from '@/components/landing/sections/ParentsSection';
import { FaqSection } from '@/components/landing/sections/FaqSection';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingViewTracker } from '@/components/landing/LandingViewTracker';
import { LandingDeferredCss } from '@/components/landing/LandingDeferredCss';
import { LandingLoginError } from '@/components/auth/LandingLoginError';
import { StructuredData } from '@/components/landing/StructuredData';
import { displayLanding, sansLanding } from '@/fonts/landing';
import { LANDING_INSTALL_GUARD_SCRIPT } from '@/lib/pwa/landingInstallGuard';
import { cn } from '@/lib/utils';
import '@/components/landing/landing.css';

/**
 * 랜딩 (Phase 4, 최종 시안 `design/prototypes/src/final/Landing.tsx` 구성).
 * 헤더 → 히어로 → 30초 체험(#try) → 세계관(#worlds) → 재미 쇼케이스(#fun) → 캐릭터(#friends) → 보호자(#parents) → FAQ(#faq) → 푸터.
 * 정적 렌더 페이지(`STATIC_PAGE_PATHS`): cookies()·headers() 같은 동적 API를 쓰지 않는다 (§2.10).
 */
export default function Home() {
  return (
    // 랜딩 텍스트 서브셋을 --font-display·--font-sans 맨 앞에 끼운다 (P2-10)
    <div
      className={cn(
        'landing font-sans',
        displayLanding.variable,
        sansLanding.variable,
      )}
    >
      {/* 검색엔진용 JSON-LD 데이터 블록 (P4-10). 실행 스크립트가 아니라 CSP와 무관 */}
      <StructuredData />
      {/* 비로그인 방문자에게 안드로이드 자동 설치 띠를 띄우지 않는다 (P4-11: 설치 안내는 로그인 뒤에만). 정적 CSP 'unsafe-inline' */}
      <script
        dangerouslySetInnerHTML={{ __html: LANDING_INSTALL_GUARD_SCRIPT }}
      />
      <LandingHeader />
      <main>
        <HeroSection />
        <TrialSection />
        <WorldsSection />
        <FunShowcaseSection />
        <FriendsSection />
        <ParentsSection />
        <FaqSection />
      </main>
      <LandingFooter />
      <LandingViewTracker />
      {/* 아래쪽 섹션 CSS를 늦게 받는다 (P4-12, 렌더 차단 CSS 예산). 자바스크립트가 없으면 CSS 없이라도 본문을 보인다 */}
      <LandingDeferredCss />
      <noscript>
        <style>{'.ld-sec{--ld-css:visible}'}</style>
      </noscript>
      {/* 로그인 실패·취소로 돌아오면 로그인 시트를 열어 안내 (P3-10) */}
      <LandingLoginError />
    </div>
  );
}
