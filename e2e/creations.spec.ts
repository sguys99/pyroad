// 작품으로 저장 (P11-06): turtle 실행 → 결과 쪽지 아래 띠 → 저장 시트(썸네일·이름) → 비공개 저장 → 내 작품함 → 지우기

import { test, expect } from './support/test';
import { adminClient } from './support/admin';
import { stage } from './support/content';
import { outputPanel, runCode } from './support/quest';

const quest = stage(1).quests[0];
const CODE =
  'import turtle\nt = turtle.Turtle()\nt.color("red", "gold")\nt.begin_fill()\nfor i in range(5):\n    t.forward(120)\n    t.right(144)\nt.end_fill()\nturtle.title("황금 별")\nprint("완성!")';

test('그림 실행을 작품으로 저장하고 내 작품함에서 보고 지운다', async ({
  page,
  e2eUser,
}) => {
  await page.goto(`/quest/${quest.id}`);
  await runCode(page, CODE);
  await expect(outputPanel(page)).toHaveAttribute(
    'data-state',
    /success|wrong/,
  );

  const bar = page.locator('[data-testid="save-creation-bar"]:visible');
  await expect(bar).toContainText('멋진 그림이 나왔어요');
  if (process.env.E2E_SHOTS)
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await bar.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${process.env.E2E_SHOTS}/save-creation-bar-${width}.png`,
      });
    }
  await bar.getByTestId('save-creation-open').click();

  const sheet = page.getByTestId('save-creation-sheet');
  await expect(sheet).toBeVisible();
  // 썸네일: 화면 밖 캔버스로 다시 그린 400×400 PNG
  const img = sheet.getByTestId('save-creation-preview').locator('img');
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(
    400,
  );
  // 이름 기본값 = title()
  const title = sheet.getByTestId('save-creation-title');
  await expect(title).toHaveValue('황금 별');
  await expect(sheet).toContainText('나만 볼 수 있어요');

  if (process.env.E2E_SHOTS)
    await page.screenshot({
      path: `${process.env.E2E_SHOTS}/save-creation-sheet-1280.png`,
    });

  // 금칙어 이름은 서버가 막고 시트에 안내
  await title.fill('시발 별');
  await sheet.getByTestId('save-creation-submit').click();
  await expect(sheet.getByTestId('save-creation-error')).toContainText(
    '작품 이름',
  );

  await title.fill('나의 황금 별');
  await sheet.getByTestId('save-creation-submit').click();
  await expect(sheet).toBeHidden();
  await expect(bar).toContainText('내 작품함에 저장했어요');

  const { data } = await adminClient()
    .from('creations')
    .select('kind, title, visibility, show_code, quest_id, code')
    .eq('user_id', e2eUser.id);
  expect(data).toEqual([
    {
      kind: 'drawing',
      title: '나의 황금 별',
      visibility: 'private',
      show_code: false,
      quest_id: quest.id,
      code: CODE,
    },
  ]);

  await page.goto('/profile/creations');
  const item = page.getByTestId('my-creation');
  await expect(item).toHaveCount(1);
  await expect(item).toContainText('나의 황금 별');
  const thumb = item.locator('img');
  await expect(thumb).toBeVisible();
  await expect
    .poll(() => thumb.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBe(400);

  if (process.env.E2E_SHOTS)
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.screenshot({
        path: `${process.env.E2E_SHOTS}/my-creations-${width}.png`,
      });
    }

  await item.getByTestId('my-creation-delete').click();
  await page.getByTestId('my-creation-delete-confirm').click();
  await expect(page.getByTestId('my-creations-empty')).toBeVisible();
});

test('API: 로그인 세션이어도 gzip 이 아닌 명령·남의 작품 지우기는 거절', async ({
  page,
}) => {
  await page.goto('/profile');
  const form = new FormData();
  form.set(
    'meta',
    JSON.stringify({ kind: 'drawing', title: '가짜', code: '' }),
  );
  form.set('commands', new Blob(['[["m",1,0,0]]']), 'c.gz');
  const res = await page.request.post('/api/creations', { multipart: form });
  expect(res.status()).toBe(400);
  const del = await page.request.delete(
    '/api/creations/00000000-0000-4000-8000-000000000000',
  );
  expect(del.status()).toBe(404);
});
