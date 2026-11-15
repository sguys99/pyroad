// 작품 갤러리 (P11-07, Phase 11 완료 기준 "갤러리에는 정해진 리액션만 있고, 신고와 숨김 처리가 동작한다"):
// 작가(e2eUser)가 그림을 저장 → 3월드 프로젝트 완료 작품으로 → 작품 보기에서 출품 시트(개인정보 확인) → 공개
// → 다른 학생이 갤러리에서 보고 다시 그리기(명령 재생) → 스티커 → 신고 → 운영자가 숨김 → 갤러리·작품 모두 사라짐.
// 대화 작품 재생, 정해지지 않은 스티커·내 작품 스티커 API 거절도.
//
// 3월드 퀘스트는 아직 콘텐츠가 없어(P11-12~14) 1월드 프로젝트 퀘스트 행을 복사해 메이커 시티 첫 스테이지에 잠깐 넣는다(끝나면 지움).

import { randomBytes, randomUUID } from 'node:crypto';
import { type Browser, type Page } from '@playwright/test';
import { createServerClient } from '@supabase/ssr';
import {
  test,
  expect,
  waitStreamSettled,
  watchCspViolations,
} from './support/test';
import { adminClient } from './support/admin';
import { stage } from './support/content';
import { requireLocalStack } from './support/env';
import { outputPanel, runCode } from './support/quest';

const CODE =
  'import turtle\nt = turtle.Turtle()\nt.color("purple", "pink")\nt.begin_fill()\nfor i in range(6):\n    t.forward(90)\n    t.left(60)\nt.end_fill()\nturtle.title("보라 벌집")';

const created: string[] = [];
let tempQuest = '';
let tempStage = '';

async function newStudent(
  name: string,
  appMetadata?: Record<string, unknown>,
): Promise<{ id: string; cookies: { name: string; value: string }[] }> {
  const stack = requireLocalStack();
  const db = adminClient();
  const email = `e2e-gal-${Date.now()}-${randomBytes(3).toString('hex')}@e2e.pyroad.test`;
  const password = randomBytes(18).toString('base64url');
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    ...(appMetadata && { app_metadata: appMetadata }),
  });
  if (error || !data.user)
    throw new Error(`[e2e] 사용자 생성 실패: ${error?.message}`);
  created.push(data.user.id);
  const now = new Date().toISOString();
  await db
    .from('users')
    .update({
      nickname: name,
      onboarded_at: now,
      age_band: '14plus',
      age_checked_at: now,
    })
    .eq('id', data.user.id);
  const jar = new Map<string, string>();
  const sb = createServerClient(stack.url, stack.anonKey, {
    cookies: {
      getAll: () => [...jar].map(([n, value]) => ({ name: n, value })),
      setAll: (cs) =>
        cs.forEach(({ name: n, value }) =>
          value ? jar.set(n, value) : jar.delete(n),
        ),
    },
  });
  const { error: signInError } = await sb.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw new Error(`[e2e] 로그인 실패: ${signInError.message}`);
  return {
    id: data.user.id,
    cookies: [...jar].map(([n, value]) => ({ name: n, value })),
  };
}

async function openAs(
  browser: Browser,
  baseURL: string,
  cookies: { name: string; value: string }[],
  width = 1280,
): Promise<Page> {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    locale: 'ko-KR',
    viewport: { width, height: 900 },
  });
  await context.addCookies(
    cookies.map((c) => ({ ...c, url: baseURL, sameSite: 'Lax' as const })),
  );
  const page = await context.newPage();
  await watchCspViolations(page);
  return page;
}

async function shots(page: Page, name: string) {
  if (!process.env.E2E_SHOTS) return;
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    await page.screenshot({
      path: `${process.env.E2E_SHOTS}/${name}-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

test.beforeAll(async () => {
  const db = adminClient();
  const { data: world } = await db
    .from('worlds')
    .select('id')
    .eq('slug', 'maker-city')
    .single();
  // 3월드 스테이지도 아직 seed 에 없어 임시로 하나 (끝나면 지우면 퀘스트·진행도 같이 지워짐)
  tempStage = randomUUID();
  const { error: stageError } = await db.from('stages').insert({
    id: tempStage,
    world_id: world!.id,
    order: 990,
    title: '갤러리 시험 공방',
    theme_name: 'maker_city',
  });
  if (stageError)
    throw new Error(`[e2e] 임시 스테이지 실패: ${stageError.message}`);
  const { data: project } = await db
    .from('quests')
    .select('*')
    .eq('quest_type', 'project')
    .limit(1)
    .single();
  tempQuest = randomUUID();
  const { error } = await db.from('quests').insert({
    ...project,
    id: tempQuest,
    stage_id: tempStage,
    order: 990,
    title: '갤러리 시험 프로젝트',
  });
  if (error)
    throw new Error(`[e2e] 임시 3월드 프로젝트 실패: ${error.message}`);
});

test.afterAll(async () => {
  const db = adminClient();
  await db.from('creations').delete().eq('quest_id', tempQuest);
  await db.from('user_progress').delete().eq('quest_id', tempQuest);
  await db.from('quests').delete().eq('id', tempQuest);
  await db.from('stages').delete().eq('id', tempStage);
  for (const id of created) await db.auth.admin.deleteUser(id);
});

test('출품 → 친구가 보고 스티커·신고 → 운영자 숨김 → 사라짐', async ({
  page,
  e2eUser,
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const db = adminClient();
  await db.from('users').update({ nickname: '벌집작가' }).eq('id', e2eUser.id);

  // 1. 작가: 그림 실행 → 작품으로 저장 (썸네일·명령은 진짜 화면이 만든 것)
  await page.goto(`/quest/${stage(1).quests[0].id}`);
  await runCode(page, CODE);
  await expect(outputPanel(page)).toHaveAttribute(
    'data-state',
    /success|wrong/,
  );
  const bar = page.locator('[data-testid="save-creation-bar"]:visible');
  await bar.getByTestId('save-creation-open').click();
  await expect(
    page.getByTestId('save-creation-preview').locator('img'),
  ).toBeVisible();
  await page.getByTestId('save-creation-submit').click();
  await expect(bar).toContainText('내 작품함에 저장했어요');
  const { data: saved } = await db
    .from('creations')
    .select('id')
    .eq('user_id', e2eUser.id)
    .single();
  const id = saved!.id as string;
  await expect(bar.getByTestId('save-creation-view')).toHaveAttribute(
    'href',
    `/gallery/${id}`,
  );

  // 1월드 퀘스트라 아직 못 올림 → 3월드 프로젝트를 끝낸 작품으로 바꿈
  await page.goto(`/gallery/${id}`);
  await expect(page.getByTestId('owner-panel')).toContainText(
    '프로젝트를 끝낸 작품만',
  );
  await expect(page.getByTestId('owner-publish-open')).toHaveCount(0);
  await db.from('creations').update({ quest_id: tempQuest }).eq('id', id);
  await db.from('user_progress').insert({
    user_id: e2eUser.id,
    quest_id: tempQuest,
    status: 'completed',
    completed_at: new Date().toISOString(),
  });

  // 2. 작품함 → 작품 보기 → 출품 시트 (제안 J): 확인 전에는 못 올림
  await page.goto('/profile/creations');
  await page.getByTestId('my-creation-open').click();
  await expect(page).toHaveURL(new RegExp(`/gallery/${id}$`));
  await expect(page.getByTestId('gallery-canvas')).toHaveAttribute(
    'data-state',
    'done',
    {
      timeout: 20_000,
    },
  );
  await page.getByTestId('owner-publish-open').click();
  const sheet = page.getByTestId('publish-sheet');
  await expect(sheet).toContainText('친구들에게는 이렇게 보여요');
  await expect(sheet).toContainText('벌집작가');
  await expect(page.getByTestId('publish-submit')).toBeDisabled();
  await sheet.getByTestId('publish-confirm').check();
  await expect(page.getByTestId('publish-submit')).toBeEnabled();
  if (process.env.E2E_SHOTS)
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({
        path: `${process.env.E2E_SHOTS}/gallery-publish-${width}.png`,
      });
    }
  await page.getByTestId('publish-submit').click();
  await expect(sheet).toBeHidden();
  await expect(page.getByTestId('owner-public')).toBeVisible();
  const { data: pub } = await db
    .from('creations')
    .select('visibility, show_code, published_at')
    .eq('id', id)
    .single();
  expect(pub).toMatchObject({ visibility: 'public', show_code: false });
  // 내 작품에는 스티커를 못 붙임 (화면은 읽기만, API 도 거절)
  await expect(page.getByTestId('sticker-love')).toBeDisabled();
  const own = await page.request.post(`/api/gallery/${id}`, {
    data: { action: 'react', sticker: 'love', on: true },
  });
  expect(own.status()).toBe(400);

  // 3. 친구: 갤러리 → 작품 → 다시 그리기 → 스티커 → 신고
  const friend = await newStudent('구경꾼');
  const fp = await openAs(browser, baseURL!, friend.cookies);
  await fp.goto('/world');
  await waitStreamSettled(fp);
  await fp.getByTestId('hud-menu').click();
  await fp.getByTestId('menu-gallery').click();
  await expect(fp).toHaveURL(/\/gallery$/);
  const card = fp.getByTestId('gallery-card').filter({ hasText: '벌집작가' });
  await expect(card).toBeVisible();
  await shots(fp, 'gallery-wall');
  await card.click();
  await expect(fp.getByTestId('gallery-canvas')).toHaveAttribute(
    'data-state',
    'done',
    {
      timeout: 20_000,
    },
  );
  await expect(fp.getByTestId('gallery-canvas')).toHaveAttribute(
    'aria-label',
    /보라 벌집/,
  );
  // 코드는 작가가 켜지 않아 없음
  await expect(fp.getByTestId('gallery-code')).toHaveCount(0);
  // 정해진 스티커만 (5종)
  await expect(fp.getByTestId('sticker-board').getByRole('button')).toHaveCount(
    5,
  );
  await fp.getByTestId('sticker-love').click();
  await expect(fp.getByTestId('sticker-love')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(fp.getByTestId('sticker-status')).toContainText('붙였어요');
  await expect(fp.getByTestId('sticker-love')).toContainText('1');
  const bogus = await fp.request.post(`/api/gallery/${id}`, {
    data: { action: 'react', sticker: 'poop', on: true },
  });
  expect(bogus.status()).toBe(400);
  await shots(fp, 'gallery-work');

  await fp.getByTestId('report-open').click();
  await fp.getByRole('radio', { name: /개인정보/ }).check();
  await fp.getByRole('button', { name: '신고하기' }).click();
  await expect(fp.getByText('알려 줘서 고마워요')).toBeVisible();
  await fp.getByRole('button', { name: '확인' }).click();
  const { data: reports } = await db
    .from('creation_reports')
    .select('reason, target_user_id')
    .eq('creation_id', id);
  expect(reports).toEqual([
    { reason: 'personal_info', target_user_id: e2eUser.id },
  ]);

  // 4. 운영자: 신고 살펴보기 → 작품 → 숨기기
  const op = await newStudent('운영자', { role: 'admin' });
  const ap = await openAs(browser, baseURL!, op.cookies);
  await ap.goto('/gallery/review');
  await ap.getByTestId('gallery-card').filter({ hasText: '벌집작가' }).click();
  await expect(ap.getByTestId('moderation-panel')).toContainText('신고 1건');
  await ap.getByTestId('moderation-toggle').click();
  await expect(ap.getByTestId('moderation-panel')).toContainText('숨김 상태');

  // 5. 친구에게서 사라짐 (목록·작품·썸네일·명령), 작가 작품함에는 "운영자가 숨김"
  await fp.goto('/gallery');
  await expect(
    fp.getByTestId('gallery-card').filter({ hasText: '벌집작가' }),
  ).toHaveCount(0);
  // 로딩 경계 때문에 상태 코드는 200 으로 먼저 나가므로 화면으로 확인 (not-found)
  await fp.goto(`/gallery/${id}`);
  await expect(fp.getByTestId('gallery-plaque')).toHaveCount(0);
  await expect(fp.getByTestId('gallery-canvas')).toHaveCount(0);
  expect((await fp.request.get(`/api/gallery/${id}/commands`)).status()).toBe(
    404,
  );
  expect(
    (await fp.request.get(`/api/creations/${id}/thumbnail`)).status(),
  ).toBe(404);
  await page.goto('/profile/creations');
  await expect(page.getByTestId('my-creation')).toContainText('운영자가 숨김');
  // 비로그인은 갤러리를 못 봄 (Q74 ③)
  const anon = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  expect(
    (await anon.request.get(`${baseURL}/api/gallery/${id}/commands`)).status(),
  ).toBe(401);
  await anon.close();
});

test('대화 작품은 기록을 채팅처럼 다시 보여 주고, 켠 코드만 보인다', async ({
  browser,
  baseURL,
}) => {
  const db = adminClient();
  const author = await newStudent('이야기꾼');
  const { data } = await db
    .from('creations')
    .insert({
      user_id: author.id,
      quest_id: tempQuest,
      kind: 'conversation',
      title: '용 친구 모험',
      code: 'name = input("모험가 별명은? ")\nprint(name + "님, 출발!")',
      show_code: true,
      transcript: [
        { text: '숲 입구에 도착했어요!' },
        { text: '모험가 별명은? ' },
        { text: '번개토끼', answer: true },
        { text: '번개토끼님, 출발!' },
      ],
      visibility: 'public',
      published_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  const viewer = await newStudent('독자');
  const vp = await openAs(browser, baseURL!, viewer.cookies);
  await vp.goto(`/gallery/${data!.id}`);
  const chat = vp.getByTestId('gallery-conversation');
  await expect(chat.locator('ol')).toHaveAttribute('data-state', 'done', {
    timeout: 15_000,
  });
  await expect(chat).toContainText('번개토끼');
  await vp.getByTestId('gallery-code').locator('summary').click();
  await expect(vp.getByTestId('gallery-code')).toContainText('input(');
  await shots(vp, 'gallery-conversation');
  // gzip 명령이 없는 작품
  expect(
    (await vp.request.get(`/api/gallery/${data!.id}/commands`)).status(),
  ).toBe(404);
});
