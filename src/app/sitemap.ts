import type { MetadataRoute } from 'next';
import { PRIVACY_EFFECTIVE_DATE, TERMS_EFFECTIVE_DATE } from '@/lib/legal/meta';
import { PUBLIC_PATHS, absoluteUrl, resolveSiteUrl } from '@/lib/seo/site';

/**
 * sitemap.xml (P4-10). 로그인 없이 볼 수 있는 공개 페이지만. 빌드 때 정적 생성.
 * `lastModified`는 확실한 날짜가 있는 약관·처리방침(시행일)에만 단다(빌드 시각을 쓰면 매 배포 바뀐 것처럼 보임)
 */
const LAST_MODIFIED: Partial<Record<(typeof PUBLIC_PATHS)[number], string>> = {
  '/terms': TERMS_EFFECTIVE_DATE,
  '/privacy': PRIVACY_EFFECTIVE_DATE,
};

export default function sitemap(): MetadataRoute.Sitemap {
  const base = resolveSiteUrl();
  return PUBLIC_PATHS.map((path) => ({
    url: absoluteUrl(path, base),
    ...(LAST_MODIFIED[path] ? { lastModified: LAST_MODIFIED[path] } : {}),
  }));
}
