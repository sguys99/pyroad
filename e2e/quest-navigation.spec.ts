// 퀘스트 사이 이동 회귀 (P6-15). 퀘스트 페이지는 렌더러를 key={quest.id}로 다시 마운트하고 Pyodide Worker만
// 레이아웃이 계속 가진다(B22). 앞 퀘스트의 상태(코드·결과·대사·힌트 쪽지·물어보기·축하·버그버그 화해·
// 단계 박자·모바일 탭)와 예약한 타이머가 다음 퀘스트 화면에 남지 않는지, 소프트 이동 네 가지로 확인한다:
// "다음 퀘스트" CTA · 헤더 스테이지 점 · 브라우저 뒤로/앞으로 · 프로젝트 단계 박자 중 이동.
// 컨페티 지우기는 단위 테스트(useQuestSession)가 본다 — 짧아서 e2e로는 박자가 맞지 않음. 효과음은 요청 기록 `pyroad:sfx`(P6-14)로: 앞 퀘스트의 보상음·축하음이 이동 뒤 울리지 않는지 본다

import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { completeQuests } from './support/admin';
import { projectQuest, stage, stages } from './support/content';
import {
  outputPanel,
  runButton,
  runCode,
  waitForRunner,
} from './support/quest';

const [questA, questB] = stage(1).quests;
const IDLE_LINE = '이야기를 읽고 해 볼 일을 확인해요';
/** 앞 퀘스트가 예약했을 수 있는 가장 긴 타이머(축하 1.8초·화해 쪽지·단계 박자 2.2초)보다 길게 */
const PAST_TIMERS_MS = 3_000;

const editor = (page: Page) => page.locator('.cm-editor .cm-content');
const dots = (page: Page) =>
  page.getByTestId('stage-progress').getByRole('link');

/** 새 퀘스트 화면이 처음 상태인지 (데스크톱) */
async function expectFreshQuest(page: Page, starter: string) {
  await expect(editor(page)).toHaveText(starter.replace(/\n/g, ''));
  const output = outputPanel(page);
  await expect(output).toHaveAttribute('data-state', 'empty');
  await expect(output).not.toHaveAttribute('data-verdict', /.+/);
  await expect(page.getByTestId('bugbug-aside')).toHaveCount(0);
  await expect(page.getByTestId('bugbug-makeup')).toHaveCount(0);
  await expect(
    page.locator('[data-testid="quest-reward"]:visible'),
  ).toHaveCount(0);
  await expect(page.getByTestId('quest-dialogue')).toContainText(IDLE_LINE);
  await expect(
    page.getByRole('button', { name: '힌트 받기 (3번 남음)' }),
  ).toBeEnabled();
  await expect(page.getByRole('list', { name: '받은 힌트' })).toHaveCount(0);
  await expect(page.getByTestId('ask-panel')).toHaveCount(0);
  await expect(page.getByTestId('celebration-overlay')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-celebrating');
}

test.describe('퀘스트 사이 이동: 앞 퀘스트 상태가 남지 않는다 (P6-15)', () => {
  test('"다음 퀘스트": 힌트·오류·화해·통과·축하 대기 중인 퀘스트를 떠나도 새 퀘스트는 처음 상태', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
      const w = window as unknown as { __sfx: string[] };
      w.__sfx = [];
      window.addEventListener('pyroad:sfx', (e) =>
        w.__sfx.push((e as CustomEvent<{ id: string }>).detail.id),
      );
    });
    const sfx = () =>
      page.evaluate(() => (window as unknown as { __sfx: string[] }).__sfx);
    await page.goto(`/quest/${questA.id}`);
    await waitForRunner(page);

    // A를 어지럽힌다: 힌트 쪽지 1장, 오류 → 버그버그, 고쳐서 통과 → 화해 쪽지(3초)·도장·컨페티·축하(1.8초 뒤)
    await page.getByRole('button', { name: /힌트 받기/ }).click();
    await expect(page.getByText('힌트 1/3', { exact: true })).toBeVisible();
    await runCode(page, 'print(undefined_var)');
    await expect(outputPanel(page).getByTestId('bugbug-aside')).toBeVisible();
    await runCode(page, questA.solution);
    await expect(outputPanel(page)).toHaveAttribute('data-verdict', 'pass');
    await expect(outputPanel(page).getByTestId('bugbug-makeup')).toBeVisible();
    const reward = page.locator('[data-testid="quest-reward"]:visible');
    // 축하 오버레이(완료 뒤 1.8초)가 뜨기 전에 떠난다
    await reward.getByRole('link', { name: '다음 퀘스트' }).click();
    await expect(page).toHaveURL(new RegExp(`/quest/${questB.id}$`));
    const soundsBefore = (await sfx()).length;

    await expectFreshQuest(page, questB.starter);
    // 물어보기 배지는 B의 소개 하나만
    await expect(page.getByTestId('ask-unread')).toHaveText(/^1/);

    // A가 예약한 일(축하·화해 쪽지·생각 박자)이 B에서 터지지 않는다
    await page.waitForTimeout(PAST_TIMERS_MS);
    await expectFreshQuest(page, questB.starter);
    // B에서 난 소리는 B 대사창 블립뿐 (A의 별·코인·축하·화해 소리 없음)
    expect(
      (await sfx()).slice(soundsBefore).filter((id) => id !== 'blip'),
    ).toEqual([]);

    // 실행기는 멈춘 채로 남지 않고 B를 바로 실행·채점한다
    await expect(runButton(page)).toHaveText(/코드 돌려보기/);
    await runCode(page, questB.solution);
    await expect(outputPanel(page)).toHaveAttribute('data-verdict', 'pass');
  });

  test('헤더 점·뒤로/앞으로: 오가도 각 퀘스트는 자기 저장 코드로, 결과·버그버그는 비운 채', async ({
    page,
    e2eUser,
  }) => {
    test.setTimeout(120_000);
    await completeQuests(e2eUser.id, [questA]);
    await page.goto(`/quest/${questB.id}`);
    await waitForRunner(page);

    // B: 코드를 고쳐 자동 저장되게 하고, 오류를 내 둔다
    const saved = page.waitForResponse(
      (res) =>
        res.url().includes('/rest/v1/user_progress') &&
        res.request().method() === 'POST',
    );
    await runCode(page, 'print(b_memo)');
    expect((await saved).ok()).toBe(true);
    await expect(outputPanel(page).getByTestId('bugbug-aside')).toBeVisible();

    // 헤더 1번 점으로 A(복습): B의 코드·오류가 따라오지 않음
    await dots(page).first().click();
    await expect(page).toHaveURL(new RegExp(`/quest/${questA.id}$`));
    await expect(editor(page)).toContainText(questA.solution.split('\n')[0]);
    await expect(editor(page)).not.toContainText('b_memo');
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'empty');
    await expect(page.getByTestId('bugbug-aside')).toHaveCount(0);
    await expect(page.getByTestId('quest-dialogue')).toContainText(
      '예전에 통과한 퀘스트예요',
    );
    await runCode(page, 'print("A")');
    await expect(outputPanel(page)).toHaveAttribute('data-verdict', 'diff');

    // 뒤로: B는 저장한 코드 그대로, A의 결과는 없음
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/quest/${questB.id}$`));
    await expect(editor(page)).toContainText('print(b_memo)');
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'empty');
    await expect(page.getByTestId('bugbug-aside')).toHaveCount(0);
    await expect(page.getByTestId('quest-dialogue')).toContainText(IDLE_LINE);

    // 앞으로: A도 처음 상태
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`/quest/${questA.id}$`));
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'empty');
    await expect(page.getByTestId('quest-dialogue')).toContainText(
      '예전에 통과한 퀘스트예요',
    );
    await waitForRunner(page);
  });

  test('모바일: 결과 쪽·코드 키보드를 쓰던 퀘스트를 떠나면 새 퀘스트는 ①이야기 쪽에서', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(`/quest/${questA.id}`);
    await page.getByRole('tab', { name: /공책/ }).click();
    await waitForRunner(page);
    await expect(page.getByTestId('code-keyboard')).toBeVisible();
    await runCode(page, 'print(undefined_var)');
    await expect(page.getByRole('tab', { name: /결과/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await dots(page).nth(1).click();
    await expect(page).toHaveURL(new RegExp(`/quest/${questB.id}$`));
    await expect(page.getByRole('tab', { name: /이야기/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByTestId('quest-dialogue')).toBeVisible();
    await page.getByRole('tab', { name: /공책/ }).click();
    await expect(editor(page)).toHaveText(questB.starter.replace(/\n/g, ''));
    await expect(page.getByTestId('code-keyboard')).not.toHaveAttribute(
      'data-docked',
    );
    await page.getByRole('tab', { name: /결과/ }).click();
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'empty');
    await expect(page.getByTestId('bugbug-aside')).toHaveCount(0);
  });

  test('프로젝트 "다음 단계" 박자 중에 떠나면 박자가 다른 퀘스트에서 넘어가지 않는다', async ({
    page,
    e2eUser,
  }) => {
    const project = projectQuest();
    const codeQuests = stages().flatMap((s) => s.quests);
    const other = codeQuests[codeQuests.length - 1];
    await completeQuests(e2eUser.id, codeQuests);
    await page.goto(`/quest/${project.id}`);
    await waitForRunner(page);

    const strip = page.getByTestId('step-strip').filter({ visible: true });
    await runCode(page, project.steps[0].solution);
    await expect(strip).toHaveAttribute('data-beat', 'pass');

    // 박자(2.2초) 중 다른 퀘스트로 소프트 이동 (헤더 점이 없는 한 퀘스트 스테이지라 앱 라우터로)
    await page.evaluate((href) => {
      (
        window as unknown as { next: { router: { push(h: string): void } } }
      ).next.router.push(href);
    }, `/quest/${other.id}`);
    await expect(page).toHaveURL(new RegExp(`/quest/${other.id}$`));
    await page.waitForTimeout(PAST_TIMERS_MS);
    await expect(page).toHaveURL(new RegExp(`/quest/${other.id}$`));
    await expect(page.getByTestId('step-strip')).toHaveCount(0);
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'empty');
    await expect(page.getByTestId('celebration-overlay')).toHaveCount(0);
    await expect(editor(page)).toContainText(other.solution.split('\n')[0]);
    await waitForRunner(page);

    // 돌아가면 박자 없이 1단계 그대로 (넘김은 떠날 때 취소됨)
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/quest/${project.id}$`));
    await expect(strip).toHaveAttribute('data-step', '1');
    await expect(strip).not.toHaveAttribute('data-beat', 'pass');
  });
});
