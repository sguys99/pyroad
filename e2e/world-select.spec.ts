// 월드 선택·월드별 지도 (P5-01, Q48·Q50): /world(진행 중 월드) · /world/[slug] · /worlds 책장,
// 잠김·준비 중 안내, 없는 월드 404, 테스트 월드(e2e/fixtures/content)로 "데이터만 더하면 두 번째 월드 지도가 나온다"

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

import { test, expect } from './support/test';
import {
  adminClient,
  completeQuests,
  installFixtureWorlds,
  removeFixtureWorlds,
} from './support/admin';
import { allQuestIds, stage } from './support/content';
import { stageButton } from './support/quest';

const stage1 = stage(1);
async function setTier(userId: string, tier: 'auto' | 'full' | 'minimal') {
  const { error } = await adminClient()
    .from('users')
    .update({
      settings: {
        motion: { tier, reduced: tier === 'auto' ? 'system' : 'off' },
      },
    })
    .eq('id', userId);
  if (error) throw new Error(`settings 쓰기 실패: ${error.message}`);
}

const book = (page: Page, slug: string) =>
  page.locator(`.wb-shelf [data-book-slug="${slug}"]`);

test.describe('월드 선택 (P5-01)', () => {
  test.beforeAll(async () => {
    await installFixtureWorlds();
  });
  test.afterAll(async () => {
    await removeFixtureWorlds();
  });

  test('지도 머리 → 월드 바꾸기 → 책장 → 월드 1 지도, 퀘스트에서 그 월드로 돌아오기', async ({
    page,
    e2eUser,
  }) => {
    // full: 책 ↔ 지도 전환(View Transition, 이름 붙인 표지·지도)이 실제로 도는 경로로 이동한다
    await setTier(e2eUser.id, 'full');
    await page.goto('/world');
    await expect(
      page.getByRole('heading', { level: 1, name: '파이썬 섬 모험 지도' }),
    ).toBeVisible();
    await expect(page.getByText('그림책 1권')).toBeVisible();

    await page.getByRole('link', { name: '월드 바꾸기' }).click();
    await expect(page).toHaveURL(/\/worlds$/);
    await expect(
      page.getByRole('heading', { level: 1, name: '어떤 책을 펼쳐 볼까요?' }),
    ).toBeVisible();

    // 월드 1: 모험 중 + 책갈피 / 월드 2·3: 준비 중 + 해제 조건 / 테스트 월드: 잠김, 해제 조건은 준비 중 월드를 건너뛴 파이썬 섬
    await expect(book(page, 'python-island')).toContainText('모험 중');
    await expect(book(page, 'python-island')).toContainText('지금 읽는 책');
    for (const slug of ['code-sea', 'maker-city']) {
      await expect(book(page, slug)).toContainText('준비 중');
      await expect(book(page, slug)).toContainText(
        '파이썬 섬을 다 모험하면 열려요',
      );
    }
    await expect(book(page, 'test-meadow')).toContainText('잠겨 있어요');
    await expect(book(page, 'test-meadow')).toContainText(
      '파이썬 섬을 다 모험하면 열려요',
    );
    // 잠긴 책은 링크가 아니다
    await expect(page.locator('a[data-book-slug="code-sea"]')).toHaveCount(0);

    await book(page, 'python-island').click();
    await expect(page).toHaveURL(/\/world\/python-island$/);
    await expect(
      page.getByRole('heading', { level: 1, name: '파이썬 섬 모험 지도' }),
    ).toBeVisible();
    await expect(stageButton(page, stage1.title)).toBeEnabled();
    // 지도 아래 다음 권 미리 보기
    await expect(
      page.getByRole('heading', { name: '다음 권 미리 보기' }),
    ).toBeVisible();

    // 퀘스트 → 월드맵 링크는 그 퀘스트의 월드 지도
    // 전환이 끝나면 붙였던 이름·표시를 거둔다
    await expect(page.locator('html')).not.toHaveAttribute('data-book-vt');
    await setTier(e2eUser.id, 'auto');

    await page.goto(`/quest/${stage1.quests[0].id}`);
    await expect(page.getByRole('link', { name: /월드맵/ })).toHaveAttribute(
      'href',
      '/world/python-island',
    );
  });

  test('준비 중·잠긴 월드 주소는 지도 대신 안내, 없는 월드는 404', async ({
    page,
  }) => {
    await page.goto('/world/code-sea');
    const locked = page.getByTestId('world-locked');
    await expect(
      locked.getByRole('heading', { level: 1, name: '코드 바다' }),
    ).toBeVisible();
    await expect(locked).toContainText('준비 중');
    await expect(locked).toContainText('파이썬 섬을 다 모험하면 열려요');
    await expect(page.locator('.world-map')).toHaveCount(0);
    await expect(
      locked.getByRole('link', { name: '책장 보기' }),
    ).toHaveAttribute('href', '/worlds');

    await page.goto('/world/test-meadow');
    await expect(page.getByTestId('world-locked')).toContainText('잠겨 있어요');
    await expect(page.locator('.world-map')).toHaveCount(0);

    // 404 화면 (상태 코드는 로그인 화면 loading.tsx 스트리밍 때문에 200 — 퀘스트 페이지의 없는 퀘스트와 같음)
    await page.goto('/world/no-such-world');
    await expect(
      page.getByRole('heading', { name: '길을 찾을 수 없어요' }),
    ).toBeVisible();
    await expect(page.locator('.world-map')).toHaveCount(0);
  });

  test('테스트 월드: 월드 1을 다 깨면 두 번째 월드 지도가 데이터만으로 열린다', async ({
    page,
    e2eUser,
  }) => {
    await completeQuests(
      e2eUser.id,
      allQuestIds().map((id) => ({ id, solution: '' })),
    );

    // /world 는 진행 중 월드(테스트 들판)를 그린다, 노드 3개(map.yaml) + 첫 스테이지 열림
    await page.goto('/world');
    await expect(
      page.getByRole('heading', { level: 1, name: '테스트 들판 모험 지도' }),
    ).toBeVisible();
    await expect(page.locator('.world-node [data-stage-id]')).toHaveCount(3);
    await expect(stageButton(page, '테스트 스테이지 1')).toBeEnabled();

    // 다 읽은 월드 1 지도도 그대로 열린다
    await page.goto('/world/python-island');
    await expect(
      page.getByRole('heading', { level: 1, name: '파이썬 섬 모험 지도' }),
    ).toBeVisible();

    await page.goto('/worlds');
    await expect(book(page, 'python-island')).toContainText('다 읽었어요');
    await expect(book(page, 'test-meadow')).toContainText('모험 중');
    await expect(book(page, 'test-meadow')).toContainText('지금 읽는 책');
  });

  // 스크린샷 (보고용): E2E_SHOTS=<폴더> 일 때만. 360·768·1280 × full·minimal
  test.describe('월드 선택 스크린샷', () => {
    const dir = process.env.E2E_SHOTS;
    test.skip(!dir, 'E2E_SHOTS 가 없으면 건너뜀');

    test('책장·지도 머리·잠긴 안내', async ({ page, e2eUser }) => {
      test.setTimeout(240_000);
      mkdirSync(dir!, { recursive: true });
      for (const tier of ['full', 'minimal'] as const) {
        await setTier(e2eUser.id, tier);
        for (const width of [360, 768, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          const shot = async (path: string, name: string, full = true) => {
            await page.goto(path);
            await page.waitForTimeout(1200);
            await page.screenshot({
              path: join(dir!, `${name}-${width}-${tier}.png`),
              fullPage: full,
            });
          };
          await shot('/worlds', 'worlds');
          await shot('/world', 'map-head', false);
          await shot('/world/code-sea', 'locked');
        }
      }
      await setTier(e2eUser.id, 'auto');
    });
  });
});
