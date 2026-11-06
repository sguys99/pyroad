// 사운드 설정 (P2-14). 설정 화면에서 효과음을 끄면 저장되어 새로고침 뒤에도 남는지,
// 움직임·사운드를 연달아 바꿔도 users.settings 에 둘 다 남는지(원자적 갱신 00020), HUD 음소거 토글이 같은 값을 쓰는지

import { test, expect } from './support/test';
import { adminClient } from './support/admin';

const DEFAULT_SOUND = {
  version: 1,
  muted: false,
  master: 0.8,
  sfx: { enabled: true, volume: 0.7 },
  bgm: { enabled: false, volume: 0.4 },
  voice: { enabled: true, volume: 0.9 },
  updatedAt: 0,
};

async function readSettings(userId: string) {
  const { data, error } = await adminClient()
    .from('users')
    .select('settings')
    .eq('id', userId)
    .single();
  if (error) throw new Error(`settings 읽기 실패: ${error.message}`);
  return (data?.settings ?? {}) as {
    motion?: { tier: string; reduced: string };
    sound?: typeof DEFAULT_SOUND;
  };
}

/** 다른 스펙에 영향이 없게 motion·sound 를 기본값으로 */
async function resetSettings(userId: string) {
  const { error } = await adminClient().rpc('patch_user_settings', {
    p_user_id: userId,
    p_patch: {
      motion: { tier: 'auto', reduced: 'system' },
      sound: DEFAULT_SOUND,
    },
  });
  if (error) throw new Error(`settings 되돌리기 실패: ${error.message}`);
}

test.describe('사운드 설정 (P2-14)', () => {
  test.beforeEach(async ({ e2eUser, page }) => {
    await resetSettings(e2eUser.id);
    // 기기 사본도 비움 (서버 값부터 시작)
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('e2e-sound-cleared')) {
        localStorage.removeItem('pyroad.sound.v1');
        sessionStorage.setItem('e2e-sound-cleared', '1');
      }
    });
  });
  test.afterEach(async ({ e2eUser }) => {
    await resetSettings(e2eUser.id);
  });

  test('효과음 끄기 → 저장, 새로고침 뒤에도 꺼짐 (기본: 효과음 켜짐·배경음악 꺼짐)', async ({
    page,
    e2eUser,
  }) => {
    await page.goto('/settings');
    const section = page.getByTestId('sound-settings');
    const sfx = section.getByTestId('sound-sfx-switch');
    await expect(sfx).toHaveAttribute('aria-checked', 'true');
    await expect(section.getByTestId('sound-bgm-switch')).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await expect(section.getByTestId('sound-voice-switch')).toBeDisabled();

    const saved = page.waitForResponse(
      (res) =>
        res.url().endsWith('/api/settings') &&
        res.request().method() === 'PATCH',
    );
    await sfx.click();
    await expect(sfx).toHaveAttribute('aria-checked', 'false');
    expect((await saved).status()).toBe(200);
    await expect(section.getByTestId('sound-save-status')).toHaveText(
      '저장했어요!',
    );
    expect((await readSettings(e2eUser.id)).sound?.sfx.enabled).toBe(false);

    await page.reload();
    await expect(
      page.getByTestId('sound-settings').getByTestId('sound-sfx-switch'),
    ).toHaveAttribute('aria-checked', 'false');
  });

  test('움직임과 사운드를 연달아 바꿔도 둘 다 서버에 남음 (원자적 갱신)', async ({
    page,
    e2eUser,
  }) => {
    await page.goto('/settings');
    const motion = page.getByTestId('motion-settings');
    const sound = page.getByTestId('sound-settings');
    await expect(sound).toBeVisible();

    const patches: Promise<unknown>[] = [];
    page.on('response', (res) => {
      if (
        res.url().endsWith('/api/settings') &&
        res.request().method() === 'PATCH'
      )
        patches.push(res.finished());
    });
    // 거의 동시에: 움직임 "가볍게" → 배경음악 켜기
    await motion.locator('label', { hasText: '가볍게' }).click();
    await sound.getByTestId('sound-bgm-switch').click();
    await expect(sound.getByTestId('sound-save-status')).toHaveText(
      '저장했어요!',
    );
    await expect
      .poll(async () => {
        const s = await readSettings(e2eUser.id);
        return { tier: s.motion?.tier, bgm: s.sound?.bgm.enabled };
      })
      .toEqual({ tier: 'lite', bgm: true });
    expect(patches.length).toBeGreaterThanOrEqual(2);
  });

  test('HUD 음소거 토글: 상태가 아이콘·이름으로 보이고 설정 화면과 같은 값', async ({
    page,
    e2eUser,
  }) => {
    await page.goto('/world');
    const toggle = page.getByTestId('sound-toggle');
    await expect(toggle).toHaveAccessibleName('소리 끄기');
    // 행간 1.7(17px → 28.9px) 때문에 위치가 소수 px이면 상자 크기가 47.999…로 잡힌다 → 반올림해 비교 (P2-10)
    const box = await toggle.boundingBox();
    expect(Math.round(box?.width ?? 0)).toBeGreaterThanOrEqual(48);
    expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(48);
    await toggle.click();
    await expect(toggle).toHaveAccessibleName('소리 켜기');
    await expect
      .poll(async () => (await readSettings(e2eUser.id)).sound?.muted)
      .toBe(true);

    await page.goto('/settings');
    await expect(page.getByTestId('sound-mute-switch')).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
