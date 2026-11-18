// README 스크린샷 (P12-10). 실행: `npm run shots:readme` (로컬 Supabase `npm run db:start` 필요, 운영 DB 금지 — e2e/support/env.ts)
//
// 로컬 스택에 데모 학생을 만들어(e2e 헬퍼: createSocialUser·completeQuests·grantTestCoins) 진행 데이터를 채우고,
// 2배 해상도·동작 줄이기·글꼴 로딩 뒤 찍어 sharp 로 WebP(장당 300KB 이하 목표)로 img/readme-*.webp 에 쓴다. 끝나면 데모 학생을 지운다.
// 닉네임은 실명처럼 보이지 않는 것만. 찍은 뒤 이미지를 눈으로 확인(잘림·로딩 중·임시 공지가 없는지)하고 커밋.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  adminClient,
  bossKey,
  completeQuests,
  grantTestCoins,
  quizKey,
} from '../../e2e/support/admin';
import { allQuestIds, stages } from '../../e2e/support/content';
import { REPO_ROOT } from '../../e2e/support/env';
import {
  openTutorChat,
  outputPanel,
  runCode,
  setCode,
  waitForRunner,
} from '../../e2e/support/quest';
import { enterQuizAnswer } from '../../e2e/support/quizInput';
import {
  createSocialUser,
  deleteSocialUsers,
} from '../../e2e/support/socialUsers';
import { PHONE_QUIZ_NOTE_KEY, waitStreamSettled } from '../../e2e/support/test';

const OUT = join(REPO_ROOT, 'img');
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };
const MOTION = { tier: 'full', reduced: 'on' } as const;

const CITY = stages('maker-city');
// 3월드 프로젝트는 스테이지마다 하나 (3-F 가 마지막)
const PROJECTS = allQuestIds('maker-city').filter(
  (id) =>
    !CITY.some((s) => s.boss?.id === id || s.quests.some((q) => q.id === id)),
);

type Cookies = { name: string; value: string }[];
const who: Record<'main' | 'quest' | 'fan', Cookies> = {
  main: [],
  quest: [],
  fan: [],
};
const ids = { main: '', quest: '' };

const DRAWINGS = [
  `import turtle
t = turtle.Turtle()
t.speed(0)
colors = ["red", "orange", "gold", "green", "royalblue", "purple"]
for i in range(36):
    t.color(colors[i % 6])
    t.circle(70)
    t.right(10)
turtle.title("무지개 꽃")`,
  `import turtle
t = turtle.Turtle()
t.speed(0)
for x, c in [(-160, "gold"), (-30, "tomato"), (100, "deepskyblue")]:
    t.penup()
    t.goto(x, 30)
    t.pendown()
    t.color(c, c)
    t.begin_fill()
    for i in range(5):
        t.forward(100)
        t.right(144)
    t.end_fill()
turtle.title("세 개의 별")`,
  `import turtle
t = turtle.Turtle()
t.speed(0)
t.pensize(2)
colors = ["teal", "orange", "crimson", "royalblue"]
for i in range(90):
    t.color(colors[i % 4])
    t.forward(i * 3)
    t.left(91)
turtle.title("빙글빙글 나선")`,
  `import turtle
t = turtle.Turtle()
t.speed(0)
t.color("purple", "pink")
for k in range(6):
    t.begin_fill()
    for i in range(6):
        t.forward(60)
        t.left(60)
    t.end_fill()
    t.right(60)
turtle.title("보라 벌집")`,
];
// 갤러리에 거는 작가 (첫 작품은 데모 학생 본인)
const ARTISTS = ['별빛토끼', '파란고래', '꼬마화가'];

/** 같은 닉네임을 쥔 지난 실행의 학생이 있으면 풀어 주고 닉네임·동작 줄이기 설정 */
async function nickname(id: string, name: string) {
  const db = adminClient();
  await db.from('users').update({ nickname: null }).eq('nickname', name);
  const { error } = await db
    .from('users')
    .update({
      nickname: name,
      display_name: name,
      settings: { motion: MOTION },
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

async function student(name: string) {
  const u = await createSocialUser({ onboarded: true });
  await nickname(u.id, name);
  return u;
}

/** 1·2월드를 다 깬 상태 (서버 완료 RPC) */
async function clearWorlds12(id: string) {
  await completeQuests(
    id,
    [...allQuestIds(), ...allQuestIds('code-sea')].map((q) => ({
      id: q,
      solution: '',
    })),
  );
}

/** 3월드 스테이지 i 의 코드 퀘스트·프로젝트·보스 */
async function finishCityStage(id: string, i: number) {
  const s = CITY[i];
  await completeQuests(
    id,
    [
      ...s.quests,
      { id: PROJECTS[i], solution: '' },
      ...(s.boss ? [{ id: s.boss.id, solution: '' }] : []),
    ],
    { withBoss: false },
  );
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(600_000);
  // 데모 학생: 1·2월드 클리어, 3월드 1~3단계 클리어 + 4단계 진행 중, 꾸민 파이뱀
  const main = await student('코딩하는수달');
  ids.main = main.id;
  await clearWorlds12(main.id);
  for (const i of [0, 1, 2]) await finishCityStage(main.id, i);
  await completeQuests(main.id, CITY[3].quests.slice(0, 2), {
    withBoss: false,
  });
  await grantTestCoins(main.id, 2400);
  who.main = await main.signIn();

  // 퀘스트·축하·보스 장면용: 3월드 1단계 거북이 공방 진행 중
  const quest = await student('느긋한거북');
  ids.quest = quest.id;
  await clearWorlds12(quest.id);
  await completeQuests(quest.id, CITY[0].quests.slice(0, -1), {
    withBoss: false,
  });
  who.quest = await quest.signIn();

  // 갤러리에 스티커를 붙이는 친구
  const fan = await student('반짝반딧불');
  who.fan = await fan.signIn();
});

test.afterAll(async () => {
  await deleteSocialUsers();
});

async function open(
  browser: Browser,
  baseURL: string,
  as: keyof typeof who | null,
  phone = false,
): Promise<Page> {
  const ctx = await browser.newContext({
    baseURL,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    reducedMotion: 'reduce',
    viewport: phone ? PHONE : DESKTOP,
    deviceScaleFactor: 2,
    ...(phone && { isMobile: true, hasTouch: true }),
  });
  if (as)
    await ctx.addCookies(
      who[as].map((c) => ({ ...c, url: baseURL, sameSite: 'Lax' as const })),
    );
  await ctx.addInitScript(
    ([motion, noteKey]) => {
      try {
        localStorage.setItem('pyroad.motion.prefs.v1', JSON.stringify(motion));
        localStorage.setItem(noteKey, '1');
      } catch {}
    },
    [MOTION, PHONE_QUIZ_NOTE_KEY] as const,
  );
  return ctx.newPage();
}

/** 스트리밍·글꼴·이미지가 끝날 때까지 */
async function settle(page: Page) {
  await waitStreamSettled(page);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((i) => !i.complete)
        .map((i) => new Promise((r) => (i.onload = i.onerror = r))),
    );
  });
  await expect(page.locator('html')).toHaveAttribute('data-reduced', 'true');
}

/** 출석·오늘의 퀴즈 카드 아래 지도 제목이 붙는 HUD 바로 밑에 오게 */
async function toMap(page: Page) {
  await page.getByRole('heading', { level: 1 }).evaluate((h) => {
    const hud =
      document.querySelector('.wh')?.getBoundingClientRect().bottom ?? 0;
    // 지도가 페이지 끝이라 더 못 내려가는 만큼 아래 여백(화면에 안 보이는 바탕)만 늘림
    document.body.style.paddingBottom = '200px';
    window.scrollBy({
      top: h.getBoundingClientRect().top - hud - 28,
      behavior: 'instant',
    });
  });
}

/** 찍어서 WebP 로. 300KB 를 넘으면 품질을 낮춰 다시 */
async function shoot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ animations: 'disabled', caret: 'hide' });
  const sharp = (await import('sharp')).default;
  let webp: Buffer = Buffer.alloc(0);
  for (const quality of [86, 80, 74, 68, 60]) {
    webp = await sharp(png).webp({ quality, effort: 6 }).toBuffer();
    if (webp.length <= 300_000) break;
  }
  writeFileSync(join(OUT, `readme-${name}.webp`), webp);
}

test('랜딩', async ({ browser, baseURL }) => {
  const page = await open(browser, baseURL!, null);
  await page.goto('/');
  await settle(page);
  await shoot(page, 'landing');
  await page.context().close();
});

test('작품 저장 → 갤러리 (그림 4점, 친구 스티커)', async ({
  browser,
  baseURL,
}) => {
  const db = adminClient();
  const page = await open(browser, baseURL!, 'main');
  // 4단계 진행 중인 퀘스트에서 그림을 그려 작품함에 저장 (썸네일·명령은 진짜 화면이 만든 것)
  const target = CITY[3].quests[2];
  for (const code of DRAWINGS) {
    await page.goto(`/quest/${target.id}`);
    await runCode(page, code);
    await expect(outputPanel(page)).toHaveAttribute(
      'data-state',
      /success|wrong/,
      { timeout: 30_000 },
    );
    const bar = page.locator('[data-testid="save-creation-bar"]:visible');
    await bar.getByTestId('save-creation-open').click();
    await expect(
      page.getByTestId('save-creation-preview').locator('img'),
    ).toBeVisible();
    await page.getByTestId('save-creation-submit').click();
    await expect(bar).toContainText('내 작품함에 저장했어요');
  }
  const { data: works } = await db
    .from('creations')
    .select('id')
    .eq('user_id', ids.main)
    .order('created_at');
  expect(works).toHaveLength(DRAWINGS.length);
  // 3월드 1단계 프로젝트 작품으로 걸고, 셋은 다른 작가 이름으로 (데모 데이터라 출품 자격 검사 없이 DB 로)
  for (const [i, w] of works!.entries()) {
    let owner = ids.main;
    if (i > 0) owner = (await student(ARTISTS[i - 1])).id;
    const { error } = await db
      .from('creations')
      .update({
        user_id: owner,
        quest_id: PROJECTS[0],
        visibility: 'public',
        published_at: new Date(Date.now() - i * 60_000).toISOString(),
      })
      .eq('id', w.id);
    expect(error).toBeNull();
  }
  // 친구가 스티커
  const fan = await open(browser, baseURL!, 'fan');
  const stickers = ['love', 'wow', 'fun', 'smart'];
  for (const [i, w] of works!.entries()) {
    const res = await fan.request.post(`/api/gallery/${w.id}`, {
      data: { action: 'react', sticker: stickers[i], on: true },
    });
    expect(res.status()).toBe(200);
  }
  await fan.context().close();

  await page.goto('/gallery');
  await settle(page);
  await shoot(page, 'gallery');
  await page.context().close();
});

test('월드맵·상점·프로필 (데모 학생)', async ({ browser, baseURL }) => {
  const page = await open(browser, baseURL!, 'main');
  // 꾸미기: 사서 입기
  for (const [slot, itemId] of [
    ['hat', 'hat_wizard'],
    ['frame', 'frame_star'],
    ['pet', 'pet_chick'],
  ]) {
    const buy = await page.request.post('/api/shop/purchase', {
      data: { itemId },
    });
    expect(buy.status()).toBe(200);
    const eq = await page.request.post('/api/shop/equip', {
      data: { slot, itemId },
    });
    expect(eq.status()).toBe(200);
  }
  // 처음 들어갈 때 잠금 해제 연출을 한 번 보고 나서 찍음
  await page.goto('/world/maker-city');
  await settle(page);
  await page.reload();
  await settle(page);
  await toMap(page);
  await shoot(page, 'world');
  await page.goto('/worlds');
  await settle(page);
  await shoot(page, 'worlds');
  await page.goto('/shop');
  await settle(page);
  await shoot(page, 'shop');
  await page.goto('/profile');
  await settle(page);
  await shoot(page, 'profile');
  await page.context().close();
});

test('퀘스트: 그림 실행 결과 + 파이뱀 대화', async ({ browser, baseURL }) => {
  // 1단계 마지막 코드 퀘스트(빙글빙글 꽃). 그림판까지 보이게 조금 높은 화면
  const page = await open(browser, baseURL!, 'quest');
  await page.setViewportSize({ width: 1280, height: 960 });
  const quest = CITY[0].quests[CITY[0].quests.length - 1];
  await page.goto(`/quest/${quest.id}`);
  await settle(page);
  await runCode(page, quest.solution);
  await expect(outputPanel(page)).toHaveAttribute('data-verdict', 'pass', {
    timeout: 30_000,
  });
  const chat = await openTutorChat(page);
  await chat.getByTestId('ask-concept').click();
  await expect(chat.getByTestId('chat-student')).toHaveCount(1);
  await expect(chat.getByTestId('chat-tutor').last()).not.toBeEmpty();
  await waitStreamSettled(page);
  await page.mouse.move(0, 0);
  await shoot(page, 'quest');
  await page.context().close();
});

test('보스 배틀 → 이겨서 스테이지 클리어 축하', async ({
  browser,
  baseURL,
}) => {
  // 보스만 남긴 1단계 (코드 퀘스트·프로젝트 끝)
  await completeQuests(
    ids.quest,
    [...CITY[0].quests, { id: PROJECTS[0], solution: '' }],
    { withBoss: false },
  );
  const boss = CITY[0].boss!;
  const key = await bossKey(boss.id);
  const page = await open(browser, baseURL!, 'quest');
  const byId = (id: string) => page.getByTestId(id).filter({ visible: true });
  await page.goto(`/quest/${boss.id}`);
  await settle(page);
  await byId('boss-start').click();
  for (const [i, round] of key.rounds.entries()) {
    await expect(byId('boss-round')).toContainText(`문제 ${i + 1} /`);
    await enterQuizAnswer(
      page,
      byId('boss-card'),
      round,
      round.accepted[0],
      false,
    );
    await byId('boss-submit').click();
    if (i === key.rounds.length - 1) break;
    await expect(byId('boss-next')).toBeVisible();
    if (i === 0) {
      await page.mouse.move(0, 0);
      await shoot(page, 'boss');
    }
    await byId('boss-next').click();
  }
  const overlay = page.getByTestId('celebration-overlay');
  await expect(overlay).toBeVisible({ timeout: 15_000 });
  const first = overlay.locator('[data-testid^="celebration-step-"]').first();
  await expect(first).toBeVisible();
  await first.hover();
  await shoot(page, 'celebration');
  await page.context().close();
});

test('폰 (390): 월드맵·퀘스트·퀴즈·상점', async ({ browser, baseURL }) => {
  const page = await open(browser, baseURL!, 'main', true);
  await page.goto('/world/maker-city');
  await settle(page);
  await page
    .locator('.world-map [data-current]')
    .first()
    .evaluate((n) =>
      n.scrollIntoView({ block: 'center', behavior: 'instant' }),
    );
  await shoot(page, 'phone-world');

  // 공책 탭에 코드를 쓴 모습 (코드 키보드가 함께 보임)
  const quest = CITY[3].quests[2];
  await page.goto(`/quest/${quest.id}`);
  await settle(page);
  await page.getByRole('tab', { name: /공책/ }).tap();
  await waitForRunner(page);
  await setCode(page, quest.solution);
  await shoot(page, 'phone-quest');

  const quiz = CITY.flatMap((st) => st.quizzes).find(
    (q) => q.kind === 'fill_blank',
  )!;
  const key = await quizKey(quiz.id);
  await page.goto(`/quest/${quiz.id}`);
  await settle(page);
  const card = page.getByTestId('quiz-card').filter({ visible: true });
  await enterQuizAnswer(page, card, key, key.accepted[0]);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await shoot(page, 'phone-quiz');

  await page.goto('/shop');
  await settle(page);
  await shoot(page, 'phone-shop');
  await page.context().close();
});
