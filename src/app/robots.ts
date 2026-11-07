import type { MetadataRoute } from 'next';
import { NOINDEX_PATHS, absoluteUrl, resolveSiteUrl } from '@/lib/seo/site';

/** robots.txt (P4-10). 공개 페이지만 색인, 로그인 화면·API·개발 전용·인증 경로는 막는다. 빌드 때 정적 생성 */
export default function robots(): MetadataRoute.Robots {
  const base = resolveSiteUrl();
  return {
    rules: { userAgent: '*', allow: '/', disallow: [...NOINDEX_PATHS] },
    sitemap: absoluteUrl('/sitemap.xml', base),
  };
}
