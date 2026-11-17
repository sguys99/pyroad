// 시각 회귀 (P12-02): 주요 화면 × 360·768·1280 을 기준 이미지(`__screenshots__/`)와 견준다. 실행·갱신은 `npm run test:visual`
// (scripts/visual/run.sh — 브라우저는 Docker 의 공식 Playwright 이미지라 macOS·CI 모두 같은 리눅스 렌더링, e2e/README.md "시각 회귀").
//
// - 사용자는 P0-13 의 세 상태를 이 파일이 만든다(로컬 Supabase, service_role, `@supabase/ssr` 쿠키 주입 = support/socialUsers):
//   진행 중(1·2스테이지 + 3스테이지 앞 두 퀘스트) · 첫 방문(온보딩 전 → 온보딩 뒤 빈 지도) · 축하 직전(1스테이지 마지막 코드 퀘스트만 남음)
// - 고정: 동작 줄이기(서버 설정·기기 사본·`prefers-reduced-motion` 셋 다), Playwright 의 애니메이션 끔·캐럿 숨김, 글꼴 로딩 끝,
//   Math.random 씨앗, 닉네임. 날짜에 따라 바뀌는 칸(출석·미션·달력·공유 카드 기한)은 mask
// - 화면 하나 = 한 test (폭 3개). 스크롤 없는 첫 화면만 찍는다 (기준 이미지 용량, 긴 랜딩은 첫 화면·로그인 시트로)

import { test, expect, type Browser, type Page } from '@playwright/test';
import { adminClient, completeQuests } from '../support/admin';
import { stage, stages } from '../support/content';
import { createSocialUser, deleteSocialUsers } from '../support/socialUsers';
import {
  openStageSheet,
  runButton,
  runCode,
  waitForRunner,
} from '../support/quest';
import { PHONE_QUIZ_NOTE_KEY, waitStreamSettled } from '../support/test';

const WIDTHS = [
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
] as const;

const NICK = '시각용';
const MOTION = { tier: 'full', reduced: 'on' } as const;

type Cookies = { name: string; value: string }[];
const users: Record<'progress' | 'newbie' | 'celeb', Cookies> = {
  progress: [],
  newbie: [],
  celeb: [],
};
let newbieId = '';
let celebId = '';
let shareId = '';

const s1 = stage(1);
const quizStage = stages().find((s) => s.quizzes.length > 0)!;

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

test.beforeAll(async () => {
  const db = adminClient();
  const make = async (onboarded: boolean, nickname: string | null) => {
    const u = await createSocialUser({ onboarded });
    // 닉네임은 유일 — 중간에 끊긴 지난 실행의 사용자가 쥐고 있으면 풀어 준다 (로컬 DB)
    if (nickname)
      await db
        .from('users')
        .update({ nickname: null })
        .eq('nickname', nickname);
    const { error } = await db
      .from('users')
      .update(
        nickname
          ? { nickname, display_name: nickname, settings: { motion: MOTION } }
          : { settings: { motion: MOTION } },
      )
      .eq('id', u.id);
    if (error) throw new Error(error.message);
    return u;
  };
  const progress = await make(true, `${NICK}1`);
  const done = stages().flatMap((s) =>
    s.order <= 2 ? s.quests : s.order === 3 ? s.quests.slice(0, 2) : [],
  );
  await completeQuests(progress.id, done);
  users.progress = await progress.signIn();

  // 닉네임이 있으면 온보딩이 "다시 만나서 반가워"(기존 사용자) 흐름이 되므로 비워 두고 온보딩 뒤에 넣는다
  const newbie = await make(false, null);
  newbieId = newbie.id;
  users.newbie = await newbie.signIn();

  const celeb = await make(true, `${NICK}3`);
  celebId = celeb.id;
  await completeQuests(celeb.id, s1.quests.slice(0, -1), { withBoss: false });
  users.celeb = await celeb.signIn();
});
test.afterAll(deleteSocialUsers);

/** 결정적으로: 동작 줄이기 사본·폰 퀴즈 쪽지 본 것·Math.random 씨앗 */
async function open(
  browser: Browser,
  baseURL: string,
  who: keyof typeof users | null,
): Promise<Page> {
  const ctx = await browser.newContext({
    baseURL,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    reducedMotion: 'reduce',
  });
  if (who)
    await ctx.addCookies(
      users[who].map((c) => ({ ...c, url: baseURL, sameSite: 'Lax' as const })),
    );
  await ctx.addInitScript(
    ([motion, noteKey]) => {
      try {
        localStorage.setItem('pyroad.motion.prefs.v1', JSON.stringify(motion));
        localStorage.setItem(noteKey, '1');
      } catch {}
      let seed = 0x5eed;
      Math.random = () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    [MOTION, PHONE_QUIZ_NOTE_KEY] as const,
  );
  return ctx.newPage();
}

/** 이동 뒤 스트리밍·글꼴·이미지가 끝날 때까지 */
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
  // 지도는 들어올 때 지금 위치로 스크롤하는데, 그 순간 화면 등장 전환(PageTransition)이 0~12px 어디쯤인지에 따라
  // 스크롤 값이 달라진다 → 다 자리 잡은 뒤 같은 규칙(WorldMap.tsx 들어올 때 자리 잡기, B97)으로 한 번 더 맞춘다
  await page.evaluate(() => {
    const map = document.querySelector('.world-map');
    const node = map?.querySelector('[data-current]');
    if (!map || !node) return;
    const hud =
      document.querySelector('.wh')?.getBoundingClientRect().bottom ?? 0;
    const m = map.getBoundingClientRect();
    if (m.height + 32 <= window.innerHeight - hud)
      window.scrollBy({ top: m.top - hud - 16, behavior: 'instant' });
    else node.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
}

/** 날짜·오늘에 따라 바뀌는 칸 */
const dynamic = (page: Page) => [
  page.getByTestId('attendance-card'),
  page.getByTestId('hud-mission'),
  page.getByTestId('mission-timer'),
  page.locator('.ob-card-foot'), // 온보딩 등록증 발급일
  page.locator('.ob-card-name'), // 온보딩이 서버에서 무작위로 고른 추천 닉네임
  page.getByTestId('learning-calendar'), // 프로필 학습 달력 (이달·오늘)
  page.locator('.pf-medals'), // 최근 업적 (같은 시각에 받은 것끼리 순서가 바뀜·받은 날)
  page.getByText(/^\d{4}년 \d{1,2}월 \d{1,2}일$/), // 게시판 글 쓴 날
];

async function shoot(page: Page, name: string, width: number) {
  await expect(page).toHaveScreenshot(`${name}-${width}.png`, {
    mask: dynamic(page),
    animations: 'disabled',
    caret: 'hide',
    // 캐릭터 리그의 소수점 위치 차이(안티에일리어싱 수백 px)만 허용. 12px 밀림 같은 배치 변화는 수만 px라 잡힘
    maxDiffPixelRatio: 0.002,
  });
}

/** 화면 하나를 세 폭으로: 폭마다 새로 연다 (서버·클라이언트가 폭에 맞춰 처음부터 그리게) */
async function screen(
  browser: Browser,
  baseURL: string,
  name: string,
  who: keyof typeof users | null,
  go: (page: Page) => Promise<void>,
) {
  const page = await open(browser, baseURL, who);
  try {
    for (const size of WIDTHS) {
      await page.setViewportSize(size);
      await go(page);
      await settle(page);
      await shoot(page, name, size.width);
    }
  } finally {
    await page.context().close();
  }
}

const visit = (path: string) => async (page: Page) => {
  await page.goto(path);
};

test('랜딩', async ({ browser, baseURL }) => {
  await screen(browser, baseURL!, 'landing', null, visit('/'));
});

test('로그인 시트', async ({ browser, baseURL }) => {
  await screen(browser, baseURL!, 'login', null, async (page) => {
    await page.goto('/');
    await page
      .getByRole('banner')
      .getByRole('button', { name: '로그인' })
      .click();
    await expect(page.getByTestId('login-sheet')).toBeVisible();
  });
});

test('공지', async ({ browser, baseURL }) => {
  await screen(browser, baseURL!, 'notice', null, visit('/notice'));
});

test('없는 주소 (404)', async ({ browser, baseURL }) => {
  await screen(browser, baseURL!, 'not-found', null, visit('/no-such-page'));
});

test('온보딩 (첫 방문)', async ({ browser, baseURL }) => {
  await screen(browser, baseURL!, 'onboarding', 'newbie', visit('/onboarding'));
});

/** 온보딩을 끝낸 첫 방문 상태로 (지도·퀘스트). 같은 값으로 덮으니 여러 번 불러도 됨 — `-g`로 한 화면만 돌려도 맞게 */
async function onboardNewbie() {
  const now = new Date().toISOString();
  const db = adminClient();
  const nickname = `${NICK}2`;
  await db
    .from('users')
    .update({ nickname: null })
    .eq('nickname', nickname)
    .neq('id', newbieId);
  const { error } = await db
    .from('users')
    .update({
      onboarded_at: now,
      age_band: '14plus',
      age_checked_at: now,
      nickname,
      display_name: nickname,
    })
    .eq('id', newbieId);
  expect(error).toBeNull();
}

test('월드맵 (첫 방문)', async ({ browser, baseURL }) => {
  await onboardNewbie();
  await screen(browser, baseURL!, 'world-first', 'newbie', visit('/world'));
});

test('월드맵 (진행 중)', async ({ browser, baseURL }) => {
  await screen(
    browser,
    baseURL!,
    'world-progress',
    'progress',
    visit('/world'),
  );
});

test('월드 선택', async ({ browser, baseURL }) => {
  await screen(browser, baseURL!, 'worlds', 'progress', visit('/worlds'));
});

test('퀘스트 (코드)', async ({ browser, baseURL }) => {
  await onboardNewbie();
  await screen(browser, baseURL!, 'quest-code', 'newbie', async (page) => {
    await page.goto(`/quest/${s1.quests[0].id}`);
    // 실행기 준비 전("준비 중…"·불러오기 쪽지)을 찍으면 흔들림 (P12-02 뒤 1280에서 한 번 잡힘). 360은 공책 탭이 닫혀 버튼이 안 보임
    if (await runButton(page).count()) await waitForRunner(page);
  });
});

test('퀘스트 (퀴즈)', async ({ browser, baseURL }) => {
  await screen(
    browser,
    baseURL!,
    'quest-quiz',
    'progress',
    visit(`/quest/${quizStage.quizzes[0].id}`),
  );
});

test('축하 오버레이 (축하 직전 → 마지막 코드 퀘스트 통과)', async ({
  browser,
  baseURL,
}) => {
  // 한 번 통과하면 다시 안 뜨므로 1280 에서 한 번 띄우고 폭만 바꿔 찍는다
  const page = await open(browser, baseURL!, 'celeb');
  try {
    const last = s1.quests[s1.quests.length - 1];
    await page.setViewportSize(WIDTHS[2]);
    await page.goto(`/quest/${last.id}`);
    await settle(page);
    await runCode(page, last.solution);
    const overlay = page.getByTestId('celebration-overlay');
    await expect(overlay).toBeVisible({ timeout: 30_000 });
    const first = overlay.locator('[data-testid^="celebration-step-"]').first();
    await expect(first).toBeVisible();
    await first.hover();
    for (const size of [...WIDTHS].reverse()) {
      await page.setViewportSize(size);
      await page.evaluate(() => document.fonts.ready);
      await shoot(page, 'celebration', size.width);
    }
  } finally {
    await page.context().close();
  }
});

test('보스 (축하 직전 사용자가 1스테이지 코드 퀘스트를 다 깬 뒤)', async ({
  browser,
  baseURL,
}) => {
  // 축하 테스트가 마지막 코드 퀘스트를 깼지만, `-g`로 이것만 돌릴 때도 보스가 열리게 (이미 깬 퀘스트는 복습으로 끝남)
  await completeQuests(celebId, s1.quests, { withBoss: false });
  await screen(
    browser,
    baseURL!,
    'boss',
    'celeb',
    visit(`/quest/${s1.boss!.id}`),
  );
});

test('상점', async ({ browser, baseURL }) => {
  await screen(browser, baseURL!, 'shop', 'progress', visit('/shop'));
});

test('프로필', async ({ browser, baseURL }) => {
  await screen(browser, baseURL!, 'profile', 'progress', visit('/profile'));
});

// 별과 보물은 첫 화면 밖이라 카드만 (B140): 지금 월드(1권)는 펼친 스테이지 줄, 2·3권은 접힌 줄(별 합계·잠김)이 한 장에
test('프로필 별과 보물 (월드별 접기)', async ({ browser, baseURL }) => {
  const page = await open(browser, baseURL!, 'progress');
  try {
    for (const size of WIDTHS) {
      await page.setViewportSize(size);
      await page.goto('/profile');
      await settle(page);
      const card = page.getByTestId('profile-treasure');
      await card.scrollIntoViewIfNeeded();
      await expect(card).toHaveScreenshot(
        `profile-treasure-${size.width}.png`,
        {
          animations: 'disabled',
          maxDiffPixelRatio: 0.002,
        },
      );
    }
  } finally {
    await page.context().close();
  }
});

test('업적 도감', async ({ browser, baseURL }) => {
  await screen(
    browser,
    baseURL!,
    'achievements',
    'progress',
    visit('/profile/achievements'),
  );
});

test('설정', async ({ browser, baseURL }) => {
  await screen(browser, baseURL!, 'settings', 'progress', visit('/settings'));
});

test('게시판', async ({ browser, baseURL }) => {
  await screen(browser, baseURL!, 'board', 'progress', visit('/board'));
});

test('월드맵 스테이지 시트 (진행 중)', async ({ browser, baseURL }) => {
  await screen(browser, baseURL!, 'stage-sheet', 'progress', async (page) => {
    await page.goto('/world');
    await settle(page);
    await openStageSheet(page, stage(3).title);
  });
});

test('게시판 글 (내 글, 댓글 없음)', async ({ browser, baseURL }) => {
  const db = adminClient();
  const { data: me } = await db
    .from('users')
    .select('id')
    .eq('nickname', `${NICK}1`)
    .single();
  const { data: post, error } = await db
    .from('board_posts')
    .insert({
      user_id: me!.id,
      title: '파이썬 마을 보스 어떻게 이겨요?',
      content:
        '출력 대장 버그버그를 만났는데 세 번째 문제에서 자꾸 틀려요. 따옴표를 어디에 써야 하는지 헷갈려요. 힌트 있는 친구 있나요?',
    })
    .select('id')
    .single();
  expect(error).toBeNull();
  await screen(
    browser,
    baseURL!,
    'board-post',
    'progress',
    visit(`/board/${post!.id}`),
  );
});

test('갤러리', async ({ browser, baseURL }) => {
  await screen(browser, baseURL!, 'gallery', 'progress', visit('/gallery'));
});

test('공유 페이지 (비로그인)', async ({ browser, baseURL, request }) => {
  // 요청은 러너에서 (원격 브라우저 맥락의 request 는 컨테이너 안에서 나감)
  const made = await request.post('/api/share-cards', {
    data: { kind: 'levelup' },
    headers: {
      cookie: users.progress.map((c) => `${c.name}=${c.value}`).join('; '),
    },
  });
  expect(made.status()).toBe(200);
  shareId = (await made.json()).id;
  await screen(browser, baseURL!, 'share', null, async (page) => {
    await page.goto(`/share/${shareId}`);
    await expect
      .poll(() =>
        page
          .getByTestId('share-card-image')
          .evaluate((el: HTMLImageElement) => el.naturalWidth),
      )
      .toBe(1200);
  });
});
