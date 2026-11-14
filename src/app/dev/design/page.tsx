import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import type { Metadata } from 'next';
import { isTestPagesEnabled } from '@/lib/env/testPages';
import { isMotionTier } from '@/lib/motion/tier';
// 앱 화면 웹폰트(제목 Jua·본문 pyRoad Sans 조각)와 코드 글꼴. 루트 레이아웃은 웹폰트를 싣지 않는다 (P2-10)
import '@/fonts/app.css';
// 앱 화면 전용 유틸리티·연출 CSS (P4-12: 루트 globals.css는 랜딩이 닿는 소스만 훑는다)
import '@/app/app.css';
import '@/fonts/pyroad-mono/pyroad-mono.css';
// 온보딩 조각(P3-11)은 globals.css 밖 스타일 (랜딩 CSS 예산)
import '@/components/onboarding/onboarding.css';
import '@/components/consent/consent.css';
import { PolicyLiveProvider } from '@/components/legal/PolicyLive';
import { DesignCatalog, type ReducedChoice, type TierChoice } from './DesignCatalog';

export const metadata: Metadata = {
  title: '디자인 카탈로그 (개발 전용)',
  robots: { index: false, follow: false },
};

/**
 * 컴포넌트 카탈로그 (P2-12, 개발·e2e 전용, docs/design/catalog.md). 토큰·공통 컴포넌트·마스코트 리그·사운드·공유 카드를
 * 한 화면에서 보고, 위 막대에서 연출 단계(full·lite·minimal)와 동작 줄이기를 바꿔 모든 연출의 대체 동작을 확인한다.
 * `?motion=full|lite|minimal&reduced=on|off`로 처음 단계를 정할 수 있다 (e2e `e2e/public/design-catalog.spec.ts`).
 * 운영 빌드에서는 404 (`isTestPagesEnabled`)
 */
export default async function DesignCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ motion?: string; reduced?: string }>;
}) {
  await connection(); // 동적 렌더: 정적 HTML로 굳지 않고 요청 때 env를 읽는다 (CSP nonce도 요청마다)
  if (!isTestPagesEnabled()) notFound();
  const { motion, reduced } = await searchParams;
  const tier: TierChoice = isMotionTier(motion) ? motion : 'auto';
  const reducedChoice: ReducedChoice =
    reduced === 'on' || reduced === 'off' ? reduced : 'system';
  // 견본은 시행일과 상관없이 자랑하기·자유 질문까지 보인다 (B79)
  return (
    <PolicyLiveProvider live>
      <DesignCatalog initialTier={tier} initialReduced={reducedChoice} />
    </PolicyLiveProvider>
  );
}
