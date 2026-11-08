// 비로그인 스펙 (`public` 프로젝트). 랜딩 텍스트 서브셋 (P4-12, docs/design/fonts.md §3):
// 화면에 실제로 그려진 글자가 그 글꼴의 서브셋에 다 있는지 — 제목(Jua) 서브셋은 제목 글꼴 자리 글자만 담으므로
// 소스 수집기(scripts/fonts/landing-text.mjs)가 놓친 자리를 렌더 결과로 잡는다. 빌드 뒤 정적 HTML 검사(check-build)가
// 못 보는 클라이언트 글자(말풍선·체험 결과·로그인 시트·오류 안내)를 여기서 본다. 본문 굵기는 서브셋 축(400~700) 안인지도.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { watchCspViolations } from '../support/test';
import { inspectWoff2 } from '../../scripts/fonts/woff2.mjs';

const FONTS = join(process.cwd(), 'src/fonts');
const manifest = JSON.parse(readFileSync(join(FONTS, 'manifest.json'), 'utf8'));

type Kind = 'display' | 'sans';
/** next/font가 붙이는 글꼴 이름 (src/fonts/landing.ts의 export 이름) */
const FAMILY: Record<Kind, RegExp> = {
  display: /^displayLanding$/,
  sans: /^sansLanding$/,
};
const SUBSET: Record<Kind, { codepoints: Set<number>; notInFont: string }> = {
  display: {
    codepoints: inspectWoff2(
      readFileSync(join(FONTS, manifest.landing.fonts.jua.file)),
    ).codepoints,
    notInFont: manifest.landing.fonts.jua.notInFont,
  },
  sans: {
    codepoints: inspectWoff2(
      readFileSync(join(FONTS, manifest.landing.fonts.sans.file)),
    ).codepoints,
    notInFont: manifest.landing.fonts.sans.notInFont,
  },
};
const [MIN_WEIGHT, MAX_WEIGHT] = String(manifest.landing.fonts.sans.weight)
  .split(' ')
  .map(Number);

interface Seen {
  /** 글꼴 → 글자 → 그 글자가 나온 문구 하나 */
  chars: Record<Kind, Map<string, string>>;
  /** 본문 글꼴의 계산된 굵기 → 예시 문구 */
  weights: Map<number, string>;
}

/** 지금 화면(문서 전체)의 글자를 첫 번째 글꼴 이름별로 모은다 */
async function collect(page: Page, seen: Seen) {
  const rows = await page.evaluate(() => {
    const out: { family: string; weight: number; text: string }[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      const text = n.textContent ?? '';
      if (!el || !text.trim()) continue;
      if (el.closest('script, style, noscript, template, title, .sr-only'))
        continue;
      const cs = getComputedStyle(el);
      out.push({
        family: cs.fontFamily
          .split(',')[0]
          .trim()
          .replace(/^["']|["']$/g, ''),
        weight: Number(cs.fontWeight),
        text,
      });
    }
    return out;
  });
  for (const { family, weight, text } of rows) {
    for (const kind of ['display', 'sans'] as const) {
      if (!FAMILY[kind].test(family)) continue;
      for (const ch of text)
        if (!/\s/.test(ch) && !seen.chars[kind].has(ch))
          seen.chars[kind].set(ch, text.trim().slice(0, 40));
      if (kind === 'sans' && !seen.weights.has(weight))
        seen.weights.set(weight, text.trim().slice(0, 40));
    }
  }
}

function report(seen: Seen) {
  const missing: Record<Kind, string[]> = { display: [], sans: [] };
  for (const kind of ['display', 'sans'] as const) {
    const { codepoints, notInFont } = SUBSET[kind];
    for (const [ch, sample] of seen.chars[kind])
      if (!codepoints.has(ch.codePointAt(0)!) && !notInFont.includes(ch))
        missing[kind].push(`${ch} (${sample})`);
  }
  return missing;
}

/** 위에서 아래로 천천히 내려 늦게 뜨는 부분(WhenVisible·useInView)을 다 띄운다 */
async function scrollThrough(page: Page, seen: Seen) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y <= height; y += 600) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(150);
    await collect(page, seen);
  }
}

let violations: string[] = [];
test.beforeEach(async ({ page }) => {
  violations = await watchCspViolations(page);
});
test.afterEach(() => {
  expect(violations, 'CSP 위반이 없어야 함 (B27)').toEqual([]);
});

test.describe('랜딩 텍스트 서브셋 (P4-12)', () => {
  test('화면에 그려진 글자가 제목·본문 서브셋에 다 있고, 본문 굵기는 서브셋 축 안', async ({
    page,
  }) => {
    test.slow();
    const seen: Seen = {
      chars: { display: new Map(), sans: new Map() },
      weights: new Map(),
    };
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await collect(page, seen);
    await scrollThrough(page, seen);

    // 손으로 띄우는 글자: 히어로·친구 말풍선, 체험 결과, 로그인 시트
    for (const btn of await page
      .getByRole('button', { name: /콕 누르기/ })
      .all()) {
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await page.waitForTimeout(300);
      await collect(page, seen);
    }
    const run = page.getByRole('button', { name: '주문 걸기' });
    if (await run.count()) {
      await run.first().scrollIntoViewIfNeeded();
      await run.first().click();
      await page.waitForTimeout(800);
      await collect(page, seen);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page
      .getByRole('banner')
      .getByRole('button', { name: '로그인' })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await collect(page, seen);

    // 로그인 오류 안내 (제목 글꼴로 그려지는 오류 제목)
    await page.goto(
      '/?error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+parameter+missing',
    );
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.waitForTimeout(300);
    await collect(page, seen);

    expect(
      seen.chars.display.size,
      '제목 글꼴 글자를 하나도 못 봄 (글꼴 이름이 바뀌었나?)',
    ).toBeGreaterThan(10);
    expect(
      seen.chars.sans.size,
      '본문 글꼴 글자를 하나도 못 봄',
    ).toBeGreaterThan(50);
    const missing = report(seen);
    expect(
      missing.display,
      '제목(Jua) 서브셋에 없는 글자 → scripts/fonts/landing-text.mjs가 그 제목 자리를 못 찾음 (node scripts/fonts/landing-text.mjs --why)',
    ).toEqual([]);
    expect(
      missing.sans,
      '본문 서브셋에 없는 글자 → npm run fonts:build -- --landing',
    ).toEqual([]);
    const outOfAxis = [...seen.weights].filter(
      ([w]) => w < MIN_WEIGHT || w > MAX_WEIGHT,
    );
    expect(
      outOfAxis,
      `본문 굵기는 서브셋 축 ${MIN_WEIGHT}~${MAX_WEIGHT} 안 (밖이면 가까운 끝 굵기로 그려짐)`,
    ).toEqual([]);
  });
});
