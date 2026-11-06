import { HeroSection } from '@/components/landing/HeroSection';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { AboutSection } from '@/components/landing/AboutSection';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingViewTracker } from '@/components/landing/LandingViewTracker';
import { displayLanding, sansLanding } from '@/fonts/landing';
import { cn } from '@/lib/utils';

export default function Home() {
  return (
    // 랜딩 텍스트 서브셋을 --font-display·--font-sans 맨 앞에 끼운다 (P2-10). contents라 레이아웃에는 영향 없음
    <div
      className={cn(
        'contents font-sans',
        displayLanding.variable,
        sansLanding.variable,
      )}
    >
      <LandingHeader />
      <main className="flex flex-col items-center justify-start pt-[20vh] px-8">
        <HeroSection />
        <AboutSection />
      </main>
      <LandingFooter />
      <LandingViewTracker />
    </div>
  );
}
