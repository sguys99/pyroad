// 실행기 (P1-09·B26): 자체 호스팅 Pyodide Worker 의 실시간 출력·멈추기·재준비 (P1-21)

import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { stage } from './support/content';
import {
  outputPanel,
  runButton,
  runCode,
  waitForRunner,
} from './support/quest';

const quest = stage(1).quests[0];

/**
 * 실행 줄(RunControls)이 거친 상태를 페이지가 열릴 때부터 모은다 (P6-05). 준비가 빠르면 눈으로 보기 전에 끝나므로
 * 화면을 기다리지 않고 `data-runner-state`·`data-load-stage` 변화를 기록해 둔다
 */
async function recordRunnerStates(
  page: Page,
): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __runnerStates: string[] }).__runnerStates = seen;
    const note = () => {
      for (const el of document.querySelectorAll('.qr[data-runner-state]')) {
        const v = `${el.getAttribute('data-runner-state')}:${el.getAttribute('data-load-stage') ?? '-'}`;
        if (seen.at(-1) !== v) seen.push(v);
      }
    };
    new MutationObserver(note).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-runner-state', 'data-load-stage'],
    });
  });
  return () =>
    page.evaluate(
      () => (window as unknown as { __runnerStates: string[] }).__runnerStates,
    );
}

test.describe('Python 실행기', () => {
  let runnerStates: () => Promise<string[]>;
  test.beforeEach(async ({ page }) => {
    runnerStates = await recordRunnerStates(page);
    await page.goto(`/quest/${quest.id}`);
    await waitForRunner(page);
  });

  test('처음에는 준비 단계를 보여 주고, 준비되면 안내가 사라진다 (P6-05)', async ({
    page,
  }) => {
    // Worker 단계: 불러오기(download) → 안전 점검(setup) → 준비됨. 진행률 숫자는 지어내지 않는다
    const states = await runnerStates();
    expect(states[0], states.join(' → ')).toMatch(/^preparing:/);
    expect(states).toContain('preparing:download');
    expect(states).toContain('preparing:setup');
    expect(states.at(-1)).toBe('ready:-');
    expect(states.indexOf('preparing:download')).toBeLessThan(
      states.indexOf('preparing:setup'),
    );
    await expect(
      page.locator('[data-testid="runner-loading"]:visible'),
    ).toBeHidden();
    await expect(runButton(page)).toHaveText('코드 돌려보기');
  });

  test('Pyodide 는 자체 호스팅 경로에서 받는다 (B26)', async ({
    page,
    baseURL,
  }) => {
    // Worker 안의 요청은 Playwright 의 페이지 요청 이벤트로 늘 잡히지는 않아서(가끔 빠짐),
    // Worker 의 Resource Timing 을 직접 읽는다. CDN(jsDelivr) 폴백 없이 /pyodide/<버전>/ 에서
    const worker = page
      .workers()
      .find((w) =>
        w.url().startsWith(`${baseURL}/pyodide/runner/pyodide-worker`),
      );
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

  test('input(): 프롬프트가 먼저 보이고, 입력 칸에 답하면 말풍선으로 남는다 (P11-01)', async ({
    page,
  }) => {
    await runCode(
      page,
      'print("안녕!")\nname = input("이름이 뭐야? ")\nage = int(input("몇 살? "))\nprint(name + "는", age + 1, "살이 될 거야")',
    );
    const output = outputPanel(page);
    const field = page.locator('[data-testid="input-reply-field"]:visible');
    await expect(field).toBeFocused();
    await expect(output).toContainText('대답을 기다려요');
    // 프롬프트는 답하기 전에 이미 보인다 (stdout 스트리밍)
    await expect(
      page.locator('[data-testid="live-output"]:visible'),
    ).toContainText('이름이 뭐야?');
    await field.fill('파이');
    await field.press('Enter');
    await expect(output).toContainText('몇 살?');
    await field.fill('9');
    await page.locator('[data-testid="input-reply-send"]:visible').click();

    await expect(output).toHaveAttribute('data-state', 'success');
    await expect(output).toContainText('파이는 10 살이 될 거야');
    // 답은 stdout이 아니라 말풍선으로 (프롬프트 뒤 자리에)
    await expect(output.getByTestId('output-answer')).toHaveText([
      '내 대답: 파이',
      '내 대답: 9',
    ]);
  });

  test('turtle: 그림판에 그리고, 바로 완성·모눈·PNG 저장, 그리는 무한 반복은 재준비 없이 멈춤 (P11-02)', async ({
    page,
  }) => {
    await runCode(
      page,
      'import turtle\nt = turtle.Turtle()\nt.color("red", "gold")\nt.begin_fill()\nfor i in range(4):\n    t.forward(150)\n    t.left(90)\nt.end_fill()\nt.write("네모", font=("Arial", 16, "bold"))\nturtle.title("내 네모")\nprint(t.position())',
    );
    const stage = page.locator('[data-testid="turtle-stage"]:visible');
    await expect(stage).toBeVisible();
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'success');
    // CPython과 같은 글자: 한 바퀴 돈 x는 -1.8e-14라 (-0.00,0.00)
    await expect(outputPanel(page)).toContainText('(-0.00,0.00)');
    // 1배로 그리는 중에 바로 완성
    const finish = stage.getByTestId('turtle-finish');
    if (await finish.isEnabled()) await finish.click();
    await expect(stage).toHaveAttribute('data-state', 'done');
    await expect(stage.getByTestId('turtle-title')).toHaveText('내 네모');
    await expect(stage.getByTestId('turtle-canvas')).toHaveAttribute(
      'aria-label',
      /선 4개, 색칠 1곳, 글씨 “네모”.*빨강, 금색/,
    );
    // 캔버스에 실제 픽셀이 칠해졌다 (그림 레이어)
    const inked = await stage.getByTestId('turtle-canvas').evaluate((host) => {
      const cv = host.querySelectorAll('canvas')[1] as HTMLCanvasElement;
      const d = cv
        .getContext('2d')!
        .getImageData(0, 0, cv.width, cv.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
      return n;
    });
    expect(inked).toBeGreaterThan(1000);

    // E2E_SHOTS=<폴더>면 360·768·1280 퀘스트 화면 (실행 뒤라 모바일은 결과 쪽)
    const shots = process.env.E2E_SHOTS;
    if (shots) {
      for (const width of [360, 768, 1280]) {
        await page.setViewportSize({ width, height: width < 768 ? 780 : 900 });
        const visible = page.locator('[data-testid="turtle-stage"]:visible');
        await visible.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${shots}/turtle-quest-${width}.png` });
      }
      await page.setViewportSize({ width: 1280, height: 720 });
    }

    const grid = stage.getByTestId('turtle-grid');
    await grid.click();
    await expect(grid).toHaveAttribute('aria-pressed', 'true');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      stage.getByTestId('turtle-save').click(),
    ]);
    expect(download.suggestedFilename()).toBe('내 네모.png');
    const png = await download.createReadStream();
    const head: Buffer = await new Promise((resolve) =>
      png.once('data', (b) => resolve(b as Buffer)),
    );
    expect(head.subarray(1, 4).toString()).toBe('PNG');

    // 그리는 무한 반복: 명령 5만 개에서 TurtleLimitError, 실행기 재준비 없음
    await runCode(
      page,
      'import turtle\nt = turtle.Turtle()\nwhile True:\n    t.forward(2)\n    t.left(7)',
    );
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'error', {
      timeout: 20_000,
    });
    await expect(outputPanel(page)).toContainText('그림 명령이 너무 많아요');
    expect((await runnerStates()).join(' → ')).not.toContain('restarting');
  });

  test('input() 대기 중 멈추기는 실행기를 다시 띄우지 않고 바로 멈춘다 (P11-01)', async ({
    page,
  }) => {
    await runCode(page, 'while True:\n    input("또? ")');
    const output = outputPanel(page);
    const field = page.locator('[data-testid="input-reply-field"]:visible');
    await field.fill('응');
    await field.press('Enter');
    await expect(output.getByTestId('output-answer')).toHaveCount(1);
    await expect(field).toBeFocused();
    await page.locator('[data-testid="input-reply-stop"]:visible').click();
    await expect(output).toHaveAttribute('data-state', 'stopped');
    // Worker를 살린 채 KeyboardInterrupt → 재준비 없이 바로 다시 실행
    await expect(
      page.locator('[data-testid="runner-waking"]:visible'),
    ).toHaveCount(0);
    expect((await runnerStates()).join(' → ')).not.toContain('restarting');
    await runCode(page, quest.solution);
    await expect(output).toHaveAttribute('data-state', 'success');
  });

  test('끝나지 않는 계산을 멈추면 실행기를 다시 깨운 뒤 다시 실행할 수 있다', async ({
    page,
  }) => {
    await runCode(page, 'while True:\n    pass');
    const output = outputPanel(page);
    await expect(output).toHaveAttribute('data-state', 'running');

    await expect(runButton(page)).toHaveText('실행 중...');
    await page.getByTestId('stop-button').click();
    // CPU 루프는 Worker 가 stop 에 답하지 못해 다시 띄운다 (재준비 연출, P6-05)
    const waking = page.locator('[data-testid="runner-waking"]:visible');
    await expect(waking).toBeVisible();
    await expect(waking).toContainText('주문 공책을 다시 펼치는 중');
    await expect(output).toHaveAttribute('data-state', 'stopped');

    await waitForRunner(page);
    await expect(waking).toBeHidden();
    // 실행 중 → 재준비(버튼 "다시 준비 중...", 못 누름) → 준비됨. 재준비는 처음 준비 안내(팁)를 다시 보이지 않는다
    const states = (await runnerStates()).join(' → ');
    expect(states).toMatch(
      /running:- → restarting:download( → restarting:setup)? → ready:-$/,
    );
    await runCode(page, quest.solution);
    await expect(output).toHaveAttribute('data-state', 'success');
  });

  test('오류가 나면 에러 메시지를 보여 주고 다시 실행할 수 있다', async ({
    page,
  }) => {
    await runCode(page, 'x = 1\nprint(undefined_var)');
    const output = outputPanel(page);
    await expect(output).toHaveAttribute('data-state', 'error');
    await expect(output).toContainText('NameError');
    await expect(runButton(page)).toBeEnabled();
    // 결과 쪽지(P6-06): 몇 번째 줄 + 마지막 한 줄 요약, 그 줄로 가기
    await expect(output.getByTestId('output-error')).toContainText('2번째 줄');

    // 오류가 난 줄(2)에 띠·줄 번호 표시, 고치기 시작하면 사라진다 (P2-18·P6-03)
    const errLine = page.locator('.cm-line[data-error-line]:visible');
    await expect(errLine).toHaveText('print(undefined_var)');
    await output.getByTestId('show-error-line').click();
    await expect(errLine).toBeInViewport();
    await expect(
      page.locator('.cm-gutterElement.cm-errorLineGutter:visible'),
    ).toHaveText('2');
    await errLine.click();
    await page.keyboard.insertText(' ');
    await expect(errLine).toHaveCount(0);

    // "처음 코드로": 물어본 뒤 시작 코드로 돌아가고 버튼이 꺼진다 (P6-03)
    const reset = page.getByTestId('reset-code').filter({ visible: true });
    await reset.click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: '처음 코드로' })
      .click();
    await expect(reset).toBeDisabled();
    await expect(page.locator('.cm-content:visible')).not.toContainText(
      'undefined_var',
    );
  });
});
