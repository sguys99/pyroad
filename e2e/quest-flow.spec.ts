// 퀘스트 전체 흐름 (로그인). 기존 시나리오(월드맵 → 퀘스트 → 실행 → 정답 → XP, 잠긴 스테이지)를
// P1-09(엔진·testid)·P1-10(축하 시퀀서)·B22(Link 이동·Worker 유지)·B38(잠긴 스테이지 URL) 구조로 (P1-21)

import { test, expect } from './support/test';
import { completeQuests } from './support/admin';
import { stage } from './support/content';
import {
  advanceCelebration,
  completedNotice,
  openStageSheet,
  openTutorChat,
  outputPanel,
  questHeader,
  runButton,
  runCode,
  stageButton,
  toStageClear,
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

    // 효과음 요청 기록 (useSfx·시퀀서 → pyroad:sfx, P6-14): 소리가 그림과 같은 박자에 한 번씩 나는지
    await page.addInitScript(() => {
      const w = window as unknown as { __sfx: string[] };
      w.__sfx = [];
      window.addEventListener('pyroad:sfx', (e) =>
        w.__sfx.push((e as CustomEvent<{ id: string }>).detail.id),
      );
    });
    const sfx = async () =>
      page.evaluate(() => (window as unknown as { __sfx: string[] }).__sfx);
    const clearSfx = () =>
      page.evaluate(() => {
        (window as unknown as { __sfx: string[] }).__sfx = [];
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

    // 헤더 스테이지 진행 점(P6-02): 퀘스트마다(퀴즈 포함) 점 하나, 지금 퀘스트는 aria-current="step"
    const progress = page.getByTestId('stage-progress');
    const dots = progress.locator('.sp-dot');
    await expect(dots).toHaveCount(stage1.questCount);
    await expect(progress).toContainText(`1/${stage1.questCount}`);
    await expect(dots.first()).toHaveAttribute('aria-current', 'step');
    await expect(dots.first()).toHaveAttribute('data-state', 'todo');

    // 3. 이야기 쪽(P6-01): 제목 · 해 볼 일 체크리스트 · 파이뱀 대사창 + 튜터 소개
    await expect(
      page.getByRole('heading', { level: 1, name: quest1.title }),
    ).toBeVisible();
    const task = page.getByRole('region', { name: '해 볼 일' });
    // 해 볼 일은 콘텐츠 checklist 그대로 (P7-17)
    await expect(task.getByRole('listitem')).toHaveText(quest1.checklist);
    await expect(page.getByTestId('quest-dialogue')).toContainText('파이뱀');
    // 튜터 소개는 "파이뱀에게 물어보기"를 열면 대화에 (P6-10)
    const chat = await openTutorChat(page);
    await expect(chat.getByTestId('chat-tutor').first()).toBeVisible();

    // 4~7. 에디터 + 실행기 준비 → 정답 실행
    await expect(page.locator('.cm-editor')).toBeVisible();
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'empty');
    const output = outputPanel(page);

    // 결과 쪽지(P6-06): 돌아갔지만 글자가 다르면 "조금 달라요" + 공개 예시 출력과 줄마다 견줘 보기(P7-17)
    await runCode(page, 'print("틀린 글자")');
    await expect(output).toHaveAttribute('data-verdict', 'diff');
    await expect(output).toContainText('조금 달라요');
    await expect(output.locator('.qo-line')).toHaveText(['틀린 글자']);
    const example = output.getByTestId('output-example');
    await expect(example).toHaveAttribute('data-compare');
    await expect(example.locator('li').first()).toContainText(
      quest1.example.split('\n')[0],
    );
    await expect(example.locator('li').first()).toContainText(
      '내 글자 틀린 글자',
    );

    // 대사창 글자가 나오는 동안 블립 (2~3글자마다)
    expect(await sfx()).toContain('blip');

    // 에러: 'bug'는 결과 쪽지에 버그버그가 들어올 때 (세션이 채점 직후 따로 울리지 않음)
    await clearSfx();
    await runCode(page, 'print(undefined_var)');
    await expect(page.getByTestId('bugbug-helper').first()).toBeVisible();
    // 블립은 대사창이 새 대사를 치는 동안 섞여 들어오므로 빼고 본다
    const beats = async () => (await sfx()).filter((id) => id !== 'blip');
    await expect.poll(beats).toEqual(['run', 'bug']);

    await clearSfx();
    await runCode(page, quest1.solution);

    // 8~9. 결과 패널: 출력 + 정답 (견줘 보기는 사라짐)
    await expect(output).toHaveAttribute('data-state', 'success');
    await expect(output).toHaveAttribute('data-verdict', 'pass');
    await expect(output).toContainText('안녕하세요');
    await expect(output).toContainText('정답이에요!');
    await expect(output.getByTestId('output-compare')).toHaveCount(0);
    // 통과하면 해 볼 일이 모두 체크된다
    await expect(task.locator('li:not([data-done])')).toHaveCount(0);
    // 통과하면 지금 점이 바로 완료로 (세션 상태)
    await expect(dots.first()).toHaveAttribute('data-state', 'done');

    // 성공 장면 (P6-08): 결과 쪽지에 "통과!" 도장 + 아래 보상 띠. 별·코인은 Q52로 숨기고 XP만.
    // 장면 중에 Esc를 누르면 끝 상태(받은 XP 그대로)로 건너뛴다
    const reward = page.locator('[data-testid="quest-reward"]:visible');
    await expect(reward).toBeVisible();
    await expect(output.locator('.qx-stamp')).toHaveText('통과!');
    // 정답 'correct'는 도장이 닿는 순간 한 번 (채점 직후 세션이 또 울리지 않음)
    await expect
      .poll(async () => (await sfx()).filter((id) => id === 'correct'))
      .toEqual(['correct']);
    expect(await sfx()).not.toContain('bug');
    await expect(reward.getByTestId('reward-stars')).toHaveCount(0);
    await expect(reward.getByTestId('reward-coins')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(reward).toHaveAttribute('data-done', 'true');
    // 이야기 쪽 파이뱀: 통과 도장 대사
    await expect(page.getByTestId('quest-dialogue')).toContainText(
      '통과 도장 쾅',
    );
    // 막 통과한 직후 이야기 쪽 보상 줄은 "예전에 통과"가 아니라 방금 받았다고 (Q57)
    await expect(page.getByTestId('quest-reward-preview')).toContainText(
      '통과해서 보상을 받았어요',
    );

    // 축하 시퀀서: 첫 퀘스트 뱃지 카드 → CTA 로 닫힘
    await expect(page.getByTestId('celebration-overlay')).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();
    await advanceCelebration(page, 'badges');
    await expect(page.getByTestId('celebration-overlay')).toBeHidden();

    // XP 반영 (상태바: 받은 XP 만큼 오르고 +N 표시. 힌트 0회 보너스 등 계산은 단위 테스트 몫)
    await expect(page.getByText(/^\s*[1-9]\d* XP/)).toBeVisible();
    // 상태바의 +N (보상 띠 숫자는 글자 조각으로 나뉘어 있어 span 하나로는 걸리지 않음)
    const gained = page.locator('span', { hasText: /^\+[1-9]\d*$/ });
    await expect(gained).toBeVisible();
    // 보상 띠의 XP 카운트업은 서버가 준 XP에서 끝난다 (상태바 +N과 같음)
    await expect(reward.getByTestId('reward-xp-count')).toHaveText(
      (await gained.innerText()).slice(1),
    );

    // 다음 퀘스트로: <Link> 소프트 이동 (전체 새로고침 없음) + Pyodide Worker 그대로 (B22)
    await page.evaluate(() => {
      (window as unknown as { __e2eSoftNav: boolean }).__e2eSoftNav = true;
    });
    await reward.getByRole('link', { name: '다음 퀘스트' }).click();
    await expect(page).toHaveURL(new RegExp(`/quest/${quest2.id}$`));
    await expect(questHeader(page)).toContainText(quest2.title);
    // 다음 퀘스트: 1번 점은 끝냄(서버 진행), 지금 표시는 2번으로
    await expect(dots.first()).toHaveAttribute('data-state', 'done');
    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'step');
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

  test('스테이지 마지막 퀘스트를 풀면 축하가 차례로 나오고(스테이지 클리어가 맨 뒤) "모두 닫기"로 한 번에 닫힌다', async ({
    page,
    e2eUser,
  }) => {
    // 앞 퀘스트는 서버 완료 RPC 로 끝내 둔다
    await completeQuests(e2eUser.id, stage1.quests.slice(0, -1));

    await page.goto(`/quest/${lastQuest.id}`);
    await runCode(page, lastQuest.solution);
    await expect(outputPanel(page)).toContainText('정답이에요!');

    // 레벨 업·뱃지가 먼저, 스테이지 클리어는 맨 뒤 (P6-13, 점 표시 "축하 N개 중 1번째")
    const overlay = page.getByTestId('celebration-overlay');
    await expect(
      overlay.getByRole('list', { name: /축하 \d+개 중 1번째/ }),
    ).toBeVisible();
    await expect(page.getByTestId('celebration-step-stage_clear')).toHaveCount(
      0,
    );
    // 뒤 화면은 조용히 (덮개 뒤 리그 정지·책 펼침 CSS 애니메이션 멈춤)
    await expect(page.locator('html')).toHaveAttribute('data-celebrating', '');
    // 대화 상자: 받은 것을 한 줄로 읽어 줌
    await expect(overlay.getByTestId('celebration-live')).not.toBeEmpty();

    const stageCard = await toStageClear(page);
    await expect(overlay.getByTestId('celebration-live')).toContainText(
      '클리어',
    );
    // 축하 카드의 파이뱀은 리그 (B32 LottieCharacter 대체)
    await expect(
      stageCard.getByTestId('celebration-mascot').locator('svg'),
    ).toBeVisible();
    // 주 버튼은 지도로(해제 연출은 world-unlock 스펙), 보조 "여기 있을래요"
    await expect(stageCard.getByTestId('celebration-map-cta')).toHaveAttribute(
      'href',
      /\/world/,
    );
    await expect(stageCard.getByTestId('celebration-cta')).toHaveText(
      '여기 있을래요',
    );
    await overlay.getByRole('button', { name: /모두 닫기|닫기/ }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-celebrating');
    await expect(overlay).toBeHidden();
    // 스테이지 끝: 다음 퀘스트 대신 지도로
    const reward = page.locator('[data-testid="quest-reward"]:visible');
    await expect(reward.getByTestId('back-to-map')).toBeVisible();
    await expect(reward.getByRole('link', { name: '다음 퀘스트' })).toHaveCount(
      0,
    );

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
    await expect(page.getByTestId('quest-reward-preview')).toContainText(
      '예전에 통과한 퀘스트예요',
    );
    await waitForRunner(page);
    await expect(runButton(page)).toBeEnabled();

    // 복습 (Q57): 실행·채점·도장은 그대로, 완료 API는 부르지 않고 보상 띠 대신 "복습 완료"(XP 없음) + 다음 퀘스트
    const completeCalls: string[] = [];
    page.on('request', (req) => {
      if (req.url().endsWith('/api/quest/complete'))
        completeCalls.push(req.url());
    });
    await runCode(page, quest1.solution);
    const output = outputPanel(page);
    await expect(output).toHaveAttribute('data-verdict', 'pass');
    await expect(output.locator('.qx-stamp')).toHaveText('통과!');
    const reward = page.locator('[data-testid="quest-reward"]:visible');
    await expect(reward).toHaveAttribute('data-review', 'true');
    await expect(reward).toContainText('복습 완료');
    await expect(reward.getByTestId('reward-xp')).toHaveCount(0);
    await expect(
      reward.getByRole('link', { name: '다음 퀘스트' }),
    ).toHaveAttribute('href', `/quest/${quest2.id}`);
    await expect(page.getByTestId('quest-dialogue')).toContainText('복습 완료');
    await expect(page.getByTestId('quest-reward-preview')).toContainText(
      '복습 완료',
    );
    // 상태바에 받은 XP(+N)가 붙지 않음
    await expect(page.locator('span', { hasText: /^\+[1-9]\d*$/ })).toHaveCount(
      0,
    );
    expect(completeCalls).toEqual([]);
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
