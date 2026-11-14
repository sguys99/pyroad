// 처리방침 시행일 전 (B79, §12-Q71): 자랑 카드·보호자 리포트·자유 질문은 KST 2026-11-21 00:00 에 저절로 켜진다.
// 테스트 서버는 늘 켜 두고 쿠키 `pyroad-test-policy=before` 일 때만 시행일 전처럼 끈다(`src/lib/legal/policyGate.ts`, 운영은 시각만 봄).
// 켜진 동안 만든 카드·링크도 끄면 공개 페이지·이미지·API 가 모두 404, 화면에는 진입점이 아예 없다.

import { test, expect } from './support/test';
import { completeQuests } from './support/admin';
import { stage } from './support/content';
import { openTutorChat } from './support/quest';

const quest = stage(1).quests[0];

test('시행일 전: 진입점 없음 · 공개 페이지 404 · API 404 not_yet', async ({
  page,
  context,
  e2eUser,
  baseURL,
}) => {
  // 켜진 상태에서 카드·보호자 링크를 하나씩 만들어 둔다 (끈 뒤 진짜 데이터도 막히는지)
  await completeQuests(e2eUser.id, [quest], { withBoss: false });
  const made = await page.request.post('/api/share-cards', {
    data: { kind: 'levelup' },
  });
  expect(made.status()).toBe(200);
  const card = await made.json();
  const link = await page.request.post('/api/guardian-report');
  expect(link.status()).toBe(200);
  const { path: guardianPath } = await link.json();

  await context.addCookies([
    { name: 'pyroad-test-policy', value: 'before', url: baseURL! },
  ]);

  // 프로필: 레벨·주간 자랑하기, 내 자랑 카드 줄 없음 (나머지 화면은 그대로)
  await page.goto('/profile');
  await expect(page.getByTestId('profile-calendar')).toBeVisible();
  await expect(page.getByTestId('share-open')).toHaveCount(0);
  await expect(page.getByTestId('share-open-weekly')).toHaveCount(0);
  await expect(page.getByTestId('profile-share-cards')).toHaveCount(0);
  // 로그인 화면은 loading.tsx 로 먼저 흘려 보내서 상태 코드는 200 — 내용이 "찾을 수 없어요"인지 본다
  await page.goto('/profile/cards');
  await expect(
    page.getByRole('heading', { name: '길을 찾을 수 없어요' }),
  ).toBeVisible();
  await expect(page.getByTestId('my-card')).toHaveCount(0);

  // 설정: 보호자에게 보여 주기 없음
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'AI 튜터' })).toBeVisible();
  await expect(page.getByTestId('guardian-report-section')).toHaveCount(0);

  // 퀘스트: 정해진 질문 버튼은 그대로, 자유 질문 칸 없음
  await page.goto(`/quest/${quest.id}`);
  const chat = await openTutorChat(page);
  await expect(chat.locator('[data-testid^="ask-"]').first()).toBeVisible();
  await expect(chat.getByTestId('free-ask-input')).toHaveCount(0);

  // 공개 페이지·이미지 404 (이미지는 캐시하지 않음 → 시행일 뒤 CDN 이 옛 404 를 내놓지 않음)
  expect((await page.goto(`/share/${card.id}`))?.status()).toBe(404);
  expect((await page.goto(guardianPath))?.status()).toBe(404);
  const img = await page.request.get(card.imageUrl);
  expect(img.status()).toBe(404);
  expect(img.headers()['cache-control']).toBe('no-store');

  // 쓰기·조회 API 는 없는 기능처럼 404 not_yet
  const apis = [
    page.request.post('/api/share-cards', { data: { kind: 'levelup' } }),
    page.request.patch(`/api/share-cards/${card.id}`, {
      data: { action: 'hide' },
    }),
    page.request.post('/api/share-cards/reward', {
      data: { cardId: card.id },
    }),
    page.request.get('/api/guardian-report'),
    page.request.post('/api/tutor', {
      data: {
        type: 'free_question',
        quest_id: quest.id,
        question: '변수는 왜 써요?',
      },
    }),
  ];
  for (const res of await Promise.all(apis)) {
    expect(res.status(), res.url()).toBe(404);
    expect(await res.json()).toMatchObject({ code: 'not_yet' });
  }

  // 시행일이 지나면(쿠키를 지우면 테스트 서버는 켜짐) 같은 카드·링크가 다시 열린다
  await context.clearCookies({ name: 'pyroad-test-policy' });
  expect((await page.goto(`/share/${card.id}`))?.status()).toBe(200);
  await page.goto('/profile');
  await expect(page.getByTestId('profile-share-cards')).toBeVisible();
});
