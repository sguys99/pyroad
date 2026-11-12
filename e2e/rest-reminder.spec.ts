// 휴식 알림 (P8-12): 빨리 감은 시계(테스트 페이지가 켜진 서버에서만 읽는 sessionStorage 배속)로 40분을 몇 초에 만들어
// 월드맵에서 권유 → 5분 쉬기(카운트다운) → 다 쉬었어요 → 돌아오기까지

import { test, expect } from './support/test';

/** 배속: 40분 = 8초, 자리 비움 10분 = 2초, 쉬기 5분 = 1초 */
const SPEED = 300;

test('연속 40분이면 휴식 카드가 뜨고, 5분 쉬기 뒤 다시 모험한다', async ({
  page,
}) => {
  await page.addInitScript((speed) => {
    sessionStorage.setItem('pyroad:rest:speed', String(speed));
  }, SPEED);
  await page.goto('/world');
  await expect(page.getByTestId('world-hud')).toBeVisible();

  const card = page.getByRole('dialog', { name: '40분이나 모험했어요!' });
  // 계속 만지는 아이: 자리 비움(빨리 감기로 2초)에 걸리지 않게 키를 누르며 기다린다
  await expect(async () => {
    await page.keyboard.press('Shift');
    await expect(card).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 30_000, intervals: [100] });

  await expect(card.getByRole('listitem')).toHaveCount(3);
  await expect(card.getByRole('button', { name: '5분 쉬기' })).toBeFocused();
  await card.getByRole('button', { name: '5분 쉬기' }).click();

  await expect(
    page.getByRole('dialog', { name: '쉬는 중이에요' }),
  ).toBeVisible();
  const back = page.getByRole('dialog', { name: '다 쉬었어요!' });
  await expect(back).toBeVisible({ timeout: 10_000 });
  await back.getByRole('button', { name: '다시 모험하기' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('world-hud')).toBeVisible();
});
