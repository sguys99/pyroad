import 'server-only';

import { readFileSync } from 'node:fs';

import { isTestPagesEnabled } from '@/lib/env/testPages';

import { WORLDS, type WorldInfo } from './worlds';

/**
 * 서버 화면이 쓰는 월드 목록. 보통은 커밋한 생성물 `WORLDS` 그대로.
 * e2e(Q48, P5-01)만: 테스트 페이지가 켜진 서버에 `PYROAD_E2E_WORLDS`(= `content:build -- --fixtures`가 만든
 * build/e2e/worlds.json)가 있으면 테스트 월드를 뒤에 더한다 — 코드 수정 없이 "데이터만 더하면 지도가 나온다"를 브라우저로 확인.
 * 운영에는 두 값 모두 없어 그대로다
 */
export function serverWorlds(
  env: Record<string, string | undefined> = process.env,
): readonly WorldInfo[] {
  const file = env.PYROAD_E2E_WORLDS;
  if (!file || !isTestPagesEnabled(env)) return WORLDS;
  try {
    const extra = JSON.parse(readFileSync(file, 'utf8')) as WorldInfo[];
    return [...WORLDS, ...extra.filter((w) => !getIn(WORLDS, w.slug))];
  } catch {
    return WORLDS; // 파일이 없으면 픽스처 없이 (e2e 스펙이 테스트 월드가 없다고 실패해 알려 줌)
  }
}

const getIn = (worlds: readonly WorldInfo[], slug: string) =>
  worlds.find((w) => w.slug === slug);
