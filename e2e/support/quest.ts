// 퀘스트 화면 조작 도우미 (P1-21). testid 는 P1-09·P1-10 이 정한 것:
// run-button · stop-button · output-panel(data-state) · live-output · runner-waking · celebration-overlay ·
// celebration-step-<종류> · celebration-cta

import { expect, type Locator, type Page } from '@playwright/test';

/** Pyodide 를 처음 받을 때(자체 호스팅 /pyodide/, 약 10MB)를 감안한 대기 */
export const RUNNER_READY_TIMEOUT = 60_000;

export function runButton(page: Page): Locator {
  return page.getByTestId('run-button');
}

/** 결과 패널. md 이상 화면에서는 코드 패널 안의 것 하나만 보인다 (모바일 결과 탭용 복사본은 숨김) */
export function outputPanel(page: Page): Locator {
  return page.locator('[data-testid="output-panel"]:visible');
}

/** 퀘스트 화면 맨 위 (스테이지·퀘스트 제목) */
export function questHeader(page: Page): Locator {
  return page.locator('header').first();
}

/**
 * 실행기(Pyodide Worker)가 준비되어 "코드 돌려보기!"를 누를 수 있을 때까지.
 * Worker 를 띄우기 전(idle)에도 버튼 글자는 "코드 돌려보기!"이고 비활성이므로 활성화까지 본다
 */
export async function waitForRunner(page: Page): Promise<void> {
  const button = runButton(page);
  await expect(button).toHaveText(/코드 돌려보기/, {
    timeout: RUNNER_READY_TIMEOUT,
  });
  await expect(button).toBeEnabled({ timeout: RUNNER_READY_TIMEOUT });
}

/**
 * 에디터 내용을 바꾼다. 한 번에 넣어서(insertText) CodeMirror 의 괄호 자동 닫기·자동 들여쓰기가 끼어들지 않게 한다
 */
export async function setCode(page: Page, code: string): Promise<void> {
  const content = page.locator('.cm-editor .cm-content');
  await content.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(code);
}

export async function runCode(page: Page, code: string): Promise<void> {
  await waitForRunner(page);
  await setCode(page, code);
  await runButton(page).click();
}

/** 월드맵에서 해당 스테이지 버튼 (StageNode 는 링크가 아니라 버튼이고, 잠기면 disabled) */
export function stageButton(page: Page, stageTitle: string): Locator {
  return page.getByRole('button', { name: new RegExp(stageTitle) });
}

/**
 * 축하 카드 하나를 CTA 로 넘긴다. 카드 위에 마우스를 올려 자동 넘김을 멈추고,
 * 등장 직후(MIN_DWELL_MS)에는 넘기기가 무시되므로 카드가 사라질 때까지 다시 누른다
 * (이 카드의 CTA 만 누르므로 다음 카드를 건너뛰지 않음)
 */
export async function advanceCelebration(
  page: Page,
  kind: string,
): Promise<void> {
  const card = page.getByTestId(`celebration-step-${kind}`);
  await expect(card).toBeVisible();
  await card.hover();
  await expect(async () => {
    if (await card.isVisible()) {
      await card.getByTestId('celebration-cta').click({ timeout: 1_000 });
    }
    await expect(card).toBeHidden({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
}
