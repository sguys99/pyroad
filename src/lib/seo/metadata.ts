/**
 * Next 메타데이터 묶음 (P4-10). 루트 기본값과 공개 하위 페이지용 조각.
 *
 * - 공유 미리보기 그림은 `src/app/opengraph-image.tsx`(빌드 때 정적 생성)를 Next가 `og:image`·`twitter:image`로 붙인다.
 *   여기서 `images`를 적지 않는다(적으면 파일 규칙 이미지를 덮어씀)
 * - `canonical`·`og:url`은 `'./'` = 각 페이지 자기 주소(쿼리 제외). `metadataBase`가 절대 주소로 바꾼다
 * - 테마 색(`themeColor`)은 메타데이터가 아니라 `viewport` export (Next 14+)
 * - `robots`는 루트에 적지 않는다(기본이 색인 허용). 404는 Next가 `noindex`를 붙이는데 루트에 `index`가 있으면 둘 다 나간다.
 *   색인 제외는 화면별 `robots: { index: false }` + `src/app/robots.ts`
 */
import type { Metadata, Viewport } from 'next';
import { COLOR } from '@/lib/design/tokens';
import {
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TITLE,
  SITE_TITLE_TEMPLATE,
  resolveSiteUrl,
} from './site';

export function rootMetadata(siteUrl: string = resolveSiteUrl()): Metadata {
  return {
    metadataBase: new URL(siteUrl),
    title: { default: SITE_TITLE, template: SITE_TITLE_TEMPLATE },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    keywords: [...SITE_KEYWORDS],
    alternates: { canonical: './' },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'ko_KR',
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      url: './',
    },
    twitter: {
      card: 'summary_large_image',
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
    },
  };
}

/** 브라우저 주소창·작업 표시줄 색 = 단색 바탕 토큰 (랜딩·앱 바탕과 같음) */
export const rootViewport: Viewport = {
  themeColor: COLOR.bg,
};

/**
 * 공개 하위 페이지(약관·공지 등) 메타데이터. 제목은 루트 틀로 "이용약관 - pyRoad"가 되고,
 * 공유 미리보기(og·twitter) 제목·설명도 그 페이지 것으로 맞춘다(그림은 루트 OG 이미지를 물려받음).
 */
export function publicPageMetadata({
  title,
  description,
}: {
  title: string;
  description: string;
}): Metadata {
  const full = SITE_TITLE_TEMPLATE.replace('%s', title);
  return {
    title,
    description,
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'ko_KR',
      title: full,
      description,
      url: './',
    },
    twitter: { card: 'summary_large_image', title: full, description },
  };
}
