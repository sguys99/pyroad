/**
 * 랜딩 구조화 데이터 (P4-10, schema.org JSON-LD). `src/components/landing/StructuredData.tsx`가 `<script type="application/ld+json">`로 싣는다.
 *
 * 사실만 적는다:
 * - `WebSite` + `WebApplication`(웹 브라우저에서 쓰는 학습 앱). 회사·학교가 아니므로 `Organization`·`EducationalOrganization`은 쓰지 않는다
 * - 무료: 약관 제11조("결제, 유료 아이템, 확률형 뽑기를 제공하지 않습니다") → `isAccessibleForFree` + 가격 0 `Offer`
 * - 대상: 초등학생(온보딩 학년 1~6). 나이는 한국 초등학교 1~6학년 만 나이 대략 7~12세
 * - 운영자는 개인 개발자(§12-Q37)지만 **실명·이메일은 넣지 않는다**: 공개 정보 원칙(§2.6)과 검색 노출 범위를 줄이려고.
 *   운영자 정보는 약관·처리방침 화면에만 있다
 */
import { OG_IMAGE_ALT, SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from './site';

export type JsonLd = Record<string, unknown>;

export function buildStructuredData(siteUrl: string): JsonLd {
  const home = absoluteUrl('/', siteUrl);
  const websiteId = `${home}/#website`;
  const appId = `${home}/#app`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': websiteId,
        url: home,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: 'ko-KR',
      },
      {
        '@type': 'WebApplication',
        '@id': appId,
        url: home,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: 'ko-KR',
        isPartOf: { '@id': websiteId },
        applicationCategory: 'EducationalApplication',
        operatingSystem: '웹 브라우저',
        browserRequirements:
          'JavaScript와 WebAssembly를 지원하는 최신 웹 브라우저',
        image: {
          '@type': 'ImageObject',
          url: absoluteUrl('/opengraph-image', siteUrl),
          width: 1200,
          height: 630,
          caption: OG_IMAGE_ALT,
        },
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
        teaches: '파이썬 프로그래밍 기초',
        audience: {
          '@type': 'EducationalAudience',
          educationalRole: 'student',
          audienceType: '초등학생',
        },
        typicalAgeRange: '7-12',
      },
    ],
  };
}

/**
 * JSON-LD 문자열. `<script>` 안에 넣으므로 `<`·`>`·`&`와 줄 구분 문자(U+2028·2029)를 유니코드 이스케이프로 바꿔
 * `</script>`로 블록이 끝나거나 HTML로 해석될 틈을 없앤다(값은 지금 모두 코드 상수지만 나중을 위해).
 */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
