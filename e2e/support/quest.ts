// 퀘스트 화면 조작 도우미 (P1-21). testid 는 P1-09·P1-10 이 정한 것:
// run-button · stop-button · output-panel(data-state) · live-output · runner-waking · celebration-overlay ·
// celebration-step-<종류> · celebration-cta

import { expect, type Locator, type Page } from '@playwright/test';

/** Pyodide 를 처음 받을 때(자체 호스팅 /pyodide/, 약 10MB)를 감안한 대기 */
export const RUNNER_READY_TIMEOUT = 60_000;

/**
 * 실행 버튼. 화면에 보이는 것 하나만: 퀘스트 페이지는 loading.tsx 뒤에 스트리밍되어, 바꿔 끼우는 순간에는
 * 숨겨진 사본이 잠깐 같이 있어 getByTestId 가 strict mode 위반으로 바로 실패할 수 있다
 */
export function runButton(page: Page): Locator {
  return page.getByTestId('run-button').filter({ visible: true });
}

/** 결과 패널. md 이상 화면에서는 코드 패널 안의 것 하나만 보인다 (모바일 결과 탭용 복사본은 숨김) */
export function outputPanel(page: Page): Locator {
  return page.locator('[data-testid="output-panel"]:visible');
}

/** 이미 완료한 퀘스트 안내 (복습). runButton 과 같은 이유로 보이는 것만 */
export function completedNotice(page: Page): Locator {
  return page.getByText('이미 완료한 퀘스트예요!').filter({ visible: true });
}

/** 퀘스트 화면 맨 위 (스테이지·퀘스트 제목) */
export function questHeader(page: Page): Locator {
  return page.locator('header').first();
}

/**
 * 실행기(Pyodide Worker)가 준비되어 "코드 돌려보기!"를 누를 수 있을 때까지.
 * 준비 전(idle·loading)에는 버튼 글자가 "준비 중..."이라 글자가 바뀌면 준비된 것이지만,
 * 준비돼도 에디터가 비었으면 같은 글자로 비활성이므로 활성화까지 본다
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

/**
 * "파이뱀에게 물어보기"를 열어 대화를 보인다 (P6-10). 넓은 화면은 이야기 쪽 안에서 펼침, 좁은 화면은 바텀시트.
 * 돌려주는 것은 대화가 들어 있는 상자
 */
export async function openTutorChat(page: Page): Promise<Locator> {
  await page.getByTestId('ask-pybaem').click();
  const chat = page
    .getByTestId('ask-panel')
    .or(page.getByRole('dialog', { name: '파이뱀에게 물어보기' }));
  await expect(chat.getByTestId('chat-log')).toBeVisible();
  return chat;
}

/** 월드맵에서 해당 스테이지 버튼 (StageNode 는 링크가 아니라 버튼이고, 잠기면 disabled) */
export function stageButton(page: Page, stageTitle: string): Locator {
  return page.getByRole('button', { name: new RegExp(stageTitle) });
}

/** 스테이지 노드를 눌러 차례 시트를 연다 (P5-06). 주소에 ?stage= 가 남는다 */
export async function openStageSheet(
  page: Page,
  stageTitle: string,
): Promise<Locator> {
  await stageButton(page, stageTitle).click();
  const sheet = page.getByTestId('stage-sheet');
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(/[?&]stage=/);
  return sheet;
}

/**
 * 앞 축하 카드를 Enter 로 넘겨(연출 중이면 첫 Enter 는 끝 상태로, P6-13) 맨 뒤 스테이지 클리어 카드까지 간다.
 * 돌려주는 것은 그 카드
 */
export async function toStageClear(page: Page): Promise<Locator> {
  const card = page.getByTestId('celebration-step-stage_clear');
  await expect(page.getByTestId('celebration-overlay')).toBeVisible();
  await expect(async () => {
    if (!(await card.isVisible())) await page.keyboard.press('Enter');
    await expect(card).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 20_000 });
  return card;
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
