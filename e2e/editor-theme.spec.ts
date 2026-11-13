// 에디터 테마 (P9-06): 상점 "공책" 탭에서 밤하늘 공책 쓰기 → 퀘스트 에디터 상자가 서버 HTML부터 그 색(깜빡임 없음) →
// 상점에서 그만 쓰기 → 기본 공책. 360·1280. 가진 물건은 리셋되지 않아, 없을 때만 API 로 사 둔다(구매 화면은 shop.spec.ts)

import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { grantTestCoins } from './support/admin';
import { stage } from './support/content';

const quest = stage(1).quests[0];
const NIGHT_BG = 'rgb(30, 35, 64)'; // EDITOR_THEMES.night.codeBg #1E2340
const DEFAULT_BG = 'rgb(255, 255, 255)'; // COLOR.codeBg

async function openThemeSheet(page: Page) {
  await page.goto('/shop');
  await page.getByRole('tab', { name: '공책' }).click();
  await page.getByRole('button', { name: /^밤하늘 공책,/ }).click();
  return page.getByTestId('shop-sheet');
}

/** 퀘스트 에디터 상자: 서버 HTML의 테마 속성 + 실제 CodeMirror 면 색 */
async function expectQuestEditor(page: Page, theme: string | null) {
  const html = await (await page.request.get(`/quest/${quest.id}`)).text();
  if (theme) expect(html).toContain(`data-editor-theme="${theme}"`);
  else expect(html).not.toContain('data-editor-theme=');

  await page.goto(`/quest/${quest.id}`);
  const width = page.viewportSize()!.width;
  if (width < 1024) await page.getByRole('tab', { name: /공책/ }).click();
  const box = page.getByTestId('code-editor').filter({ visible: true });
  if (theme) await expect(box).toHaveAttribute('data-editor-theme', theme);
  else await expect(box).not.toHaveAttribute('data-editor-theme');
  const editor = box.locator('.cm-editor');
  await expect(editor).toBeVisible();
  await expect(editor).toHaveCSS(
    'background-color',
    theme ? NIGHT_BG : DEFAULT_BG,
  );
}

for (const width of [360, 1280]) {
  test(`${width}px: 상점에서 공책 테마 쓰기·그만 쓰기 → 퀘스트 에디터에 반영`, async ({
    page,
    e2eUser,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 800 });
    const shop = await (await page.request.get('/api/shop')).json();
    if (!shop.owned.includes('theme_night')) {
      await grantTestCoins(e2eUser.id, 450);
      const res = await page.request.post('/api/shop/purchase', {
        data: { itemId: 'theme_night' },
      });
      expect(res.ok()).toBe(true);
    }
    try {
      // 상점: 쓰기 → 칸이 "쓰는 중", 견본은 같은 테마 블록
      let sheet = await openThemeSheet(page);
      await expect(
        sheet.locator('.shop-theme[data-editor-theme="night"]'),
      ).toBeVisible();
      if ((await sheet.getByTestId('shop-equip').textContent()) === '쓰기')
        await sheet.getByTestId('shop-equip').click();
      await expect(sheet.getByTestId('shop-equip')).toHaveText('그만 쓰기');
      await page.keyboard.press('Escape');
      await expect(
        page.locator('[data-item="theme_night"]').first(),
      ).toHaveAttribute('data-state', 'equipped');

      await expectQuestEditor(page, 'night');
      await page.screenshot({
        path: testInfo.outputPath(`quest-night-${width}.png`),
      });

      // 상점: 그만 쓰기 → 기본 공책
      sheet = await openThemeSheet(page);
      await sheet.getByTestId('shop-equip').click();
      await expect(sheet.getByTestId('shop-equip')).toHaveText('쓰기');
      await expectQuestEditor(page, null);
    } finally {
      // 다른 스펙이 기본 공책을 보게 (사용자 설정은 리셋되지 않음)
      await page.request.post('/api/shop/equip', {
        data: { slot: 'editor_theme', itemId: null },
      });
    }
  });
}
