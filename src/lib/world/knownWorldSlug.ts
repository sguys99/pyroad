import { isTestPagesEnabled } from '@/lib/env/testPages';

import { WORLDS } from './worlds.generated';

/**
 * 미들웨어용 (P5-14): `/world/<slug>`의 slug가 있는 월드인지. 없으면 미들웨어가 진짜 404 상태로 돌려보낸다
 * (페이지의 notFound()는 (protected)/loading.tsx 스트리밍이 먼저 200을 보내 상태 코드를 못 바꿈).
 * e2e 테스트 월드는 테스트 페이지가 켜진 서버의 `PYROAD_E2E_WORLD_SLUGS`(쉼표 목록)로 더한다 — 미들웨어(Edge)는
 * serverWorlds()처럼 파일을 읽을 수 없어서
 */
export function isKnownWorldSlug(
  slug: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (WORLDS.some((w) => w.slug === slug)) return true;
  if (!isTestPagesEnabled(env)) return false;
  return !!slug && (env.PYROAD_E2E_WORLD_SLUGS ?? '').split(',').includes(slug);
}

/** `/world/<slug>` 한 단계 주소면 slug, 아니면 null */
export function worldSlugOf(pathname: string): string | null {
  const m = /^\/world\/([^/]+)\/?$/.exec(pathname);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}
