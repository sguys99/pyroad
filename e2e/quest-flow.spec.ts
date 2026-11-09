// 퀘스트 전체 흐름 (로그인). 기존 시나리오(월드맵 → 퀘스트 → 실행 → 정답 → XP, 잠긴 스테이지)를
// P1-09(엔진·testid)·P1-10(축하 시퀀서)·B22(Link 이동·Worker 유지)·B38(잠긴 스테이지 URL) 구조로 (P1-21)

import { test, expect } from './support/test';
import { completeQuests } from './support/admin';
import { stage } from './support/content';
import {
  advanceCelebration,
  completedNotice,
  openStageSheet,
  outputPanel,
  questHeader,
  runButton,
  runCode,
  stageButton,
  waitForRunner,
} from './support/quest';

const stage1 = stage(1);
const stage2 = stage(2);
const [quest1, quest2] = stage1.quests;
const lastQuest = stage1.quests[stage1.quests.length - 1];

test.describe('퀘스트 전체 플로우', () => {
  test('월드맵 → 퀘스트 진입 → 코드 실행 → 검증 성공 → XP 획득 → 다음 퀘스트(Worker 유지)', async ({
    page,
  }) => {
    const pyodideWorkers: string[] = [];
    page.on('worker', (w) => {
      if (w.url().includes('pyodide-worker')) pyodideWorkers.push(w.url());
    });

    // 1. 월드맵: 첫 스테이지는 열려 있다
    await page.goto('/world');
    await expect(
      page.getByRole('heading', { name: '모험 지도' }),
    ).toBeVisible();
    const first = stageButton(page, stage1.title);
    await expect(first).toBeEnabled();

    // 2. 스테이지 1 클릭 → 차례 시트(P5-06) → 첫 퀘스트
    const sheet = await openStageSheet(page, stage1.title);
    await expect(sheet.getByTestId('stage-sheet-start')).toHaveText(
      /1번 퀘스트 시작하기/,
    );
    await sheet.getByTestId('stage-sheet-start').click();
    await expect(page).toHaveURL(new RegExp(`/quest/${quest1.id}$`));
    await expect(questHeader(page)).toContainText(quest1.title);

    // 3. 이야기·미션과 튜터 소개
    await expect(page.getByRole('heading', { name: '이야기' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '미션' })).toBeVisible();
    await expect(page.getByText('파이뱀 선생님').first()).toBeVisible();

    // 4~7. 에디터 + 실행기 준비 → 정답 실행
    await expect(page.locator('.cm-editor')).toBeVisible();
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'empty');
    await runCode(page, quest1.solution);

    // 8~9. 결과 패널: 출력 + 정답
    const output = outputPanel(page);
    await expect(output).toHaveAttribute('data-state', 'success');
    await expect(output).toContainText('안녕하세요');
    await expect(output).toContainText('정답이에요!');

    // 축하 시퀀서: 첫 퀘스트 뱃지 카드 → CTA 로 닫힘
    await expect(page.getByTestId('celebration-overlay')).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();
    await advanceCelebration(page, 'badges');
    await expect(page.getByTestId('celebration-overlay')).toBeHidden();

    // XP 반영 (상태바: 받은 XP 만큼 오르고 +N 표시. 힌트 0회 보너스 등 계산은 단위 테스트 몫)
    await expect(page.getByText(/^\s*[1-9]\d* XP/)).toBeVisible();
    await expect(page.getByText(/^\+[1-9]\d*$/)).toBeVisible();

    // 다음 퀘스트로: <Link> 소프트 이동 (전체 새로고침 없음) + Pyodide Worker 그대로 (B22)
    await page.evaluate(() => {
      (window as unknown as { __e2eSoftNav: boolean }).__e2eSoftNav = true;
    });
    await page.getByRole('link', { name: '다음 퀘스트로 →' }).first().click();
    await expect(page).toHaveURL(new RegExp(`/quest/${quest2.id}$`));
    await expect(questHeader(page)).toContainText(quest2.title);
    expect(
      await page.evaluate(
        () => (window as unknown as { __e2eSoftNav?: boolean }).__e2eSoftNav,
      ),
      '전체 새로고침 없이 이동',
    ).toBe(true);
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'empty');
    await runCode(page, quest2.solution);
    await expect(outputPanel(page)).toContainText('정답이에요!');
    expect(
      pyodideWorkers,
      'Pyodide Worker 는 퀘스트를 옮겨도 하나',
    ).toHaveLength(1);
  });

  test('스테이지 마지막 퀘스트를 풀면 축하가 차례로 나오고 "모두 닫기"로 한 번에 닫힌다', async ({
    page,
    e2eUser,
  }) => {
    // 앞 퀘스트는 서버 완료 RPC 로 끝내 둔다
    await completeQuests(e2eUser.id, stage1.quests.slice(0, -1));

    await page.goto(`/quest/${lastQuest.id}`);
    await runCode(page, lastQuest.solution);
    await expect(outputPanel(page)).toContainText('정답이에요!');

    // 스테이지 클리어가 먼저, 뒤에 레벨 업·뱃지가 이어진다 (점 표시 "축하 N개 중 1번째")
    const overlay = page.getByTestId('celebration-overlay');
    await expect(
      page.getByTestId('celebration-step-stage_clear'),
    ).toBeVisible();
    await expect(
      overlay.getByRole('list', { name: /축하 \d+개 중 1번째/ }),
    ).toBeVisible();
    await expect(page.getByTestId('celebration-cta')).toBeVisible();

    await overlay.getByRole('button', { name: '모두 닫기' }).click();
    await expect(overlay).toBeHidden();

    // 월드맵: 다음 스테이지가 열림
    await page.goto('/world');
    await expect(stageButton(page, stage2.title)).toBeEnabled();
  });

  test('잠금 스테이지 클릭 시 이동하지 않고 안내한다', async ({ page }) => {
    await page.goto('/world');
    const locked = stageButton(page, stage2.title);
    await expect(locked).toBeDisabled(); // aria-disabled: 포커스·탭은 되고 이동만 막음 (P5-04)
    await expect(locked).toHaveAccessibleName(/잠김/);
    await locked.click({ force: true });
    await expect(
      page.getByRole('status').getByText('1단계를 통과하면 열려요'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/world$/);
  });

  test('잠긴 스테이지의 퀘스트를 주소로 열면 월드맵으로 돌아가 안내한다 (B38)', async ({
    page,
  }) => {
    await page.goto(`/quest/${stage2.quests[0].id}`);
    await expect(page).toHaveURL(/\/world$/); // 안내 값(?notice=…)은 주소에서 바로 지움
    await expect(page.getByTestId('stage-locked-notice')).toBeVisible();

    // 튜터도 잠긴 퀘스트에는 답하지 않는다
    const res = await page.request.post('/api/tutor/stream', {
      data: { type: 'quest_intro', quest_id: stage2.quests[0].id },
    });
    expect(res.status()).toBe(403);
  });

  test('완료한 퀘스트는 다시 열어 복습할 수 있다 (B38)', async ({
    page,
    e2eUser,
  }) => {
    await completeQuests(e2eUser.id, [quest1]);
    await page.goto(`/quest/${quest1.id}`);
    await expect(completedNotice(page)).toBeVisible();
    await waitForRunner(page);
    await expect(runButton(page)).toBeEnabled();
  });

  for (const [label, viewport] of [
    ['넓은 화면', { width: 1280, height: 800 }],
    ['휴대폰', { width: 360, height: 740 }],
  ] as const) {
    test(`${label}: 시트에서 완료한 퀘스트를 다시 하고, 돌아오면 시트가 다시 열려 있다 (P5-06)`, async ({
      page,
      e2eUser,
    }) => {
      await page.setViewportSize(viewport);
      await completeQuests(e2eUser.id, [quest1]);
      await page.goto('/world');

      const sheet = await openStageSheet(page, stage1.title);
      await expect(sheet).toHaveAttribute('role', 'dialog');
      // 완료한 1번은 다시 하기, 2번이 지금 차례(주 버튼 이어하기), 뒤 퀘스트도 링크(건너뛰어 열기)
      const replay = sheet.getByRole('link', {
        name: new RegExp(`${quest1.title}.*다시 하기`),
      });
      await expect(replay).toBeVisible();
      await expect(sheet.getByTestId('stage-sheet-start')).toHaveText(
        /2번 퀘스트 이어하기/,
      );
      await expect(
        sheet.getByRole('link', { name: new RegExp(lastQuest.title) }),
      ).toHaveAttribute('href', `/quest/${lastQuest.id}`);

      // 다시 하기 → 복습 화면 (B38 가드는 완료 퀘스트를 막지 않음)
      await replay.click();
      await expect(page).toHaveURL(new RegExp(`/quest/${quest1.id}$`));
      await expect(completedNotice(page)).toBeVisible();

      // 뒤로 가기 → 지도 + 같은 시트
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`/world\\?stage=${stage1.id}$`));
      await expect(page.getByTestId('stage-sheet')).toBeVisible();

      // Esc 로 닫으면 주소에서 stage 를 지우고 포커스는 노드로
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('stage-sheet')).toBeHidden();
      await expect(page).toHaveURL(/\/world$/);
      await expect(stageButton(page, stage1.title)).toBeFocused();

      // 다시 열고 기기 뒤로 가기 → 시트만 닫히고 지도에 머문다
      await openStageSheet(page, stage1.title);
      await page.goBack();
      await expect(page.getByTestId('stage-sheet')).toBeHidden();
      await expect(page).toHaveURL(/\/world$/);
    });
  }
});
