// 비로그인 스펙 (`public` 프로젝트). 랜딩 #worlds 세계관 (P4-04):
// 월드 1·2·3 미리보기(Q40) · 콘텐츠 수 · 잠긴 월드 안내(Q2) · 두루마리 지도 펼침의 연출 단계별 동작 · 360px 가로 스크롤 없음

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

/** 지도 위끝이 화면 높이의 `at` 위치에 오게 스크롤 (0 = 맨 위) */
async function placeMap(page: Page, at: number) {
  await page.getByTestId('worlds-map').evaluate((el, at) => {
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.max(0, top - window.innerHeight * at));
  }, at);
}

/** 덮개 트랙의 이동 비율 (0 = 접힘, 1 = 다 펼침) — 가로 지도는 x, 세로 지도는 y */
function trackProgress(page: Page): Promise<number> {
  return page.locator('.ld-worlds-track').evaluate((el) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    const box = el as HTMLElement;
    const wide = window.innerWidth >= 900;
    return wide ? m.m41 / box.offsetWidth : m.m42 / box.offsetHeight;
  });
}

/** 지도 안에 걸린 CSS 애니메이션 이름 (전환·transition은 빼고) */
function mapAnimations(page: Page): Promise<string[]> {
  return page.getByTestId('worlds-map').evaluate((el) =>
    el
      .getAnimations({ subtree: true })
      .filter((a) => a instanceof CSSAnimation)
      .map((a) => (a as CSSAnimation).animationName),
  );
}

const WORLDS = [
  { no: 1, name: '파이썬 섬' },
  { no: 2, name: '코드 바다' },
  { no: 3, name: '메이커 시티' },
];

test.describe('랜딩 세계관 (P4-04)', () => {
  test('월드 1·2·3 이름과 상태, 월드 1의 스테이지·퀘스트 수가 보인다', async ({
    page,
  }) => {
    await setMotion(page, 'minimal', 'off');
    await page.goto('/');
    const section = page.locator('#worlds');
    for (const w of WORLDS) {
      await expect(
        section.getByRole('heading', {
          level: 3,
          name: `월드 ${w.no} · ${w.name}`,
        }),
      ).toBeAttached();
    }
    await placeMap(page, 0.3);
    const w1 = page.getByTestId('world-card-1');
    await expect(w1).toContainText('지금 열려 있어요');
    await expect(w1).toContainText(/스테이지 \d+곳 · 퀘스트 \d+개/);
    await expect(page.getByTestId('world-card-2')).toContainText(
      '파이썬 섬의 마지막 프로젝트를 끝내면 열려요',
    );
    await expect(page.getByTestId('world-card-3')).toContainText(
      '코드 바다의 마지막 프로젝트를 끝내면 열려요',
    );
    await expect(section.getByText('준비 중')).toHaveCount(2);
  });

  test('잠긴 월드를 누르면(마우스·키보드) "앞 월드를 끝내면 열려요!" 안내만 나온다', async ({
    page,
  }) => {
    await setMotion(page, 'full', 'off');
    await page.goto('/');
    await placeMap(page, 0.2);
    const card = page.getByTestId('world-card-2');
    const btn = page.getByRole('button', { name: '코드 바다: 잠겨 있어요' });
    await btn.click();
    await expect(card).toHaveAttribute('data-tip', 'on');
    await expect(card.locator('.ld-worlds-tip')).toBeVisible();
    await expect(
      page.getByTestId('worlds-map').locator('[aria-live]'),
    ).toHaveText('아직 잠겨 있어요. 앞 월드를 끝내면 열려요!');
    await expect(page).not.toHaveURL(/#/);
    // 잠시 뒤 사라진다
    await expect(card).not.toHaveAttribute('data-tip', 'on', {
      timeout: 5000,
    });
    const menu = page.getByRole('button', { name: '메이커 시티: 잠겨 있어요' });
    await menu.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('world-card-3')).toHaveAttribute(
      'data-tip',
      'on',
    );
  });

  test('열린 월드는 30초 체험으로 데려간다', async ({ page }) => {
    await setMotion(page, 'minimal', 'off');
    await page.goto('/');
    await placeMap(page, 0.2);
    await page.getByTestId('world-open-link').click();
    await expect(page).toHaveURL(/#try$/);
    await expect(page.locator('#try-title')).toBeFocused();
  });

  test('full: 스크롤에 맞춰 두루마리가 펼쳐지고 표지가 일어선다 (transform만)', async ({
    page,
  }) => {
    await setMotion(page, 'full', 'off');
    await page.goto('/');
    const map = page.getByTestId('worlds-map');
    await expect(map).toHaveAttribute('data-reveal', 'scroll');
    const names = await mapAnimations(page);
    expect(names).toContain('ld-worlds-unroll-x');
    expect(names.filter((n) => n === 'ld-worlds-stand')).toHaveLength(3);
    // 지도 위끝이 화면 아래쪽 → 아직 거의 접힘
    await placeMap(page, 0.9);
    await expect.poll(() => trackProgress(page)).toBeLessThan(0.15);
    // 반쯤 → 펼치는 중
    await placeMap(page, 0.6);
    // 스크롤 연동 값은 다음 프레임에 반영된다
    await expect.poll(() => trackProgress(page)).toBeGreaterThan(0.15);
    expect(await trackProgress(page)).toBeLessThan(0.95);
    // 바로가기로 온 위치(제목이 헤더 밑) → 다 펼침
    await page
      .locator('#worlds')
      .evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await expect.poll(() => trackProgress(page)).toBeGreaterThan(0.99);
    // 반복 연출은 없다
    const loops = await runningLoops(page);
    expect(loops.filter((l) => l.name.startsWith('ld-worlds'))).toEqual([]);
  });

  test('lite: 화면에 들어올 때 한 번 펼친다', async ({ page }) => {
    await setMotion(page, 'lite', 'off');
    await page.goto('/');
    const map = page.getByTestId('worlds-map');
    await expect(map).toHaveAttribute('data-reveal', 'once');
    await expect(map).toHaveAttribute('data-armed', 'true');
    expect(await trackProgress(page)).toBeLessThan(0.01);
    expect(await mapAnimations(page)).toEqual([]);
    await placeMap(page, 0.4);
    await expect(map).toHaveAttribute('data-open', 'true');
    await expect.poll(() => trackProgress(page)).toBeGreaterThan(0.99);
  });

  for (const [tier, reduced] of [
    ['minimal', 'off'],
    ['full', 'on'],
    ['lite', 'on'],
  ] as const) {
    test(`${tier}${reduced === 'on' ? ' + 동작 줄이기' : ''}: 처음부터 펼친 정지 상태`, async ({
      page,
    }) => {
      await setMotion(page, tier, reduced);
      await page.goto('/');
      const map = page.getByTestId('worlds-map');
      await expect(map).toHaveAttribute('data-reveal', 'static');
      await expect(map).not.toHaveAttribute('data-armed', 'true');
      expect(await trackProgress(page)).toBeGreaterThan(0.99);
      await placeMap(page, 0.3);
      expect(await mapAnimations(page)).toEqual([]);
      // 올려놓아도 표지가 들리지 않는다 (full만)
      await page.getByTestId('world-card-1').hover();
      await page.waitForTimeout(400);
      const face = await page
        .getByTestId('world-card-1')
        .locator('.ld-worlds-face')
        .evaluate((el) => getComputedStyle(el).transform);
      expect(face).toBe('none');
      // 잠긴 월드 누름: 자물쇠는 움직이지 않고(동작 줄이기·minimal) 색과 말풍선으로 알린다
      await page
        .getByRole('button', { name: '코드 바다: 잠겨 있어요' })
        .click();
      const lock = page.getByTestId('world-card-2').locator('.ld-worlds-lock');
      expect(
        await lock.evaluate(
          (el) =>
            el.getAnimations().filter((a) => a instanceof CSSAnimation).length,
        ),
      ).toBe(0);
      await expect(
        page.getByTestId('world-card-2').locator('.ld-worlds-tip'),
      ).toBeVisible();
    });
  }

  test('full: 열린 월드에 올려놓으면 표지가 살짝 들린다', async ({ page }) => {
    await setMotion(page, 'full', 'off');
    await page.goto('/');
    await page
      .locator('#worlds')
      .evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await expect.poll(() => trackProgress(page)).toBeGreaterThan(0.99);
    await page.getByTestId('world-card-1').hover();
    await expect
      .poll(() =>
        page
          .getByTestId('world-card-1')
          .locator('.ld-worlds-face')
          .evaluate(
            (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42,
          ),
      )
      .toBeLessThan(-2);
  });

  for (const width of [360, 768]) {
    test(`${width}px: 세로 지도, 가로 스크롤 없음`, async ({ page }) => {
      await page.setViewportSize({ width, height: 740 });
      await setMotion(page, 'full', 'off');
      await page.goto('/');
      const map = page.getByTestId('worlds-map');
      // 세로 지도: 카드가 위아래로 쌓인다
      const tops = await page
        .locator('.ld-worlds-card')
        .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
      expect(tops[1]).toBeGreaterThan(tops[0]);
      expect(tops[2]).toBeGreaterThan(tops[1]);
      expect(await mapAnimations(page)).toContain('ld-worlds-unroll-y');
      for (const at of [0.9, 0.5, 0, -0.5]) {
        await placeMap(page, at);
        const { sw, cw } = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
        }));
        expect(sw, `가로 스크롤 없음 (지도 위치 ${at})`).toBeLessThanOrEqual(
          cw,
        );
      }
      await expect(map).toBeVisible();
    });
  }
});
