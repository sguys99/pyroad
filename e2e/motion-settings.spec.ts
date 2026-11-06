// 움직임 설정 → 연출 단계 (P2-15). 설정 화면에서 고르면 <html data-motion data-reduced>가 바로 바뀌고,
// 서버(users.settings.motion)에 저장되어 기기 저장소가 비어 있는 새 기기에서도 첫 화면부터 적용되는지

import type { Page } from '@playwright/test';
import { test, expect } from './support/test';
import { adminClient } from './support/admin';

const htmlMotion = (page: Page) =>
  page.evaluate(() => ({
    motion: document.documentElement.dataset.motion,
    reduced: document.documentElement.dataset.reduced,
  }));

/** 다른 스펙에 영향이 없게 users.settings.motion 을 기본값으로 (sound 등 다른 키는 그대로) */
async function resetMotion(userId: string) {
  const db = adminClient();
  const { data, error } = await db
    .from('users')
    .select('settings')
    .eq('id', userId)
    .single();
  if (error) throw new Error(`settings 읽기 실패: ${error.message}`);
  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  const { error: updateError } = await db
    .from('users')
    .update({
      settings: { ...settings, motion: { tier: 'auto', reduced: 'system' } },
    })
    .eq('id', userId);
  if (updateError)
    throw new Error(`settings 되돌리기 실패: ${updateError.message}`);
}

test.describe('움직임 설정 (P2-15)', () => {
  test.afterEach(async ({ e2eUser }) => {
    await resetMotion(e2eUser.id);
  });

  test('"최소로"를 고르면 바로 data-motion=minimal, 저장되어 새 기기에서도 첫 화면부터 적용', async ({
    page,
    context,
    e2eUser,
  }) => {
    await page.goto('/settings');
    const section = page.getByTestId('motion-settings');
    await expect(section).toBeVisible();
    // 부트 스크립트가 첫 페인트 전에 붙인 속성
    expect((await htmlMotion(page)).reduced).toMatch(/^(true|false)$/);

    const saved = page.waitForResponse(
      (res) =>
        res.url().endsWith('/api/settings') &&
        res.request().method() === 'PATCH',
    );
    // 라디오는 화면 읽기용(sr-only)이고 아이가 누르는 것은 카드(label)
    await section.locator('label', { hasText: '최소로' }).click();
    await expect(section.getByRole('radio', { name: /최소로/ })).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute(
      'data-motion',
      'minimal',
    );
    expect((await saved).status()).toBe(200);
    await expect(section.getByRole('status')).toHaveText('저장했어요!');

    const { data } = await adminClient()
      .from('users')
      .select('settings')
      .eq('id', e2eUser.id)
      .single();
    expect((data?.settings as { motion: unknown }).motion).toEqual({
      tier: 'minimal',
      reduced: 'system',
    });

    // 새 기기: 기기 저장소가 비어 있어도 로그인 레이아웃의 nonce 스크립트가 서버 값을 첫 페인트 전에 적용
    const fresh = await context.newPage();
    await fresh.addInitScript(() => localStorage.clear());
    await fresh.goto('/world', { waitUntil: 'domcontentloaded' });
    expect(await htmlMotion(fresh)).toMatchObject({ motion: 'minimal' });
    await fresh.close();
  });

  test('"동작 줄이기: 켜기"면 data-reduced=true, 파이뱀은 몸이 멈추고 느린 깜빡임만', async ({
    page,
  }) => {
    await page.goto('/settings');
    const section = page.getByTestId('motion-settings');
    // CI 장비가 느리면 자동 감지가 minimal로 내려가 깜빡임까지 꺼지므로 단계를 고정한다
    await section.locator('label', { hasText: '풍성하게' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
    const reducedOptions = section.getByTestId('motion-reduced-options');
    await reducedOptions.locator('label', { hasText: '켜기' }).click();
    await expect(
      reducedOptions.getByRole('radio', { name: /켜기/ }),
    ).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-reduced', 'true');
    await expect(section.getByRole('status')).toHaveText('저장했어요!');

    // 표정이 바뀌며 미리 보기가 다시 그려지는 동안 떨어져 나간 요소를 읽지 않도록 재시도
    const preview = section.locator('.character-breathe').first();
    await expect
      .poll(() => preview.evaluate((el) => getComputedStyle(el).animationName))
      .toBe('none');
    const eye = section.locator('.char-blink-eye').first();
    await expect
      .poll(() => eye.evaluate((el) => getComputedStyle(el).animationName))
      .toBe('char-blink-eye-slow');
  });
});
