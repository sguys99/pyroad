import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
// 랜딩 문구 서브셋과 같은 import 그래프 (정적·동적 import 모두 따라감)
import {
  ROOT,
  loadLandingModules,
} from '../../../scripts/fonts/landing-text.mjs';

// 루트 globals.css는 랜딩이 닿는 소스만 Tailwind로 훑는다 (P4-12, 렌더 차단 CSS 예산 15KB gzip).
// 랜딩 트리가 목록 밖 파일을 import하면 그 파일의 Tailwind 클래스가 랜딩에서 빠진다(앱 화면은 app.css가 전부 훑어 괜찮다).

/** 랜딩 화면을 그리는 모듈의 시작점: 페이지 + 루트 레이아웃 + 루트 오류·없는 주소 화면 */
const ENTRIES = [
  'src/app/page.tsx',
  'src/app/layout.tsx',
  'src/app/not-found.tsx',
  'src/app/global-error.tsx',
];

function sources(css: string): string[] {
  return [...css.matchAll(/^@source\s+'([^']+)';/gm)].map((m) =>
    relative(ROOT, join(ROOT, 'src/app', m[1])),
  );
}

describe('globals.css Tailwind @source (P4-12)', () => {
  const globals = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8');
  const listed = sources(globals);

  it('자동 감지를 끄고(source(none)) 목록만 훑는다', () => {
    expect(globals).toMatch(/@import 'tailwindcss' source\(none\);/);
    expect(listed.length).toBeGreaterThan(0);
  });

  it('랜딩 import 그래프의 모든 TS/TSX 파일이 @source 목록 안에 있다', () => {
    const files = (loadLandingModules(ENTRIES) as { file: string }[]).map((m) =>
      relative(ROOT, m.file),
    );
    expect(files.length).toBeGreaterThan(50);
    const missing = files.filter(
      (f) => !listed.some((s) => f === s || f.startsWith(`${s}/`)),
    );
    expect(
      missing,
      'globals.css에 @source를 더하세요 (폴더를 여러 화면이 같이 쓰면 파일만)',
    ).toEqual([]);
  });

  it('app.css는 globals.css를 참조만 하고(@reference) src 전체 유틸리티를 utilities 층에 낸다', () => {
    const app = readFileSync(join(ROOT, 'src/app/app.css'), 'utf8');
    expect(app).toContain("@reference './globals.css';");
    expect(app).toContain(
      "@import 'tailwindcss/utilities.css' layer(utilities) source('..');",
    );
  });
});
