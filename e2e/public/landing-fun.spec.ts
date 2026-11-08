// 비로그인 스펙 (`public` 프로젝트). 랜딩 #fun 재미 요소 쇼케이스 (P4-05):
// 장면 5개 · "곧 열려요"(Q42) · 한 번에 한 장면만 · 화면 밖이면 멈춤 · 연출 단계별(full 반복 / lite 한 번 / minimal·동작 줄이기 정지) · 360px

import { test, expect, type Page } from '@playwright/test';
import { runningLoops } from '../support/motion';
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

async function toFun(page: Page) {
  await page
    .locator('#fun')
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
}

/** 카드의 재생 표시(data-active)를 기록한다: 어느 순간에 동시에 몇 장이 돌았는지 · 어떤 차례로 틀었는지 */
async function recordActive(page: Page) {
  await page.getByTestId('fun-list').evaluate((list) => {
    const w = window as unknown as { __fun: { max: number; seq: string[] } };
    w.__fun = { max: 0, seq: [] };
    const snap = () => {
      const on = [...list.querySelectorAll<HTMLElement>('[data-active]')];
      w.__fun.max = Math.max(w.__fun.max, on.length);
      for (const el of on) {
        const id = el.dataset.scene!;
        if (w.__fun.seq.at(-1) !== id) w.__fun.seq.push(id);
      }
    };
    new MutationObserver(snap).observe(list, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-active'],
    });
  });
  return () =>
    page.evaluate(
      () =>
        (window as unknown as { __fun: { max: number; seq: string[] } }).__fun,
    );
}

/** 목록 안에 걸린 장면 CSS 애니메이션 이름 (전환은 빼고) */
function listAnimations(page: Page): Promise<string[]> {
  return page.getByTestId('fun-list').evaluate((el) =>
    el
      .getAnimations({ subtree: true })
      .filter((a) => a instanceof CSSAnimation)
      .map((a) => (a as CSSAnimation).animationName)
      // 공통 컴포넌트의 한 번 반응(진행바 빛 띠 등)은 빼고 장면 연출만
      .filter((n) => n.startsWith('ld-fun')),
  );
}

const SCENES = [
  { id: 'level', title: '레벨 업', soon: false },
  { id: 'coin', title: '코인 모으기', soon: true },
  { id: 'dress', title: '파이뱀 꾸미기', soon: false },
  { id: 'share', title: '자랑하기', soon: true },
  { id: 'boss', title: '보스 배틀', soon: true },
];

test.describe('랜딩 재미 요소 쇼케이스 (P4-05)', () => {
  test('장면 5개의 제목과 "곧 열려요" 배지(없는 기능만)', async ({ page }) => {
    await setMotion(page, 'minimal', 'off');
    await page.goto('/');
    const section = page.locator('#fun');
    for (const s of SCENES) {
      const card = page.getByTestId(`fun-card-${s.id}`);
      await expect(
        card.getByRole('heading', {
          level: 3,
          name: s.soon ? `${s.title} (곧 열려요)` : s.title,
        }),
      ).toBeAttached();
      await expect(card.locator('.ld-fun-soon')).toHaveCount(s.soon ? 1 : 0);
    }
    await expect(section.locator('.ld-fun-soon')).toHaveCount(3);
  });

  test('full: 화면 안 장면을 한 번에 하나씩 차례로 반복한다 (무한 애니메이션 없음)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await setMotion(page, 'full', 'off');
    await page.goto('/');
    await expect(page.getByTestId('fun-list')).toHaveAttribute(
      'data-mode',
      'loop',
    );
    const read = await recordActive(page);
    await toFun(page);
    await expect
      .poll(async () => (await read()).seq.length, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(3);
    const { max, seq } = await read();
    expect(max, '동시에 한 장면만').toBe(1);
    expect(seq.slice(0, 3)).toEqual(['level', 'coin', 'dress']);
    // 재생 중인 장면에만 애니메이션, 무한 반복은 없음
    const loops = await runningLoops(page);
    expect(loops.filter((l) => l.name.startsWith('ld-fun'))).toEqual([]);
    // 레벨 장면이 실제로 HUD 숫자를 올렸다
    await expect(
      page.getByTestId('fun-card-level').getByTestId('level-seal'),
    ).not.toContainText('2');
  });

  test('화면 밖으로 나가면 멈추고 정지 그림으로 돌아간다', async ({ page }) => {
    await setMotion(page, 'full', 'off');
    await page.goto('/');
    await toFun(page);
    await expect(page.locator('[data-fun-card][data-active]')).toHaveCount(1, {
      timeout: 10_000,
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('[data-fun-card][data-active]')).toHaveCount(0);
    expect(await listAnimations(page)).toEqual([]);
  });

  test('lite: 들어온 장면을 한 번씩만 튼다', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await setMotion(page, 'lite', 'off');
    await page.goto('/');
    await expect(page.getByTestId('fun-list')).toHaveAttribute(
      'data-mode',
      'once',
    );
    const read = await recordActive(page);
    await toFun(page);
    // 다섯 장면 × (3초 + 쉼) 뒤에는 더 틀지 않는다
    await expect
      .poll(async () => (await read()).seq.length, { timeout: 30_000 })
      .toBe(5);
    await page.waitForTimeout(4500);
    const { max, seq } = await read();
    expect(max).toBe(1);
    expect(seq).toEqual(SCENES.map((s) => s.id));
    await expect(page.locator('[data-fun-card][data-active]')).toHaveCount(0);
  });

  for (const [tier, reduced] of [
    ['minimal', 'off'],
    ['full', 'on'],
  ] as const) {
    test(`${tier}${reduced === 'on' ? ' + 동작 줄이기' : ''}: 틀지 않고 대표 정지 그림 + 설명 글자`, async ({
      page,
    }) => {
      await setMotion(page, tier, reduced);
      await page.goto('/');
      await expect(page.getByTestId('fun-list')).toHaveAttribute(
        'data-mode',
        'still',
      );
      await toFun(page);
      // 장면 그림은 받아서 그린다 (HUD 도장·코인 칩)
      await expect(
        page.getByTestId('fun-card-level').getByTestId('level-seal'),
      ).toBeVisible();
      await expect(
        page.getByTestId('fun-card-coin').getByTestId('hud-coin'),
      ).toBeVisible();
      await page.waitForTimeout(3500);
      await expect(page.locator('[data-fun-card][data-active]')).toHaveCount(0);
      expect(await listAnimations(page)).toEqual([]);
      for (const s of SCENES) {
        await expect(page.getByTestId(`fun-card-${s.id}`)).toContainText(
          s.title,
        );
      }
    });
  }

  test('360px: 목록 안에서만 가로로 넘기고 페이지는 넘치지 않는다', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await setMotion(page, 'full', 'off');
    await page.goto('/');
    await toFun(page);
    const list = page.getByTestId('fun-list');
    const m = await list.evaluate((el) => ({
      sw: el.scrollWidth,
      cw: el.clientWidth,
      page: document.documentElement.scrollWidth,
      vw: document.documentElement.clientWidth,
    }));
    expect(m.page).toBeLessThanOrEqual(m.vw);
    expect(m.sw).toBeGreaterThan(m.cw);
    // 키보드로도 넘길 수 있다
    await list.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(() => list.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);
    // 넘겨서 화면에 들어온 장면이 튼다
    await list.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
    await expect(page.getByTestId('fun-card-boss')).toHaveAttribute(
      'data-active',
      'true',
      { timeout: 12_000 },
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
  });
});
