// 3월드 모바일 보강 카탈로그 견본 (world3 제안 L·M, P11-12). 비로그인 `public` 프로젝트, 서버 env PYROAD_TEST_PAGES=1.
// M: 360px 터치에서 3월드 스테이지마다 맨 앞 묶음(스테이지 키)이 띠를 넘기지 않고 다 보이고, 누르면 에디터에 들어감.
// L: 숫자를 탭하면 손잡이, 바꾸면 다시 그리기 부름. E2E_SHOTS=<폴더>면 360 화면

import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 360, height: 740 },
  hasTouch: true,
  isMobile: true,
});

test('3월드 코드 키보드: 스테이지 키가 360px에서 넘기지 않고 보이고, 누르면 들어감 (제안 M)', async ({
  page,
}) => {
  await page.goto('/dev/design#editor-handles');
  const demo = page.getByTestId('catalog-w3-keyboard');
  await demo.scrollIntoViewIfNeeded();
  const keyboard = demo.getByRole('toolbar', { name: '코드 키보드' });
  const expected: Record<string, string[]> = {
    '1': ['t.', 'forward()'],
    '2': ['input()', 'if'],
    '3': ['input()', 'if'],
    '4': ['class', 'self.'],
    '5': ['for', 'len()'],
    '6': ['get_key()'],
    F: ['t.', 'input()'],
  };
  for (const [tab, labels] of Object.entries(expected)) {
    await demo.getByRole('tab', { name: tab, exact: true }).tap();
    const front = keyboard.getByRole('group', { name: '이번 스테이지 앞자리' });
    await expect(front.getByRole('button')).toHaveText(labels);
    // 퀘스트 공책 360px 띠에서 넘기지 않고 보이는 폭은 150px 이상(number-handle.spec이 잼) → 앞자리는 그 안
    const g = (await front.boundingBox())!;
    expect(g.width, tab).toBeLessThanOrEqual(150);
  }
  if (process.env.E2E_SHOTS) {
    await demo.getByRole('tab', { name: '1', exact: true }).tap();
    await demo.screenshot({
      path: `${process.env.E2E_SHOTS}/w3-code-keyboard-360.png`,
    });
  }
  await demo.getByRole('tab', { name: '1', exact: true }).tap();
  await keyboard
    .getByRole('button', { name: 't 주문 넣기', exact: true })
    .tap();
  await keyboard
    .getByRole('button', { name: 'forward 주문 넣기', exact: true })
    .tap();
  await expect(demo.locator('.cm-content')).toContainText('t.forward()');
});

test('숫자 손잡이 견본: 탭 → 손잡이 → 바꾸면 코드와 다시 그리기 부름 (제안 L)', async ({
  page,
}) => {
  await page.goto('/dev/design#editor-handles');
  const demo = page.getByTestId('catalog-number-handle');
  await demo.scrollIntoViewIfNeeded();
  await demo.locator('.pr-tok-number').filter({ hasText: /^72$/ }).tap();
  const handle = demo.getByTestId('number-handle');
  await expect(handle).toHaveAttribute('aria-label', '숫자 손잡이: 각도');
  await handle.getByRole('button', { name: '5 크게' }).tap();
  await expect(demo.locator('.cm-content')).toContainText('t.left(77)');
  await expect(demo.getByTestId('catalog-number-nudges')).toHaveText(
    '다시 그리기 부름 1번',
  );
  // 음수 자리도 함께
  await demo.locator('.pr-tok-number').filter({ hasText: /^120$/ }).tap();
  await expect(handle).toHaveAttribute('aria-label', '숫자 손잡이: 자리');
  await handle.getByRole('button', { name: '10 작게' }).tap();
  await expect(demo.locator('.cm-content')).toContainText('t.goto(-130, 40)');
  if (process.env.E2E_SHOTS)
    await page.screenshot({
      path: `${process.env.E2E_SHOTS}/number-handle-catalog-360.png`,
    });
});
