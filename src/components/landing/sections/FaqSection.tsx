import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { serializeJsonLd } from '@/lib/seo/structuredData';
import { LandingSection } from '../LandingSection';
import { buildFaqStructuredData, FAQ } from './faq/faq';
// 스타일 `faq.css`는 여기서 import하지 않는다: 첫 화면 밖이라 렌더 차단 CSS에서 빼고 `../deferredCss.ts`가 늦게 받는다 (P4-12)

/**
 * 랜딩 `#faq` 자주 묻는 질문 (P4-08). 서버 컴포넌트, 클라이언트 JS 없음.
 *
 * - 아코디언은 기본 `<details>`/`<summary>`: JS 없이 열리고, 키보드(Tab·Enter·Space)와 화면 낭독기("펼침/접힘")가 그대로 된다
 * - 열고 닫힐 때 높이 애니메이션은 full만(`::details-content` + `interpolate-size`, 지원하지 않는 브라우저는 즉시).
 *   화살표 회전은 full·lite, minimal·동작 줄이기는 즉시 (faq.css)
 * - 같은 질문·답으로 FAQPage JSON-LD를 섹션 안에 싣는다 (데이터 블록이라 CSP와 무관, StructuredData.tsx와 같은 방식)
 * - 문구는 `faq/faq.ts`(근거 주석과 함께). 앵커 id `faq`·제목 id `faq-title`은 바꾸지 않는다
 * - 문구를 바꾸면 `npm run fonts:build -- --landing` → `npm run fonts:check`
 */
export function FaqSection() {
  return (
    <LandingSection
      id="faq"
      deferredCss="faq"
      kicker="궁금한 점"
      title="자주 묻는 질문"
      width="narrow"
    >
      <div className="ld-faq-list">
        {FAQ.map((item) => (
          <details
            key={item.id}
            className="ld-faq-item"
            data-testid={`faq-${item.id}`}
          >
            <summary className="ld-faq-q">
              <span>{item.q}</span>
              <ChevronDown aria-hidden className="ld-faq-chev" />
            </summary>
            <div className="ld-faq-a">
              <p>
                {item.a}
                {item.more && (
                  <>
                    {' '}
                    <Link
                      href={item.more.href}
                      // 앱 CSS를 쓰는 약관 화면이라 미리 받지 않음 (P4-13, LandingFooter 참고)
                      prefetch={false}
                      className="ld-faq-more"
                    >
                      {item.more.label} 보기
                    </Link>
                  </>
                )}
              </p>
            </div>
          </details>
        ))}
      </div>
      <script
        type="application/ld+json"
        // 값은 코드 상수뿐이고 serializeJsonLd가 <·>·&를 이스케이프한다
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildFaqStructuredData(FAQ)),
        }}
      />
    </LandingSection>
  );
}
