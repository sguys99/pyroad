/**
 * 사이트 SEO 기본값 (P4-10). 루트 메타데이터(`src/app/layout.tsx`)·`robots.ts`·`sitemap.ts`·OG 이미지·구조화 데이터가 함께 쓴다.
 *
 * - 문구는 아이와 보호자가 모두 읽는 쉬운 한국어, **사실만**(무료·초등학생·웹 브라우저에서 진짜 파이썬 실행).
 *   운영자 실명·이메일은 넣지 않는다(공개 정보 원칙 §2.6, 운영자 정보는 약관·처리방침 화면에만 §12-Q37)
 * - 주소는 `NEXT_PUBLIC_SITE_URL`(선택). 없거나 잘못되면 운영 주소. 정적 페이지는 빌드 때 값이 들어간다
 */

/** 운영 주소 (env가 없을 때). `src/lib/legal/meta.ts`의 serviceUrl과 같다 */
export const DEFAULT_SITE_URL = 'https://pyroad.vercel.app';

export const SITE_NAME = 'pyRoad';

/** 기본 제목 (랜딩·공유 미리보기) */
export const SITE_TITLE = 'pyRoad - 파이뱀과 떠나는 파이썬 모험';

/** 하위 페이지 제목 틀: "이용약관 - pyRoad" */
export const SITE_TITLE_TEMPLATE = '%s - pyRoad';

/** 검색 결과·공유 미리보기 설명 (약 80자 안쪽) */
export const SITE_DESCRIPTION =
  '초등학생을 위한 무료 파이썬 학습 사이트예요. 파이뱀 선생님과 퀘스트를 깨며 웹 브라우저에서 진짜 파이썬 코드를 써 봐요.';

export const SITE_KEYWORDS = [
  '파이썬',
  '초등 코딩',
  '어린이 코딩',
  '초등학생 파이썬',
  '코딩 교육',
  '무료 코딩 학습',
  'Python',
  'pyRoad',
] as const;

/** OG 이미지 대체 글 */
export const OG_IMAGE_ALT =
  'pyRoad - 파이뱀과 떠나는 파이썬 모험. 초록 언덕 지도 위에서 손을 흔드는 뱀 캐릭터 파이뱀';

/**
 * 검색에 내보내는 공개 페이지 (sitemap). 모두 로그인 없이 볼 수 있다.
 * `/notice/[id]`는 목록에서 링크로 따라가게 두고 sitemap에는 넣지 않는다(DB 조회가 필요해 빌드 때 만들 수 없음)
 */
export const PUBLIC_PATHS = [
  '/',
  '/notice',
  '/terms',
  '/privacy',
  '/licenses',
] as const;

/**
 * 색인하지 않는 경로 (robots.txt Disallow). 로그인 화면은 미들웨어가 비로그인 요청을 `/`로 보내지만
 * 크롤러가 주소를 따라오지 않게 함께 막는다. 각 화면에도 `robots` 메타가 있다(보호 레이아웃·온보딩·/dev·/auth/error).
 * 공지 쓰기·고치기는 관리자 화면.
 */
export const NOINDEX_PATHS = [
  '/world',
  '/quest',
  '/profile',
  '/board',
  '/settings',
  '/onboarding',
  '/dev/',
  '/api/',
  '/auth/',
  '/notice/create',
  '/notice/*/edit',
] as const;

/**
 * 사이트 주소 (끝 `/` 없음). http(s) URL만 받고, 경로·쿼리는 버린다(출처만).
 * 잘못된 값은 운영 주소로 (빌드를 멈추지 않음).
 */
export function resolveSiteUrl(
  value: string | undefined = process.env.NEXT_PUBLIC_SITE_URL,
): string {
  const raw = value?.trim();
  if (!raw) return DEFAULT_SITE_URL;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return DEFAULT_SITE_URL;
    }
    return url.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

/** 사이트 주소 + 경로 → 절대 주소. `/`는 끝 슬래시 없이 출처만 */
export function absoluteUrl(path: string, base: string = resolveSiteUrl()) {
  if (path === '/' || path === '') return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
