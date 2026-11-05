// 실행기 (P1-09·B26): 자체 호스팅 Pyodide Worker 의 실시간 출력·멈추기·재준비 (P1-21)

import { test, expect } from './support/test';
import { stage } from './support/content';
import {
  outputPanel,
  runButton,
  runCode,
  waitForRunner,
} from './support/quest';

const quest = stage(1).quests[0];

test.describe('Python 실행기', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/quest/${quest.id}`);
    await waitForRunner(page);
  });

  test('Pyodide 는 자체 호스팅 경로에서 받는다 (B26)', async ({
    page,
    baseURL,
  }) => {
    // Worker 안의 요청은 Playwright 의 페이지 요청 이벤트로 늘 잡히지는 않아서(가끔 빠짐),
    // Worker 의 Resource Timing 을 직접 읽는다. CDN(jsDelivr) 폴백 없이 /pyodide/<버전>/ 에서
    const worker = page
      .workers()
      .find((w) => w.url().startsWith(`${baseURL}/workers/pyodide-worker`));
    expect(worker, 'Pyodide module Worker').toBeTruthy();
    const loaded = await worker!.evaluate(() =>
      performance.getEntriesByType('resource').map((e) => e.name),
    );
    expect(
      loaded.some((url) => /\/pyodide\/[^/]+\/pyodide\.asm\.wasm$/.test(url)),
      loaded.join('\n'),
    ).toBe(true);
    expect(loaded.filter((url) => !url.startsWith(baseURL!))).toEqual([]);
    await expect(runButton(page)).toBeEnabled();
  });

  test('실행 중 출력이 실시간으로 보이고, 멈추기로 멈춘다', async ({
    page,
  }) => {
    await runCode(
      page,
      'import time\nfor i in range(1000):\n    print("반복", i)\n    time.sleep(0.2)',
    );

    const output = outputPanel(page);
    await expect(output).toHaveAttribute('data-state', 'running');
    await expect(
      page.locator('[data-testid="live-output"]:visible'),
    ).toContainText('반복 1');

    await page.getByTestId('stop-button').click();
    await expect(output).toHaveAttribute('data-state', 'stopped');
    await expect(output).toContainText('실행을 멈췄어요');
    await expect(output).toContainText('반복 0'); // 멈추기 전 출력은 남는다
    await expect(page.getByTestId('stop-button')).toBeHidden();

    // 바로 다시 실행할 수 있다
    await runCode(page, quest.solution);
    await expect(output).toHaveAttribute('data-state', 'success');
  });

  test('끝나지 않는 계산을 멈추면 실행기를 다시 깨운 뒤 다시 실행할 수 있다', async ({
    page,
  }) => {
    await runCode(page, 'while True:\n    pass');
    const output = outputPanel(page);
    await expect(output).toHaveAttribute('data-state', 'running');

    await page.getByTestId('stop-button').click();
    // CPU 루프는 Worker 가 stop 에 답하지 못해 다시 띄운다 (재준비 연출)
    await expect(
      page.locator('[data-testid="runner-waking"]:visible'),
    ).toBeVisible();
    await expect(output).toHaveAttribute('data-state', 'stopped');

    await waitForRunner(page);
    await expect(
      page.locator('[data-testid="runner-waking"]:visible'),
    ).toBeHidden();
    await runCode(page, quest.solution);
    await expect(output).toHaveAttribute('data-state', 'success');
  });

  test('오류가 나면 에러 메시지를 보여 주고 다시 실행할 수 있다', async ({
    page,
  }) => {
    await runCode(page, 'print(undefined_var)');
    const output = outputPanel(page);
    await expect(output).toHaveAttribute('data-state', 'error');
    await expect(output).toContainText('NameError');
    await expect(runButton(page)).toBeEnabled();
  });
});
