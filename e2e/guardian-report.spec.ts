// 보호자 주간 리포트 (P9-15): 설정에서 비밀 링크 만들기 → 로그인 없이 열람(요일별 막대·지난 주·캐시 금지·noindex·개인정보 없음)
// → 새 링크 만들기 뒤 옛 링크 404 → 끄기 뒤 새 링크도 404.

import { test, expect, watchCspViolations } from './support/test';
import { adminClient } from './support/admin';

const NICK = '리포트별명';

test('링크 만들기 → 비로그인 열람·요일별 → 다시 만들기 옛 링크 404 → 끄기', async ({
  page,
  e2eUser,
  browser,
  baseURL,
}, testInfo) => {
  const db = adminClient();
  const { data: before } = await db
    .from('users')
    .select('nickname')
    .eq('id', e2eUser.id)
    .single();
  await db.from('users').update({ nickname: NICK }).eq('id', e2eUser.id);
  // 오늘 끝낸 코드 퀘스트 1개 (요일 막대에 보이게)
  const { data: quest } = await db
    .from('quests')
    .select('id')
    .eq('quest_type', 'code')
    .order('id')
    .limit(1)
    .single();
  await db.from('user_progress').upsert(
    {
      user_id: e2eUser.id,
      quest_id: quest!.id,
      status: 'completed',
      completed_at: new Date().toISOString(),
      earned_xp: 30,
      best_stars: 3,
    },
    { onConflict: 'user_id,quest_id' },
  );
  const anon = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  try {
    // 설정 → 만들기
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/settings');
    const section = page.getByTestId('guardian-report-section');
    await expect(section).toBeVisible();
    await section.getByTestId('guardian-report-create').click();
    const linkInput = section.getByTestId('guardian-report-link');
    await expect(linkInput).toHaveValue(/\/guardian\/[A-Za-z0-9_-]{22}$/);
    await expect(section).toHaveAttribute('data-active', 'true');
    await section.screenshot({ path: testInfo.outputPath('settings-360.png') });
    const link1 = new URL(await linkInput.inputValue()).pathname;

    // 비로그인 열람
    const res = await anon.request.get(link1);
    expect(res.status()).toBe(200);
    const cache = res.headers()['cache-control'] ?? '';
    expect(cache).toContain('no-store');
    expect(cache).toContain('private');
    expect(res.headers()['x-robots-tag']).toBe('noindex, nofollow');
    expect(res.headers()['referrer-policy']).toBe('no-referrer');
    const html = await res.text();
    expect(html).toContain('noindex');
    expect(html).not.toContain(e2eUser.id);
    expect(html).not.toContain(e2eUser.email);

    const visitor = await anon.newPage();
    const csp = await watchCspViolations(visitor);
    for (const width of [360, 1280]) {
      await visitor.setViewportSize({ width, height: 900 });
      await visitor.goto(link1);
      await expect(visitor.getByRole('heading', { level: 1 })).toHaveText(
        `${NICK} 학생의 한 주`,
      );
      await expect(
        visitor.getByTestId('guardian-days').locator('li'),
      ).toHaveCount(7);
      await expect(
        visitor.locator('[data-testid="guardian-days"] li[data-quests="1"]'),
      ).toHaveCount(1);
      await expect(visitor.getByTestId('guardian-summary')).toContainText(
        '새 퀘스트 1개',
      );
      expect(
        await visitor.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await visitor.screenshot({
        path: testInfo.outputPath(`report-${width}.png`),
        fullPage: true,
      });
    }
    await visitor.getByTestId('guardian-week-other').click();
    await expect(visitor).toHaveURL(/\?week=last$/);
    await expect(visitor.getByTestId('guardian-week-current')).toHaveText(
      '지난 주',
    );
    expect(csp).toEqual([]);

    // 새 링크 만들기 → 옛 링크 404
    await section.getByTestId('guardian-report-recreate').click();
    await page.getByTestId('guardian-report-confirm').click();
    await expect(linkInput).not.toHaveValue(new RegExp(`${link1}$`));
    const link2 = new URL(await linkInput.inputValue()).pathname;
    expect(link2).not.toBe(link1);
    expect((await anon.request.get(link1)).status()).toBe(404);
    expect((await anon.request.get(link2)).status()).toBe(200);
    await visitor.goto(link1);
    await expect(visitor.getByRole('heading', { level: 1 })).toHaveText(
      '이 리포트 링크는 열 수 없습니다',
    );
    await expect(visitor.locator('body')).not.toContainText(NICK);

    // 끄기 → 새 링크도 404, 다시 꺼진 상태
    await section.getByTestId('guardian-report-off').click();
    await page.getByTestId('guardian-report-confirm').click();
    await expect(section).toContainText('링크를 껐어요');
    await expect(section.getByTestId('guardian-report-create')).toBeVisible();
    expect((await anon.request.get(link2)).status()).toBe(404);
    // 틀린 모양도 같은 404
    expect((await anon.request.get('/guardian/short')).status()).toBe(404);
  } finally {
    await anon.close();
    await db.rpc('guardian_report_link', {
      p_user_id: e2eUser.id,
      p_action: 'off',
    });
    await db
      .from('users')
      .update({ nickname: before?.nickname ?? null })
      .eq('id', e2eUser.id);
  }
});
