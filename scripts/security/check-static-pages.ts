// 빌드 뒤 정적 HTML로 굳은 페이지가 CSP 정적 정책 목록(STATIC_PAGE_PATHS)과 맞는지 확인한다 (B27).
// postbuild에서 돌기 때문에 Vercel 빌드(`npm run build`)에서도 실행된다.
//
// 왜: 페이지 CSP는 nonce 정책이 기본이고(src/middleware.ts), Next는 서버 렌더 때만 nonce를 넣는다.
// 목록에 없는 페이지가 빌드 때 HTML로 굳으면 nonce가 없어 그 페이지의 스크립트가 모두 막힌다(화면은 보이지만 눌러도 안 됨).
// 반대로 목록에 있는데 동적 렌더가 되면 정적 최적화를 잃은 것이므로 알린다.
//
//   npx tsx scripts/security/check-static-pages.ts   # .next/가 있어야 함 (npm run build 뒤)

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATIC_PAGE_PATHS } from '../../src/lib/security/csp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export interface StaticPageCheck {
  /** HTML로 굳었는데 정적 정책 목록에 없음 → 스크립트가 막힘 (빌드 실패) */
  unlisted: string[];
  /** 목록에 있는데 HTML로 굳지 않음 → 경고만 */
  notStatic: string[];
}

/** 정적 HTML 파일 경로 (`/` → index.html) */
export function htmlFileFor(route: string): string {
  return route === '/' ? 'index.html' : `${route.slice(1)}.html`;
}

/**
 * Next가 항상 미리 만드는 404. 없는 주소는 `src/app/[...missing]`이 받아 요청마다 렌더하므로
 * 이 HTML은 페이지 주소에 쓰이지 않는다. 그 라우트가 있을 때만 무시한다.
 */
export const BUILT_IN_NOT_FOUND = '/_not-found';

export function checkStaticPages(
  prerenderedRoutes: string[],
  hasHtml: (route: string) => boolean,
  {
    allowed = STATIC_PAGE_PATHS,
    hasCatchAll,
  }: { allowed?: readonly string[]; hasCatchAll: boolean },
): StaticPageCheck {
  const htmlRoutes = prerenderedRoutes
    .filter(hasHtml)
    .filter((r) => !(hasCatchAll && r === BUILT_IN_NOT_FOUND));
  return {
    unlisted: htmlRoutes.filter((r) => !allowed.includes(r)).sort(),
    notStatic: allowed.filter((r) => !htmlRoutes.includes(r)),
  };
}

function main() {
  const nextDir = join(ROOT, '.next');
  const manifestPath = join(nextDir, 'prerender-manifest.json');
  if (!existsSync(manifestPath)) {
    console.error(
      '[check-static-pages] .next/prerender-manifest.json이 없어요. npm run build 뒤에 실행하세요.',
    );
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    routes: Record<string, unknown>;
  };
  const appDir = join(nextDir, 'server/app');
  const result = checkStaticPages(
    Object.keys(manifest.routes),
    (route) => existsSync(join(appDir, htmlFileFor(route))),
    { hasCatchAll: existsSync(join(appDir, '[...missing]/page.js')) },
  );

  for (const route of result.notStatic) {
    console.warn(
      `[check-static-pages] 경고: ${route}는 STATIC_PAGE_PATHS에 있지만 정적 HTML이 아니에요 (정적 최적화를 잃음)`,
    );
  }
  if (result.unlisted.length > 0) {
    console.error(
      [
        `[check-static-pages] 정적 HTML로 굳은 페이지가 CSP 정적 정책 목록에 없어요: ${result.unlisted.join(', ')}`,
        '  이대로 배포하면 nonce가 없어 이 페이지의 스크립트가 CSP에 막힙니다 (B27).',
        '  - 사용자 글·마크다운이 있거나 로그인 화면이면: 동적 렌더로 바꾸세요 (예: `await connection()`)',
        '  - 사용자 콘텐츠가 없는 공개 페이지면: src/lib/security/csp.ts의 STATIC_PAGE_PATHS에 넣으세요',
        `  - ${BUILT_IN_NOT_FOUND}이면: 없는 주소를 받는 src/app/[...missing]/page.tsx가 있어야 해요`,
      ].join('\n'),
    );
    process.exit(1);
  }
  console.log(
    `[check-static-pages] 정적 페이지 ${STATIC_PAGE_PATHS.join(', ') || '없음'} 확인`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
