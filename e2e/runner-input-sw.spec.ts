// input() SW 폴백 (P11-01, P0-05 ②): JSPI가 없는 브라우저(Safari/iOS 26 이하 등)를 Chromium에서 흉내 낸다.
// Chromium은 실행 옵션으로 JSPI를 끌 수 없어서(--js-flags·--disable-features 모두 실측 실패) 페이지와 Worker 스크립트
// 맨 앞에서 `WebAssembly.Suspending`을 지운다. 그러면 페이지는 SW를 등록하고 Pyodide는 run_sync를 못 써 SW 동기 XHR로 간다

import { test, expect } from './support/test';
import { stage } from './support/content';
import { outputPanel, runCode } from './support/quest';

const quest = stage(1).quests[0];

const NO_JSPI = 'delete WebAssembly.Suspending; delete WebAssembly.promising;';

test('실행기 경로 SW가 동기 XHR로 답을 넘기고, 대기 중 멈추기도 SW로', async ({
  page,
}) => {
  await page.addInitScript(NO_JSPI);
  await page.route('**/pyodide/runner/pyodide-worker.mjs', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: `${NO_JSPI}\n${await response.text()}`,
    });
  });
  await page.goto(`/quest/${quest.id}`);
  expect(await page.evaluate(() => 'Suspending' in WebAssembly)).toBe(false);
  await runCode(page, 'name = input("이름? ")\nprint("안녕", name)');
  const output = outputPanel(page);
  const field = page.locator('[data-testid="input-reply-field"]:visible');
  await field.fill('버그');
  await field.press('Enter');
  await expect(output).toHaveAttribute('data-state', 'success');
  await expect(output).toContainText('안녕 버그');
  // 앱 페이지는 SW 밖, 실행기 경로만 SW scope
  const scopes = await page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistrations()).map((r) => r.scope),
  );
  expect(scopes.map((s) => new URL(s).pathname)).toEqual(['/pyodide/runner/']);
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(
    false,
  );

  await runCode(page, 'while True:\n    input("또? ")');
  await expect(field).toBeFocused();
  await page.locator('[data-testid="input-reply-stop"]:visible').click();
  await expect(output).toHaveAttribute('data-state', 'stopped');
  await expect(
    page.locator('[data-testid="runner-waking"]:visible'),
  ).toHaveCount(0);

  // time.sleep도 SW 동기 XHR로 자서, 자는 중 멈추기가 재준비 없이 끝난다 (P11-03)
  await runCode(
    page,
    'import time\nfor i in range(100):\n    print("쿨쿨", i)\n    time.sleep(0.3)',
  );
  await expect(
    page.locator('[data-testid="live-output"]:visible'),
  ).toContainText('쿨쿨 1');
  await page.getByTestId('stop-button').click();
  await expect(output).toHaveAttribute('data-state', 'stopped');
  await expect(output).toContainText('쿨쿨 0');
  await expect(
    page.locator('[data-testid="runner-waking"]:visible'),
  ).toHaveCount(0);
  await runCode(page, 'print("깨어남")');
  await expect(output).toContainText('깨어남');

  // 키 입력 (P11-04): Worker는 자는 동안 동기 XHR에 막혀 있으므로 페이지가 키를 SW에 보내고, 잠 답에 실려 간다
  await runCode(
    page,
    'import time\nfrom pyroad import get_key\nfor frame in range(3000):\n    key = get_key()\n    if key:\n        print("키", key)\n    time.sleep(1/30)',
  );
  await expect(page.locator('[data-testid="game-keys"]:visible')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('a');
  await expect(
    page.locator('[data-testid="live-output"]:visible').locator('li'),
  ).toHaveText(['키 Left', '키 a']);
  await page.getByTestId('stop-button').click();
  await expect(output).toHaveAttribute('data-state', 'stopped');
  await expect(
    page.locator('[data-testid="runner-waking"]:visible'),
  ).toHaveCount(0);
});
