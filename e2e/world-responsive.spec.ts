// Phase 5 화면 반응형·연출 단계 회귀 (P5-14, landing-responsive P4-13 방식). 전수 검수(7폭 × 4단계, axe-core·포커스·스크린샷)는
// docs/perf/P5-14-world-map.md에 기록하고, 여기는 다시 깨지기 쉬운 것만 남긴다
// - 7개 폭에서 지도·책장·잠긴 월드·스테이지 시트 가로 넘침 0, 시트 주 버튼이 화면 안
// - 320px 세로 지도: 지금 위치 깃발(긴 문구 "새 곳 도착!")이 어느 노드에서도 이름표·"잠김"에 안 걸림
// - minimal·동작 줄이기: 지도·책장에서 위치·크기 변화 0, 스크롤해도 패럴랙스 0
// - full: 탭이 숨으면 앰비언트 멈춤 (P5-09 data-amb-off)
// - 퀘스트에서 뒤로 와 열린 시트를 닫으면 뒤로 가기 한 번에 지도 앞 화면 (기록 중복 없음)

import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { adminClient, completeQuests } from './support/admin';
import { stages, stage } from './support/content';
import { AMBIENT } from './support/motion';
import { openStageSheet } from './support/quest';

const WIDTHS = [320, 360, 390, 768, 1024, 1280, 1440];
const s1 = stage(1);

async function setMotion(userId: string, tier: string, reduced: string) {
  const { error } = await adminClient()
    .from('users')
    .update({ settings: { motion: { tier, reduced } } })
    .eq('id', userId);
  expect(error).toBeNull();
}

const overflowX = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

/** 위치·크기를 바꾸며 돌고 있는 애니메이션 (landing-responsive와 같은 기준) */
const moving = (page: Page) =>
  page.evaluate(() => {
    const MOVE =
      /^(transform|translate|scale|rotate|offset[A-Z]\w*|left|top|right|bottom|width|height|inset|margin\w*)$/;
    const out: string[] = [];
    for (const a of document.getAnimations()) {
      if (a.playState !== 'running') continue;
      const e = a.effect as KeyframeEffect | null;
      if (!e) continue;
      const f = e.getKeyframes();
      const props = new Set(
        f.flatMap((k) => Object.keys(k)).filter((p) => MOVE.test(p)),
      );
      if ([...props].some((p) => f.some((k) => k[p] !== f[0][p]))) {
        const el = e.target as Element | null;
        out.push(
          `${'animationName' in a ? (a as CSSAnimation).animationName : 'waapi'} @ ${el?.getAttribute('class')?.split(' ')[0]}`,
        );
      }
    }
    return out;
  });

const parallax = (page: Page) =>
  page.$$eval('.wm-par', (els) =>
    els.map((e) => getComputedStyle(e).transform),
  );

test.afterEach(async ({ e2eUser }) => {
  await setMotion(e2eUser.id, 'auto', 'system');
});

test('7개 폭: 지도·책장·잠긴 월드·스테이지 시트에 가로 넘침이 없다', async ({
  page,
  e2eUser,
}) => {
  test.setTimeout(180_000);
  await completeQuests(e2eUser.id, [s1.quests[0]]);
  await setMotion(e2eUser.id, 'minimal', 'off');
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 768 ? 780 : 900 });
    for (const path of ['/world', '/worlds', '/world/code-sea']) {
      await page.goto(path);
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      expect(await overflowX(page), `${width}px ${path}`).toBe(0);
    }
    await page.goto('/world');
    await page.locator(`[data-stage-id="${s1.id}"] .wn-hit`).click();
    const sheet = page.getByTestId('stage-sheet');
    await expect(sheet).toBeVisible();
    expect(await overflowX(page), `${width}px 시트`).toBe(0);
    // 시트 안 차례 줄도 시트 폭 안 (줄바꿈 안 되는 딱지가 칸을 넓히던 문제, B65)
    expect(
      await sheet.evaluate((el) => el.scrollWidth - el.clientWidth),
      `${width}px 시트 안`,
    ).toBe(0);
    // 주 버튼 하나(줄 안 "이어하기" 중복 없음)가 화면 안에 붙어 있다
    await expect(page.getByTestId('stage-sheet-start')).toBeInViewport();
    await expect(sheet.getByText('이어하기', { exact: true })).toHaveCount(0);
  }
});

test('320px 세로 지도: 지금 위치 깃발이 어느 노드에서도 이름표에 걸리지 않는다', async ({
  page,
  e2eUser,
}) => {
  test.setTimeout(120_000);
  await setMotion(e2eUser.id, 'minimal', 'off');
  await page.setViewportSize({ width: 320, height: 780 });
  const db = adminClient();
  const all = stages();
  for (let k = 0; k < all.length; k++) {
    if (k > 0) {
      // 앞 스테이지를 다 깸 (코드 외 퀘스트 포함) + 본 기록(잠금 해제 연출 없이 끝 상태)
      const { data, error } = await db
        .from('quests')
        .select('id')
        .eq('stage_id', all[k - 1].id);
      expect(error).toBeNull();
      await completeQuests(
        e2eUser.id,
        (data ?? []).map((q) => ({ id: q.id as string, solution: '' })),
      );
    }
    await db
      .from('user_seen_unlocks')
      .upsert(
        all
          .slice(0, k + 1)
          .map((s) => ({ user_id: e2eUser.id, stage_id: s.id })),
      );
    await page.goto('/world');
    // 노드 차례 등장(scale 0.85 → 1)이 끝난 제 크기에서 잰다 (B57: 등장 중에 재서 겹침을 놓쳤음)
    await page.waitForFunction(() =>
      [...document.querySelectorAll<HTMLElement>('.world-node')].every((n) => {
        const s = getComputedStyle(n);
        return (
          s.opacity === '1' &&
          (s.transform === 'none' || s.transform === 'matrix(1, 0, 0, 1, 0, 0)')
        );
      }),
    );
    const hits = await page.evaluate(() => {
      const flag = document.querySelector('.wn-here-flag');
      if (!flag) return ['깃발 없음'];
      flag.textContent = '새 곳 도착!'; // 잠금 해제 때의 더 긴 문구로 잰다
      const f = flag.getBoundingClientRect();
      const map = document.querySelector('.world-map')!.getBoundingClientRect();
      const out: string[] = [];
      if (f.left < map.left - 1 || f.right > map.right + 1) out.push('지도 밖');
      for (const p of document.querySelectorAll('.wn-plate, .wn-meta')) {
        const b = p.getBoundingClientRect();
        const ox = Math.min(f.right, b.right) - Math.max(f.left, b.left);
        const oy = Math.min(f.bottom, b.bottom) - Math.max(f.top, b.top);
        if (ox > 2 && oy > 2) out.push(p.textContent?.trim() ?? '');
      }
      return out;
    });
    expect(hits, `${k + 1}번 노드`).toEqual([]);
  }
});

for (const [name, tier, reduced] of [
  ['minimal', 'minimal', 'off'],
  ['동작 줄이기', 'full', 'on'],
] as const) {
  test(`${name}: 지도·책장에 위치·크기 변화와 패럴랙스가 없다`, async ({
    page,
    e2eUser,
  }) => {
    await completeQuests(e2eUser.id, [s1.quests[0]]);
    await setMotion(e2eUser.id, tier, reduced);
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto('/world');
    await expect(page.locator('html')).toHaveAttribute('data-motion', tier);
    const before = await parallax(page);
    for (const y of [400, 900, 1400]) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(250);
      expect(await moving(page), `지도 y${y}`).toEqual([]);
    }
    expect(await parallax(page)).toEqual(before);
    await page.goto('/worlds');
    await page.waitForTimeout(500);
    expect(await moving(page), '책장').toEqual([]);
  });
}

test('full: 탭이 숨으면 지도 앰비언트가 멈추고, 돌아오면 다시 돈다', async ({
  page,
  e2eUser,
}) => {
  await setMotion(e2eUser.id, 'full', 'off');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/world');
  const ambient = () =>
    page.evaluate(
      (names) =>
        document
          .getAnimations()
          .filter(
            (a) =>
              a.playState === 'running' &&
              names.includes(String((a as CSSAnimation).animationName)),
          ).length,
      AMBIENT,
    );
  await expect.poll(ambient).toBeGreaterThan(0);
  const setHidden = (hidden: boolean) =>
    page.evaluate((hidden) => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => hidden,
      });
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => (hidden ? 'hidden' : 'visible'),
      });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await setHidden(true);
  await expect(page.locator('[data-amb-off]')).toHaveCount(1);
  await expect.poll(ambient).toBe(0);
  await setHidden(false);
  await expect.poll(ambient).toBeGreaterThan(0);
});

test('퀘스트에서 돌아와 열린 시트를 닫으면 뒤로 가기 한 번에 지도 앞 화면', async ({
  page,
  e2eUser,
}) => {
  await completeQuests(e2eUser.id, [s1.quests[0]]);
  await setMotion(e2eUser.id, 'minimal', 'off');
  await page.goto('/worlds');
  await page.goto('/world');
  // 역할로 찾는다: 스트리밍 중에는 아직 안 붙은 숨은 사본(<div hidden id="S:0">)이 같은 노드를 하나 더 갖고 있음 (B48)
  const sheet = await openStageSheet(page, s1.title);
  await page.getByTestId('stage-sheet-start').click();
  await expect(page).toHaveURL(/\/quest\//);
  await page.goBack();
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\/world$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/worlds$/);
});
