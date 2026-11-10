// 프로젝트 퀘스트 (P6-12): 공책 쪽 단계 띠·해 볼 일 단계·"다음 단계" 박자(건너뛰기·자동)·앞 단계 코드 이어 쓰기·
// 마지막 단계 → 성공 장면 → 프로젝트 완성 카드. 앞 스테이지는 서버 완료 RPC 로 끝내 둔다

import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { completeQuests } from './support/admin';
import { projectQuest, stages } from './support/content';
import { outputPanel, runCode, waitForRunner } from './support/quest';

const project = projectQuest();

const strip = (page: Page) =>
  page.getByTestId('step-strip').filter({ visible: true });

test.describe('프로젝트 퀘스트', () => {
  test.beforeEach(async ({ e2eUser }) => {
    await completeQuests(
      e2eUser.id,
      stages().flatMap((s) => s.quests),
    );
  });

  test('단계마다 띠·해 볼 일이 따라가고, 마지막 단계는 성공 장면 뒤 프로젝트 완성 카드', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const total = project.steps.length;
    await page.goto(`/quest/${project.id}`);
    await waitForRunner(page);

    // 처음: 단계 1/N, 첫 칸이 지금, 해 볼 일 첫 단계가 지금
    await expect(strip(page)).toHaveAttribute('data-step', '1');
    await expect(strip(page)).toContainText(`단계 1/${total}`);
    await expect(strip(page)).toContainText(project.steps[0].goal);
    await expect(strip(page).locator('[aria-current="step"]')).toHaveCount(1);
    const checks = page.locator('.qs-check');
    await expect(checks).toHaveCount(total);
    await expect(checks.nth(0)).toHaveAttribute('data-current');

    // 1단계 통과 → "다음 단계" 박자: 통과 알림 + 다음 목표 + 해 볼 일 체크 → "다음 단계로"로 바로 넘어감
    await runCode(page, project.steps[0].solution);
    await expect(strip(page)).toHaveAttribute('data-beat', 'pass');
    await expect(strip(page)).toContainText('1단계 통과!');
    await expect(strip(page)).toContainText(project.steps[1].goal);
    await expect(checks.nth(0)).toHaveAttribute('data-done');
    await expect(checks.nth(1)).toHaveAttribute('data-current');
    await strip(page).getByTestId('step-skip').click();
    await expect(strip(page)).not.toHaveAttribute('data-beat', 'pass');
    await expect(strip(page)).toContainText(`단계 2/${total}`);
    // 앞 단계 코드가 공책에 그대로, 결과 쪽지는 비워짐
    await expect(page.locator('.cm-editor .cm-content')).toContainText(
      'random.randint',
    );
    await expect(outputPanel(page)).toHaveAttribute('data-state', 'empty');

    // 2단계는 건너뛰지 않으면 박자 뒤 저절로 넘어감
    await runCode(page, project.steps[1].solution);
    await expect(strip(page)).toHaveAttribute('data-beat', 'pass');
    await expect(strip(page)).toHaveAttribute('data-step', '3');
    await expect(strip(page)).not.toHaveAttribute('data-beat', 'pass', {
      timeout: 10_000,
    });
    await expect(strip(page)).toContainText(`단계 3/${total}`);

    for (let i = 2; i < total - 1; i++) {
      await runCode(page, project.steps[i].solution);
      await strip(page).getByTestId('step-skip').click();
      await expect(strip(page)).toContainText(`단계 ${i + 2}/${total}`);
    }

    // 마지막 단계: 완료 요청 한 번 → 도장 + 보상 띠(코드 퀘스트와 같은 성공 장면) → 프로젝트 완성 카드
    const completion = page.waitForResponse((res) =>
      res.url().endsWith('/api/quest/complete'),
    );
    await runCode(page, project.steps[total - 1].solution);
    expect((await completion).ok()).toBe(true);
    await expect(strip(page)).toContainText(`${total}단계 모두 완성!`);
    await expect(strip(page).getByTestId('step-skip')).toHaveCount(0);
    await expect(
      page.locator('[data-testid="quest-reward"]:visible'),
    ).toBeVisible();
    await expect(checks.filter({ has: page.locator('svg') })).toHaveCount(
      total,
    );

    const overlay = page.getByTestId('celebration-overlay');
    await expect(overlay).toBeVisible({ timeout: 10_000 });
    const card = page.getByTestId('celebration-step-project_complete');
    await expect(async () => {
      if (!(await card.isVisible())) await page.keyboard.press('Enter');
      await expect(card).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 20_000 });
  });

  test('모바일: 실행하면 결과 쪽에서 박자를 보고, 다음 단계는 공책 쪽으로 돌아온다', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(`/quest/${project.id}`);
    await page.getByRole('tab', { name: /공책/ }).click();
    await waitForRunner(page);
    await expect(strip(page)).toContainText(`단계 1/${project.steps.length}`);

    await runCode(page, project.steps[0].solution);
    await expect(page.getByRole('tab', { name: /결과/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // 결과 쪽 맨 위에도 단계 띠 (박자·건너뛰기)
    await expect(strip(page)).toContainText('1단계 통과!');
    await strip(page).getByTestId('step-skip').click();
    await expect(page.getByRole('tab', { name: /공책/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(strip(page)).toContainText(project.steps[1].goal);
  });
});
