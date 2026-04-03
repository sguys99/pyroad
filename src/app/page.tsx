import { HeroSection } from '@/components/landing/HeroSection';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { FeatureSection } from '@/components/landing/FeatureSection';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function Home() {
  return (
    <>
      <LandingHeader />
      <main className="flex flex-col items-center justify-start pt-[20vh] px-8">
        <HeroSection />
        <FeatureSection />
      </main>
      <LandingFooter />
    </>
  );
}
