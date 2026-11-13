// 공유 카드 API·이미지 (P9-07): 로그인 세션으로 카드 만들기 → 운영 빌드의 Node 함수가 번들 폰트로 PNG 를 그림 → 캐시 헤더.
// 성과 숫자는 서버가 계산(본문의 숫자·닉네임은 무시), 쿼리 문자열 글자는 그리지 않음, 없는 카드는 404.

import { test, expect } from './support/test';
import { adminClient } from './support/admin';

test('레벨업 카드 만들기 → PNG 1200×630·캐시 헤더, 안 깬 스테이지는 409, 없는 카드는 404', async ({
  page,
  e2eUser,
  browser,
  baseURL,
}) => {
  const made = await page.request.post('/api/share-cards', {
    data: { kind: 'levelup', level: 99, nickname: '가짜' },
  });
  expect(made.status()).toBe(200);
  const card = await made.json();
  expect(card.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
  expect(card.imageUrl).toBe(
    `/api/share-cards/${card.id}/image?v=${card.version}`,
  );
  const { data: row } = await adminClient()
    .from('share_cards')
    .select('user_id, snapshot')
    .eq('id', card.id)
    .single();
  const { data: me } = await adminClient()
    .from('users')
    .select('current_level')
    .eq('id', e2eUser.id)
    .single();
  expect(row!.user_id).toBe(e2eUser.id);
  expect(row!.snapshot).toMatchObject({ level: me!.current_level });
  expect(JSON.stringify(row!.snapshot)).not.toContain('가짜');

  const img = await page.request.get(`${card.imageUrl}&nickname=해커`);
  expect(img.status()).toBe(200);
  const h = img.headers();
  expect(h['content-type']).toBe('image/png');
  expect(h['cache-control']).toBe('public, max-age=3600');
  expect(h['vercel-cache-tag']).toBe(`share-card-${card.id}`);
  expect(h['vercel-cdn-cache-control']).toMatch(/^public, max-age=\d+$/);
  const png = await img.body();
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);

  // 비로그인 열람 (공유 링크를 받은 사람)
  const anon = await browser.newContext({ baseURL });
  expect((await anon.request.get(card.imageUrl)).status()).toBe(200);
  await anon.close();

  const { data: stage } = await adminClient()
    .from('stages')
    .select('id')
    .order('order')
    .limit(1)
    .single();
  const notCleared = await page.request.post('/api/share-cards', {
    data: { kind: 'stage', ref: stage!.id },
  });
  // 진행은 테스트마다 초기화되므로 첫 스테이지도 아직 안 깸
  expect(notCleared.status()).toBe(409);

  const missing = await page.request.get(
    '/api/share-cards/AAAAAAAAAAAAAAAAAAAAAA/image',
  );
  expect(missing.status()).toBe(404);
  expect(missing.headers()['cache-control']).toBe('no-store');
});
