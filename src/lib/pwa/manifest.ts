/**
 * 웹 앱 매니페스트 (P4-11, `src/app/manifest.ts` → `/manifest.webmanifest`). 빌드 때 정적 생성.
 *
 * - 이름·설명은 사이트 메타데이터(`src/lib/seo/site.ts`)와 같은 말
 * - `start_url: '/world'`: 홈 화면에서 여는 사람은 거의 로그인한 아이(안내를 로그인 뒤에만 보임) → 월드맵으로 바로.
 *   로그인이 풀렸으면 미들웨어가 `/`(랜딩)로 보내고, 온보딩 전이면 보호 레이아웃이 `/onboarding`으로 보낸다
 *   (`/`로 두면 로그인한 아이마다 `/` → `/world` 리다이렉트를 한 번 더 거침)
 * - `id: '/'`: 앱 식별자. start_url을 나중에 바꿔도 같은 앱으로 남게 따로 고정
 * - `orientation`을 정하지 않는다: 태블릿 가로·세로 모두
 * - 색: 테마·바탕 = 단색 바탕 토큰(`COLOR.bg`, 메타 `theme-color`와 같음). 시작 화면은 이 바탕 + 아이콘
 * - 아이콘: 192·512(일반, 둥근 사각형) + 512 maskable(가득 찬 바탕, 그림은 가운데 80% 원 안). 파일 이름에 버전(`.v1`):
 *   그림을 바꾸면 `PWA_ICON_VERSION`을 올린다(1년 캐시)
 * - 서비스 워커는 없다(오프라인은 P11-01). Chrome 설치 조건에 서비스 워커는 더는 필요 없다(이름·아이콘 192/512·start_url·display·HTTPS)
 */
import type { MetadataRoute } from 'next';
import { COLOR } from '@/lib/design/tokens';
import { SITE_DESCRIPTION, SITE_TITLE } from '@/lib/seo/site';
import type { PwaIconKind } from './iconArt';

export const PWA_ICON_VERSION = 1;

/** manifest 아이콘 파일 (`/pwa/<file>`, `src/app/pwa/[file]/route.tsx`가 빌드 때 그림) */
export const PWA_MANIFEST_ICONS: Record<
  string,
  { kind: Extract<PwaIconKind, 'any' | 'maskable'>; size: number }
> = {
  [`icon-192.v${PWA_ICON_VERSION}.png`]: { kind: 'any', size: 192 },
  [`icon-512.v${PWA_ICON_VERSION}.png`]: { kind: 'any', size: 512 },
  [`maskable-512.v${PWA_ICON_VERSION}.png`]: { kind: 'maskable', size: 512 },
};

export const PWA_START_URL = '/world';

export function buildManifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: SITE_TITLE,
    short_name: 'pyRoad',
    description: SITE_DESCRIPTION,
    lang: 'ko',
    dir: 'ltr',
    start_url: PWA_START_URL,
    scope: '/',
    display: 'standalone',
    theme_color: COLOR.bg,
    background_color: COLOR.bg,
    categories: ['education', 'kids'],
    icons: Object.entries(PWA_MANIFEST_ICONS).map(([file, { kind, size }]) => ({
      src: `/pwa/${file}`,
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: kind === 'maskable' ? 'maskable' : 'any',
    })),
  };
}
