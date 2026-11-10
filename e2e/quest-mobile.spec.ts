// 모바일 퀘스트 레이아웃 (P6-11, §12-Q55): 번호 탭 + 좌우 스와이프(에디터·코드 키보드 안은 제외),
// 실행하면 결과 쪽으로 자동 이동 + ③결과 탭 상태 점, 폰 키보드가 올라오면 코드 키보드가 그 위에 붙음(visualViewport).
//
// 스와이프는 CDP Input.dispatchTouchEvent로 실제 터치 이벤트를 보낸다(360×740 터치).
// 폰 키보드는 헤드리스 크롬이 띄우지 않으므로 visualViewport를 가짜로 바꿔 끼우고 resize 이벤트를 보낸다 (iOS·안드로이드가 주는 값과 같은 모양)

import { test, expect } from './support/test';
import { stage } from './support/content';
import {
  outputPanel,
  runButton,
  setCode,
  waitForRunner,
} from './support/quest';
import type { Page } from '@playwright/test';

type Point = { x: number; y: number };

async function swipe(page: Page, from: Point, to: Point) {
  const cdp = await page.context().newCDPSession(page);
  const at = (p: Point) => [{ x: p.x, y: p.y }];
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: at(from),
  });
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: at({
        x: from.x + ((to.x - from.x) * i) / steps,
        y: from.y + ((to.y - from.y) * i) / steps,
      }),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await cdp.detach();
}

/** 상자 가운데에서 가로로 dx만큼 끈다 */
async function swipeOn(page: Page, selector: string, dx: number, dy = 0) {
  const box = (await page.locator(selector).first().boundingBox())!;
  const c = {
    x: box.x + box.width / 2,
    y: box.y + Math.min(box.height / 2, 200),
  };
  await swipe(
    page,
    { x: c.x - dx / 2, y: c.y - dy / 2 },
    { x: c.x + dx / 2, y: c.y + dy / 2 },
  );
}

const selected = (page: Page, name: RegExp) =>
  expect(page.getByRole('tab', { name })).toHaveAttribute(
    'aria-selected',
    'true',
  );

test.describe('모바일 퀘스트 쪽 넘기기 (360px 터치)', () => {
  test.use({
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
  });

  test('좌우 스와이프로 쪽을 넘기고, 세로 몸짓·에디터·코드 키보드 안 스와이프는 넘기지 않는다', async ({
    page,
  }) => {
    await page.goto(`/quest/${stage(1).quests[0].id}`);
    await selected(page, /이야기/);

    // 세로로 쓸면 쪽은 그대로 (스크롤)
    await swipeOn(page, '#quest-page-story', 20, -160);
    await selected(page, /이야기/);
    // 왼쪽으로 = 다음 쪽
    await swipeOn(page, '#quest-page-story', -200);
    await selected(page, /공책/);
    await waitForRunner(page);

    // 에디터 안·코드 키보드 띠 위의 가로 몸짓은 넘기지 않음
    await swipeOn(page, '.cm-editor', -200);
    await swipeOn(page, '[data-testid="code-keyboard"]', -200);
    await selected(page, /공책/);

    // 공책 → 결과 → (끝 쪽에서 더 밀어도 그대로) → 오른쪽으로 공책
    await swipeOn(page, '[data-testid="run-button"]', -200);
    await selected(page, /결과/);
    await swipeOn(page, '#quest-page-notebook', -200);
    await selected(page, /결과/);
    await swipeOn(page, '#quest-page-notebook', 200);
    await selected(page, /공책/);
    // 짧게 끌면 제자리로
    await swipeOn(page, '#quest-page-notebook', -40);
    await selected(page, /공책/);
    await expect(page.locator('#quest-page-notebook')).not.toHaveAttribute(
      'style',
      /translate/,
    );
    // 쪽을 옆으로 밀어도 가로 스크롤이 생기지 않음
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

  test('실행하면 결과 쪽으로 넘어가고, 결과 탭에 상태 점(고칠 곳 있음 → 통과)', async ({
    page,
  }) => {
    const quest = stage(1).quests[0];
    await page.goto(`/quest/${quest.id}`);
    await page.getByRole('tab', { name: /공책/ }).tap();
    await waitForRunner(page);

    await setCode(page, 'print(없는_이름)');
    await runButton(page).tap();
    await selected(page, /결과/);
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'error');
    await expect(page.getByRole('tab', { name: /결과/ })).toContainText(
      '고칠 곳 있음',
    );

    await page.getByRole('tab', { name: /공책/ }).tap();
    await setCode(page, quest.solution);
    await runButton(page).tap();
    await selected(page, /결과/);
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'success', {
      timeout: 30_000,
    });
    await expect(page.getByRole('tab', { name: /결과/ })).toContainText('통과');
  });

  test('폰 키보드가 올라오면 코드 키보드가 그 위에 붙고, 내려가면 제자리로', async ({
    page,
  }) => {
    // 가짜 visualViewport: 높이·offsetTop을 테스트가 바꾸고 resize를 보낸다
    await page.addInitScript(() => {
      const vv = Object.assign(new EventTarget(), {
        offsetTop: 0,
        offsetLeft: 0,
        pageTop: 0,
        pageLeft: 0,
        scale: 1,
        width: window.innerWidth,
        height: window.innerHeight,
      });
      Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        get: () => vv,
      });
      (window as unknown as { __vv: typeof vv }).__vv = vv;
    });
    const setKeyboard = (px: number, offsetTop = 0) =>
      page.evaluate(
        ([px, offsetTop]) => {
          const vv = (
            window as unknown as {
              __vv: EventTarget & { height: number; offsetTop: number };
            }
          ).__vv;
          vv.height = window.innerHeight - px;
          vv.offsetTop = offsetTop;
          vv.dispatchEvent(new Event('resize'));
        },
        [px, offsetTop],
      );

    await page.goto(`/quest/${stage(1).quests[0].id}`);
    await page.getByRole('tab', { name: /공책/ }).tap();
    await waitForRunner(page);
    const keyboard = page.getByTestId('code-keyboard');
    const slotHeight = async () =>
      (await page.locator('.ck-slot').boundingBox())!.height;
    const before = await slotHeight();

    // 에디터에 커서가 없으면 키보드가 올라와도 붙지 않음
    await setKeyboard(300);
    await expect(keyboard).not.toHaveAttribute('data-docked');

    await page.locator('.cm-editor .cm-content').tap();
    await setKeyboard(300);
    await expect(keyboard).toHaveAttribute('data-docked', '');
    // 띠 아래 끝 = 폰 키보드 윗변 (740 - 300)
    await expect
      .poll(async () => {
        const b = (await keyboard.boundingBox())!;
        return Math.round(b.y + b.height);
      })
      .toBe(440);
    // iOS처럼 visual viewport가 위로 밀려도(offsetTop) 키보드 윗변을 따라감
    await setKeyboard(300, 120);
    await expect
      .poll(async () => {
        const b = (await keyboard.boundingBox())!;
        return Math.round(b.y + b.height);
      })
      .toBe(560);
    // 붙은 띠의 키도 눌러지고 포커스는 에디터에
    await keyboard.getByRole('button', { name: 'print 주문 넣기' }).tap();
    await expect(page.locator('.cm-content')).toBeFocused();
    await expect(page.locator('.cm-content')).toContainText('print()');
    // 자리는 그대로라 공책이 출렁이지 않음
    await setKeyboard(300, 0);
    expect(await slotHeight()).toBeCloseTo(before, 0);

    await setKeyboard(0);
    await expect(keyboard).not.toHaveAttribute('data-docked');
  });
});
