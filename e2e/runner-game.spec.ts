// 키 입력·프레임 루프 (P11-04): get_key()를 쓰는 게임이 실행 중에 조종판을 펴고, 화살표 키(데스크톱)·방향 패드(폰)로
// 느릿이가 움직인다. time.sleep은 시간 제한에 들지 않아 5초를 넘겨도 돌고, 멈추기는 실행기를 다시 띄우지 않는다.
// SW 폴백(JSPI 없음) 경로는 runner-input-sw.spec.ts

import { test, expect } from './support/test';
import { stage } from './support/content';
import {
  outputPanel,
  runButton,
  runCode,
  setCode,
  waitForRunner,
} from './support/quest';

const quest = stage(1).quests[0];

/** 키를 누를 때마다 위치를 찍는 작은 게임 (끝을 정하지 않아 멈추기로 끝냄) */
const GAME = `import turtle, time
from pyroad import get_key
t = turtle.Turtle()
screen = turtle.Screen()
screen.tracer(0)
for frame in range(9000):
    key = get_key()
    if key == "Right":
        t.setx(t.xcor() + 10)
    elif key == "Left":
        t.setx(t.xcor() - 10)
    elif key == "Up":
        t.sety(t.ycor() + 10)
    if key:
        print(key, t.position())
    screen.update()
    time.sleep(1/30)`;

test.describe('게임 (데스크톱 키보드)', () => {
  test('조종판이 포커스를 가져오고 화살표로 움직이며, 5초가 지나도 돌다가 멈추기로 바로 끝남', async ({
    page,
  }) => {
    await page.goto(`/quest/${quest.id}`);
    await runCode(page, GAME);
    const pad = page.locator('[data-testid="game-keys"]:visible');
    await expect(pad).toBeFocused();
    // 마우스 화면에서는 방향 패드 대신 안내 한 줄
    await expect(pad.getByTestId('game-key-Up')).toBeHidden();

    const live = page.locator('[data-testid="live-output"]:visible');
    for (const key of ['ArrowRight', 'ArrowRight', 'ArrowUp']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(80); // 한 프레임(33ms)보다 길게
    }
    await expect(live).toContainText('Up (20.00,10.00)');
    if (process.env.E2E_SHOTS) {
      await page.screenshot({
        path: `${process.env.E2E_SHOTS}/p11-04-game-keys-1280.png`,
      });
    }
    // 그림판도 실행 중에 다시 그려진다 (프레임마다 보냄)
    await expect(
      page.locator('[data-testid="turtle-stage"]:visible'),
    ).toHaveAttribute('data-state', 'drawing');

    // 잠은 시간 제한(5초)에 들지 않는다
    await page.waitForTimeout(6000);
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'running');
    await page.keyboard.press('ArrowLeft');
    await expect(live).toContainText('Left (10.00,10.00)');

    // 게임판이 화면 안에 있다 (조종판이 나올 때 보이게 스크롤). 게임 중에는 그림판 도구 줄을 접어 캔버스 윗변이 잘리지 않음 (P11-13)
    const tools = page.locator('[data-testid="turtle-tools"]').first();
    await expect(tools).toBeHidden();
    await expect(pad).toBeInViewport({ ratio: 1 });
    await expect(
      page.locator('[data-testid="turtle-canvas"]:visible'),
    ).toBeInViewport({ ratio: 1 });
    if (process.env.E2E_SHOTS) {
      await page.screenshot({
        path: `${process.env.E2E_SHOTS}/p11-13-game-layout-1280.png`,
      });
    }

    await page.getByTestId('stop-button').click();
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'stopped');
    await expect(pad).toHaveCount(0);
    // 끝나면 도구 줄이 다시 펼쳐짐
    await expect(
      page.locator('[data-testid="turtle-tools"]:visible'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="runner-waking"]:visible'),
    ).toHaveCount(0);
    await runCode(page, quest.solution);
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'success');
  });
});

test.describe('게임 (폰 방향 패드)', () => {
  test.use({
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
  });

  test('폰에서는 그림판 아래 방향 패드(56px 이상)를 눌러 움직임', async ({
    page,
  }) => {
    await page.goto(`/quest/${quest.id}`);
    // 폰은 이야기 쪽부터: 공책 쪽에서 실행하면 결과 쪽으로 넘어감 (P6-11)
    await page.getByRole('tab', { name: /공책/ }).tap();
    await waitForRunner(page);
    await setCode(page, GAME);
    await runButton(page).tap();
    const pad = page.locator('[data-testid="game-keys"]:visible');
    const right = pad.getByTestId('game-key-Right');
    await expect(right).toBeVisible();
    const box = (await right.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(56);
    expect(box.height).toBeGreaterThanOrEqual(56);

    await right.tap();
    await page.waitForTimeout(80);
    await pad.getByTestId('game-key-Up').tap();
    const live = page.locator('[data-testid="live-output"]:visible');
    await expect(live).toContainText('Up (10.00,10.00)');

    // 한 화면에 그림판과 방향 패드가 모두 (도구 줄은 게임 중 접힘, 스크롤 없이 — P11-13)
    await expect(
      page.locator('[data-testid="turtle-tools"]:visible'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-testid="turtle-canvas"]:visible'),
    ).toBeInViewport({ ratio: 1 });
    await expect(pad.getByTestId('game-key-Down')).toBeInViewport({
      ratio: 1,
    });
    await expect(pad.getByTestId('game-keys-stop')).toBeInViewport({
      ratio: 1,
    });
    const shots = process.env.E2E_SHOTS;
    if (shots) {
      await page.screenshot({ path: `${shots}/p11-13-game-layout-360.png` });
    }

    // 폰 결과 쪽에는 실행 줄이 없어 조종판의 멈추기로
    await pad.getByTestId('game-keys-stop').tap();
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'stopped');
  });
});
