// 숫자 손잡이 (world3 제안 L, P11-12): turtle 코드의 숫자를 누르면 슬라이더가 뜨고, 바꾸면 코드가 바뀌며 잠깐 뒤 그림을 다시 그린다.
// 다시 그리기는 세션 실행 경로 그대로(채점·쪽 넘김 없음). 키보드는 Alt+Enter → 슬라이더, Esc로 돌아옴.
// E2E_SHOTS=<폴더>면 1280·360 손잡이 화면

import { test, expect } from './support/test';
import { stage } from './support/content';
import { outputPanel, runCode, setCode, waitForRunner } from './support/quest';
import type { Page } from '@playwright/test';

const quest = stage(1).quests[0];
const CODE =
  'import turtle\nt = turtle.Turtle()\nfor i in range(3):\n    t.forward(100)\n    t.left(120)';

const editorText = (page: Page) =>
  page.locator('.cm-content:visible').innerText();
const canvas = (page: Page) =>
  page
    .locator('[data-testid="turtle-stage"]:visible')
    .getByTestId('turtle-canvas');
const number = (page: Page, text: string) =>
  page
    .locator('.cm-content:visible .pr-tok-number')
    .filter({ hasText: new RegExp(`^${text}$`) });

test.describe('숫자 손잡이 (제안 L)', () => {
  test('숫자를 누르면 슬라이더, 바꾸면 코드가 바뀌고 그림을 다시 그림 (채점 없음)', async ({
    page,
  }) => {
    await page.goto(`/quest/${quest.id}`);
    await runCode(page, CODE);
    await expect(canvas(page)).toHaveAttribute('aria-label', /선 3개/);

    await number(page, '3').click();
    const handle = page.getByTestId('number-handle');
    await expect(handle).toBeVisible();
    await expect(handle).toHaveAttribute('aria-label', '숫자 손잡이: 횟수');
    await handle.getByRole('button', { name: '1 크게' }).click();
    expect(await editorText(page)).toContain('range(4)');
    await expect(canvas(page)).toHaveAttribute('aria-label', /선 4개/);
    // 슬라이더 화살표
    const slider = handle.getByRole('slider', { name: '횟수 바꾸기' });
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    expect(await editorText(page)).toContain('range(5)');
    await expect(canvas(page)).toHaveAttribute('aria-label', /선 5개/);
    // 다시 그리기는 채점하지 않음 (첫 실행의 판정이 지워지고 새 판정 없음)
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'success');
    await expect(outputPanel(page)).not.toHaveAttribute('data-verdict', /./);

    if (process.env.E2E_SHOTS)
      await page.screenshot({
        path: `${process.env.E2E_SHOTS}/number-handle-1280.png`,
      });

    // Esc → 에디터로, 타자를 치면 닫힘
    await page.keyboard.press('Escape');
    await expect(handle).toHaveCount(0);
    await number(page, '100').click();
    await expect(handle).toHaveAttribute('aria-label', '숫자 손잡이: 길이');
    await page.keyboard.type('5');
    await expect(handle).toHaveCount(0);
    expect(await editorText(page)).toMatch(/forward\(\d{4}\)/);

    // 키보드로 열기: 숫자 위에서 Alt+Enter → 슬라이더에 포커스
    await number(page, '120').click();
    await page.keyboard.press('Escape');
    await expect(handle).toHaveCount(0);
    await page.keyboard.press('Alt+Enter');
    await expect(
      handle.getByRole('slider', { name: '각도 바꾸기' }),
    ).toBeFocused();
    await page.keyboard.press('Home');
    expect(await editorText(page)).toContain('left(0)');
    await page.keyboard.press('Escape');
    await expect(page.locator('.cm-content:visible')).toBeFocused();
  });

  test('turtle이 아닌 코드에는 손잡이가 없음', async ({ page }) => {
    await page.goto(`/quest/${quest.id}`);
    await waitForRunner(page);
    await setCode(page, 'print(3 + 4)');
    await number(page, '3').click();
    await expect(page.getByTestId('number-handle')).toHaveCount(0);
  });
});

test.describe('숫자 손잡이 360px 터치 (제안 L)', () => {
  test.use({
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
  });

  test('탭하면 화면 안에 손잡이, 44px 버튼, 결과 쪽 그림이 다시 그려져 있음', async ({
    page,
  }) => {
    await page.goto(`/quest/${quest.id}`);
    await page.getByRole('tab', { name: /공책/ }).tap();
    await waitForRunner(page);
    await setCode(page, CODE);
    await page.keyboard.press('Escape'); // 자동 완성 목록
    await number(page, '3').tap();
    const handle = page.getByTestId('number-handle');
    await expect(handle).toBeVisible();
    const box = (await handle.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
    const keyboard = page.getByRole('toolbar', { name: '코드 키보드' });
    const strip = (await keyboard.locator('.ck-strip').boundingBox())!;
    // 띠에서 넘기지 않고 보이는 폭(오른쪽 흐림 1.25rem 앞)이 150px 이상 — 3월드 스테이지 앞자리는 150px 안 (public/editor-handles)
    expect(strip.width - 20).toBeGreaterThanOrEqual(150);
    const plus = handle.getByRole('button', { name: '1 크게' });
    const b = (await plus.boundingBox())!;
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
    if (process.env.E2E_SHOTS)
      await page.screenshot({
        path: `${process.env.E2E_SHOTS}/number-handle-360.png`,
      });
    await plus.tap();
    expect(await editorText(page)).toContain('range(4)');
    // 공책 쪽에 머문 채 다시 그림 → 결과 쪽으로 가 보면 새 그림
    await expect(page.getByRole('tab', { name: /공책/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.getByRole('tab', { name: /결과/ }).tap();
    await expect(canvas(page)).toHaveAttribute('aria-label', /선 4개/);
  });
});
