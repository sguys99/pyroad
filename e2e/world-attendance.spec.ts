// 출석 도장 (P8-08, §3 F5, §12-Q62): 월드맵 맨 위 출석 카드 → "출석 도장 꾹!" → 서버가 KST 오늘 한 번(원장 attendance/<날짜>)
// 칸 코인(5·5·10·10·15·20·30) → HUD 잔액. 다시 찍기는 0, 다음 방문에는 카드 없이 메뉴 시트 달력에서 봄. 320px 에서 7칸 한 줄

import { test, expect } from './support/test';
import type { Locator } from '@playwright/test';
import { adminClient, coinBalance, hasCoinKey } from './support/admin';

const COINS = [5, 5, 10, 10, 15, 20, 30];

async function attendance(userId: string) {
  const { data, error } = await adminClient().rpc('world_daily_status', {
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  return (
    data as {
      attendance: { today: string; stamped_today: boolean; day_n: number };
    }
  ).attendance;
}

/** 찍은 칸의 "출석" 도장이 위 "n일"·아래 코인 글자와 겹치지 않고 글자가 도장 테두리 안 (B63) */
async function stampOverlaps(calendar: Locator) {
  return calendar.locator('.at-cell[data-state="done"]').evaluateAll((cells) =>
    cells.flatMap((cell, i) => {
      const box = (sel: string) =>
        cell.querySelector(sel)!.getBoundingClientRect();
      const hit = (a: DOMRect, b: DOMRect) =>
        a.left < b.right &&
        b.left < a.right &&
        a.top < b.bottom &&
        b.top < a.bottom;
      const stamp = cell.querySelector<HTMLElement>('.at-stamp')!;
      const text = document.createRange();
      text.selectNodeContents(stamp);
      const s = stamp.getBoundingClientRect();
      const bad: string[] = [];
      if (hit(s, box('.at-n'))) bad.push(`${i + 1}: 도장↔n일`);
      if (hit(s, box('.at-coins'))) bad.push(`${i + 1}: 도장↔코인`);
      // 7일째 찍은 칸의 열린 상자 표시는 "n일" 글자에 닿지 않음 (§12-Q66 ⑤)
      const mark = cell.querySelector('.at-chest-mark');
      if (mark && hit(mark.getBoundingClientRect(), box('.at-n')))
        bad.push(`${i + 1}: 상자 표시↔n일`);
      // 도장 테두리 2px 안쪽 (기울기 전 폭)
      if (text.getBoundingClientRect().width > stamp.offsetWidth - 4)
        bad.push(`${i + 1}: 글자가 도장보다 넓음`);
      return bad;
    }),
  );
}

test('320px: 출석 카드 → 도장 → 칸 코인·HUD 잔액, 다시 찍으면 0, 다음 방문은 메뉴 달력', async ({
  page,
  e2eUser,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/world');
  const before = await attendance(e2eUser.id);
  // 같은 날 다시 돌린 실행이면 이미 찍혀 있음 (원장은 리셋으로 지워지지 않음)
  const already = await hasCoinKey(e2eUser.id, 'attendance', before.today);
  expect(already).toBe(before.stamped_today);
  const card = page.getByTestId('attendance-card');

  if (!already) {
    await expect(card).toBeVisible();
    await expect(
      card.getByTestId(`attendance-cell-${before.day_n}`),
    ).toHaveAttribute('data-state', 'next');
    // 7칸이 한 줄, 가로 넘침 없음
    const tops = await card
      .locator('.at-cell')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
    expect(new Set(tops).size).toBe(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);

    const coins0 = await coinBalance(e2eUser.id);
    const res = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/attendance/stamp') &&
        r.request().method() === 'POST',
    );
    await card.getByTestId('attendance-stamp').click();
    const body = await (await res).json();
    expect(body).toMatchObject({
      already_stamped: false,
      day_n: before.day_n,
      coins_earned: COINS[before.day_n - 1],
    });
    await expect(card.getByRole('heading')).toContainText(
      `${before.day_n}일째 출석 완료!`,
    );
    await expect(
      card.getByTestId(`attendance-cell-${before.day_n}`),
    ).toHaveAttribute('data-state', 'done');
    if (before.day_n === 7 || body.new_achievements?.length) {
      // 7일째 상자: 도장 뒤 상자 카드(방패), 닫으면 새로 고침. 출석 업적(P8-09, 도장 7개 등)도 지도 위 업적 카드
      const overlay = page.getByTestId('celebration-overlay');
      await expect(
        overlay.getByTestId(
          before.day_n === 7
            ? 'celebration-step-chest'
            : 'celebration-step-badges',
        ),
      ).toBeVisible();
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await expect(overlay).toBeHidden();
    }
    expect(await coinBalance(e2eUser.id)).toBe(coins0 + body.coins_earned);
    await expect(page.getByTestId('hud-coin')).toContainText(
      `코인 ${(coins0 + body.coins_earned).toLocaleString('ko-KR')}개`,
    );
  }

  // 다시 찍기: 200 + already_stamped, 코인 그대로
  const balance = await coinBalance(e2eUser.id);
  const again = await page.request.post('/api/attendance/stamp');
  expect(again.status()).toBe(200);
  expect((await again.json()).already_stamped).toBe(true);
  expect(await coinBalance(e2eUser.id)).toBe(balance);

  // 다음 방문: 카드 없음, 메뉴 시트 맨 위 달력에 오늘 칸
  await page.reload();
  await expect(page.getByTestId('world-hud')).toBeVisible();
  await expect(card).toHaveCount(0);
  await page.getByTestId('hud-menu').click();
  const menu = page.getByTestId('attendance-menu');
  await expect(menu).toContainText('일째 출석했어요');
  const after = await attendance(e2eUser.id);
  await expect(
    menu.getByTestId(`attendance-cell-${after.day_n}`),
  ).toHaveAttribute('data-state', 'done');
  // 320px 메뉴 달력: 찍은 칸 도장이 칸 글자를 가리지 않음 (B63)
  expect(await stampOverlaps(menu)).toEqual([]);
});
