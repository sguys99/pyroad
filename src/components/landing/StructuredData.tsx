import { buildStructuredData, serializeJsonLd } from '@/lib/seo/structuredData';
import { resolveSiteUrl } from '@/lib/seo/site';

/**
 * 랜딩 구조화 데이터 (P4-10). 서버 컴포넌트, 클라이언트 JS 없음. 랜딩 `page.tsx`에 `<StructuredData />` 한 줄로 붙인다.
 *
 * CSP: `type="application/ld+json"`은 실행 스크립트가 아니라 **데이터 블록**이라 브라우저가 실행하지 않고
 * `script-src` 검사 대상도 아니다(정적 랜딩의 `'unsafe-inline'` 정책·다른 페이지의 nonce 정책 모두 무관, 단위 테스트·브라우저 확인).
 * 그래서 nonce를 붙이지 않는다 — 정적 페이지라 요청마다 nonce를 읽을 수도 없다.
 */
export function StructuredData() {
  return (
    <script
      type="application/ld+json"
      // 값은 코드 상수뿐이고 serializeJsonLd가 <·>·&를 이스케이프한다
      dangerouslySetInnerHTML={{
        __html: serializeJsonLd(buildStructuredData(resolveSiteUrl())),
      }}
    />
  );
}
