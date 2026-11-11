// 스테이지 보물상자 (P8-06, §3 F11): 별 합계가 목표에 닿으면 시트에 "열기" + 노드에 작은 상자 → 열면 서버가 별을 다시 세어
// 30코인 한 번(원장 chest/<stage_id>) → 시트가 닫히고 지도 위에 상자 축하 카드 → HUD 잔액·시트는 "열었음"

import { test, expect } from './support/test';
import { coinBalance, completeQuests, hasCoinKey } from './support/admin';
import { stage } from './support/content';

const s1 = stage(1);
// 목표 = ceil(코드 퀘스트 수 × 3 × 0.7) (src/lib/world/chest.ts chestGoal). 힌트 없이 끝낸 퀘스트는 ⭐3
const goal = Math.floor((s1.quests.length * 21 + 9) / 10);
const need = Math.ceil(goal / 3);

test('목표 미달은 모으는 중 → 채우면 노드 상자·열기 → 축하 카드 + 코인 30, 다시 열 수 없음', async ({
  page,
  e2eUser,
}) => {
  // 리셋은 원장을 지우지 않아(P8-03) 재시도라면 이미 열린 상자 → 열린 모습만 확인
  const already = await hasCoinKey(e2eUser.id, 'chest', s1.id);
  const solved = s1.quests.map((q) => ({ id: q.id, solution: q.solution }));
  await completeQuests(e2eUser.id, solved.slice(0, need - 1));

  const sheet = page.getByTestId('stage-sheet');
  const chest = sheet.getByTestId('stage-chest');
  if (!already) {
    await page.goto(`/world?stage=${s1.id}`);
    await expect(chest).toHaveAttribute('data-state', 'locked');
    await expect(chest).toContainText(`${(need - 1) * 3}/${goal}`);
    await expect(chest).toContainText('코인 30'); // 내용 공개형
    await expect(sheet.getByTestId('stage-chest-open')).toHaveCount(0);
  }

  await completeQuests(e2eUser.id, solved.slice(need - 1, need));
  await page.goto('/world');
  const node = page.locator(`[data-stage-id="${s1.id}"]`);
  await expect(node.locator('.wn-chest')).toHaveCount(already ? 0 : 1);

  if (!already) {
    await expect(node.getByRole('button')).toHaveAccessibleName(
      /보물상자를 열 수 있어요/,
    );
    await node.getByRole('button').click();
    await expect(chest).toHaveAttribute('data-state', 'ready');
    const before = await coinBalance(e2eUser.id);
    const res = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/world/chest') && r.request().method() === 'POST',
    );
    await sheet.getByTestId('stage-chest-open').click();
    expect((await res).status()).toBe(200);

    const overlay = page.getByTestId('celebration-overlay');
    await expect(overlay.getByTestId('celebration-step-chest')).toBeVisible();
    await expect(
      page.getByRole('dialog', { name: '보물상자가 열렸어요!' }),
    ).toBeVisible();
    await expect(sheet).toBeHidden();
    await overlay.getByTestId('celebration-cta').click();
    await expect(overlay).toBeHidden();
    expect(await coinBalance(e2eUser.id)).toBe(before + 30);
    await expect(page.getByTestId('hud-coin')).toContainText(
      `코인 ${(before + 30).toLocaleString('ko-KR')}개`,
    );
    await expect(node.locator('.wn-chest')).toHaveCount(0);
  }

  await page.goto(`/world?stage=${s1.id}`);
  await expect(chest).toHaveAttribute('data-state', 'opened');
  await expect(sheet.getByTestId('stage-chest-open')).toHaveCount(0);
});
