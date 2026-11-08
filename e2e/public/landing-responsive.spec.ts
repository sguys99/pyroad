// 비로그인 스펙 (`public` 프로젝트). 랜딩 반응형·연출 단계 회귀 (P4-13)
// - 폭 7개(320~1440)에서 끝까지 내려도 가로 넘침 0
// - 제목 단계: h1 하나(히어로) + 섹션 h2 순서, 랜드마크(banner·main·contentinfo) 하나씩, 섹션은 제목으로 이름 붙음
// - 연출 단계별 document.getAnimations() (끝까지 스크롤하며 모음, motion-guidelines §2·§3, Q26)
//   full: 히어로 앰비언트가 돈다(검사가 살아 있는지) · lite: 앰비언트·패럴랙스 0(반복은 바쁨 표시뿐)
//   minimal: 반복은 바쁨 표시뿐 + 위치·크기 변화 0 · 동작 줄이기: 반복 0(느린 깜빡임만 허용) + 위치·크기 변화 0

import { test, expect, type Page } from '@playwright/test';
import { MINIMAL_ALLOW, REDUCED_ALLOW } from '../support/motion';
import { watchCspViolations } from '../support/test';

let violations: string[] = [];
test.beforeEach(async ({ page }) => {
  violations = await watchCspViolations(page);
});
test.afterEach(() => {
  expect(violations, 'CSP 위반이 없어야 함 (B27)').toEqual([]);
});

async function setMotion(
  page: Page,
  tier: 'full' | 'lite' | 'minimal',
  reduced: 'on' | 'off',
) {
  await page.addInitScript(
    ([t, r]) => {
      localStorage.setItem(
        'pyroad.motion.prefs.v1',
        JSON.stringify({ tier: t, reduced: r }),
      );
    },
    [tier, reduced] as const,
  );
}

/** 맨 아래까지 화면 높이의 반씩 내리며 매 위치에서 `each`를 부른다 (지연 로드·늦은 CSS·등장 연출이 모두 돈다) */
async function scrollThrough(page: Page, each?: () => Promise<void>) {
  const height = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  const step = Math.round((page.viewportSize()?.height ?? 800) / 2);
  for (let y = 0; y <= height; y += step) {
    await page.evaluate(
      (y) => window.scrollTo({ top: y, behavior: 'instant' }),
      y,
    );
    await page.waitForTimeout(200);
    await each?.();
  }
}

interface Seen {
  /** 무한 반복 중인 애니메이션 이름 (CSS는 animationName, 나머지 'waapi') */
  loops: Set<string>;
  /** 위치·크기를 바꾸는 키프레임이 도는 것 (`이름 @ 대상`) */
  moving: Set<string>;
}

/** 지금 돌고 있는 애니메이션을 모은다. 값이 모두 같은 키프레임(실제 움직임 없음)은 뺀다 */
async function collect(page: Page, seen: Seen) {
  const now = await page.evaluate(() => {
    // 키프레임 메타 키(offset·computedOffset·easing·composite)는 빼고 본다
    const MOVE =
      /^(transform|translate|scale|rotate|offset[A-Z]\w*|left|top|right|bottom|width|height|inset|margin\w*)$/;
    const loops: string[] = [];
    const moving: string[] = [];
    for (const a of document.getAnimations()) {
      if (a.playState !== 'running') continue;
      const effect = a.effect as KeyframeEffect | null;
      if (!effect) continue;
      const name =
        'animationName' in a
          ? String((a as CSSAnimation).animationName)
          : 'transitionProperty' in a
            ? `transition:${String((a as CSSTransition).transitionProperty)}`
            : 'waapi';
      if (effect.getComputedTiming().iterations === Infinity) loops.push(name);
      const frames = effect.getKeyframes();
      const props = new Set(
        frames.flatMap((k) => Object.keys(k)).filter((p) => MOVE.test(p)),
      );
      const moves = [...props].some((p) =>
        frames.some((k) => k[p] !== frames[0][p]),
      );
      if (moves) {
        const el = effect.target as Element | null;
        const cls = el?.getAttribute('class')?.split(/\s+/)[0] ?? '';
        moving.push(`${name} @ ${el?.tagName.toLowerCase()}.${cls}`);
      }
    }
    return { loops, moving };
  });
  now.loops.forEach((l) => seen.loops.add(l));
  now.moving.forEach((m) => seen.moving.add(m));
}

const WIDTHS = [320, 360, 390, 768, 1024, 1280, 1440];

const SECTION_TITLES = [
  ['try', '첫 주문을 걸어 봐요'],
  ['worlds', '세 개의 월드가 기다려요'],
  ['fun', '모험이 더 신나는 이유'],
  ['friends', '함께 모험할 세 친구'],
  ['parents', '아이가 안심하고 배우도록 만들었어요'],
  ['faq', '자주 묻는 질문'],
] as const;

test.describe('랜딩 반응형 (P4-13)', () => {
  for (const width of WIDTHS) {
    test(`${width}px: 끝까지 내려도 가로 넘침이 없다`, async ({ page }) => {
      await setMotion(page, 'full', 'off');
      await page.setViewportSize({ width, height: width < 768 ? 780 : 900 });
      await page.goto('/');
      await scrollThrough(page);
      const { scroll, client } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(scroll, `${width}px 문서 폭`).toBeLessThanOrEqual(client);
    });
  }

  test('제목은 h1 하나와 섹션 h2 순서, 랜드마크는 하나씩', async ({ page }) => {
    await setMotion(page, 'minimal', 'off');
    await page.goto('/');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveAttribute('id', 'hero-title');

    const h2 = await page
      .locator('main h2')
      .evaluateAll((els) =>
        els.map((e) => [e.closest('section')?.id ?? '', e.textContent?.trim()]),
      );
    expect(h2).toEqual(SECTION_TITLES.map(([id, title]) => [id, title]));

    for (const [id, title] of SECTION_TITLES) {
      await expect(
        page.getByRole('region', { name: title, exact: true }),
      ).toHaveAttribute('id', id);
    }
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toHaveCount(1);
  });

  test('바닥 글·FAQ의 앱 화면 링크는 미리 받지 않는다 (쓰지 않는 앱 CSS preload 경고 없음)', async ({
    page,
  }) => {
    const prefetched: string[] = [];
    const warnings: string[] = [];
    page.on('request', (req) => {
      if (req.headers()['next-router-prefetch']) prefetched.push(req.url());
    });
    page.on('console', (m) => {
      if (m.text().includes('was preloaded using link preload but not used'))
        warnings.push(m.text());
    });
    await setMotion(page, 'minimal', 'off');
    await page.goto('/');
    await scrollThrough(page);
    await page.locator('#faq summary').first().click();
    await page.waitForTimeout(3_500);
    expect(
      prefetched.filter((u) =>
        /^\/(terms|privacy|licenses|notice)$/.test(new URL(u).pathname),
      ),
    ).toEqual([]);
    expect(warnings).toEqual([]);
  });
});

test.describe('랜딩 연출 단계 (P4-13, getAnimations 전수)', () => {
  const MODES = [
    { name: 'full', tier: 'full', reduced: 'off' },
    { name: 'lite', tier: 'lite', reduced: 'off' },
    { name: 'minimal', tier: 'minimal', reduced: 'off' },
    { name: '동작 줄이기(full)', tier: 'full', reduced: 'on' },
    { name: '동작 줄이기(lite)', tier: 'lite', reduced: 'on' },
    { name: 'minimal + 동작 줄이기', tier: 'minimal', reduced: 'on' },
  ] as const;

  for (const width of [360, 1280]) {
    for (const mode of MODES) {
      test(`${width}px ${mode.name}: 스크롤 끝까지 반복·움직임이 단계 규칙대로`, async ({
        page,
      }) => {
        await setMotion(page, mode.tier, mode.reduced);
        await page.setViewportSize({ width, height: width < 768 ? 780 : 900 });
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute(
          'data-motion',
          mode.tier,
        );
        await expect(page.locator('html')).toHaveAttribute(
          'data-reduced',
          mode.reduced === 'on' ? 'true' : 'false',
        );
        await page.waitForTimeout(800);
        const seen: Seen = { loops: new Set(), moving: new Set() };
        await collect(page, seen);
        await scrollThrough(page, () => collect(page, seen));
        const loops = [...seen.loops];
        const moving = [...seen.moving];

        if (mode.reduced === 'on') {
          // 위치·크기 변화 0 (Q26). 반복은 느린 깜빡임만, minimal이면 그것도 없음
          expect(moving, '동작 줄이기: 움직이는 애니메이션').toEqual([]);
          const allow = mode.tier === 'minimal' ? {} : REDUCED_ALLOW;
          expect(loops.filter((l) => !(l in allow))).toEqual([]);
        } else if (mode.tier === 'minimal') {
          expect(moving, 'minimal: 움직이는 애니메이션').toEqual([]);
          expect(loops.filter((l) => !(l in MINIMAL_ALLOW))).toEqual([]);
        } else if (mode.tier === 'lite') {
          // 앰비언트(히어로 ha-*)·패럴랙스·스크롤 연동 0 → 반복은 바쁨 표시(타자 커서)뿐
          expect(loops.filter((l) => !(l in MINIMAL_ALLOW))).toEqual([]);
          // 패럴랙스 레이어는 transform이 걸리지 않는다 (hero.css `.hero-par`는 full만)
          await page.evaluate(() =>
            window.scrollTo({ top: 200, behavior: 'instant' }),
          );
          await page.waitForTimeout(200);
          const moved = await page
            .locator('#hero .hero-par')
            .evaluateAll(
              (els) =>
                els.filter((e) => getComputedStyle(e).transform !== 'none')
                  .length,
            );
          expect(moved, 'lite: 히어로 패럴랙스 레이어').toBe(0);
        } else {
          // full: 검사가 실제 애니메이션을 잡는지 (히어로 앰비언트 구름)
          expect(loops).toContain('ha-drift');
        }
      });
    }
  }
});
