// 공유 시트 (P9-09): 프로필 "레벨 카드 자랑하기" → 카드 만들기 → 미리보기 → 링크 복사(클립보드) → Web Share(모의) →
// 카카오톡(모의 SDK, sendDefault 인자 imageUrl·link·버튼) → 보내기 전 안내. 360·1280 스크린샷, CSP 위반 0(cspGuard 픽스처).
// 카카오 SDK·navigator.share 는 addInitScript 모의 객체 — 외부(t1.kakaocdn.net)로 나가지 않는다.

import { test, expect } from './support/test';

type Recorded = { kakao: unknown[]; init: string[]; share: ShareData[] };

test('프로필 → 공유 시트: 링크 복사 · Web Share · 카카오톡 인자 · 안내', async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: baseURL,
  });
  await page.addInitScript(() => {
    const rec: Recorded = { kakao: [], init: [], share: [] };
    (window as unknown as { __rec: Recorded }).__rec = rec;
    let ready = false;
    (window as unknown as { Kakao: unknown }).Kakao = {
      isInitialized: () => ready,
      init: (key: string) => {
        ready = true;
        rec.init.push(key);
      },
      Share: { sendDefault: (arg: unknown) => rec.kakao.push(arg) },
    };
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        rec.share.push({
          ...data,
          files: data.files?.map(
            (f) => ({ name: f.name, type: f.type }) as unknown as File,
          ),
        });
      },
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data: ShareData) => !!data.files?.length,
    });
  });
  const rec = () =>
    page.evaluate(() => (window as unknown as { __rec: Recorded }).__rec);

  for (const [w, h] of [
    [360, 780],
    [1280, 900],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/profile');
    await page.getByTestId('share-open').click();
    const sheet = page.getByTestId('share-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading')).toHaveText('친구에게 자랑하기');
    const preview = sheet.getByTestId('share-sheet-preview');
    await expect
      .poll(() => preview.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBe(1200);
    await expect(sheet.getByTestId('share-notice')).toContainText(
      '이미 보낸 메시지의 미리보기 그림은 나중에 지울 수 없어요',
    );
    await expect(sheet.getByTestId('share-notice')).toContainText('90일');
    await expect(sheet.getByTestId('share-notice')).toContainText(
      '닉네임과 캐릭터',
    );
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(noOverflow).toBeLessThanOrEqual(0);
    // 시트가 떠오르는 연출이 끝난 모습을 찍는다
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => a.playState !== 'running'),
    );
    await page.screenshot({
      path: testInfo.outputPath(`share-sheet-${w}.png`),
    });
    if (w === 360) await page.keyboard.press('Escape');
  }

  const src = await page.getByTestId('share-sheet-preview').getAttribute('src');
  const id = src!.match(
    /^\/api\/share-cards\/([A-Za-z0-9_-]{22})\/image\?v=(\d+)$/,
  )!;
  expect(id).not.toBeNull();
  const pageUrl = `${baseURL}/share/${id[1]}`;

  // 링크 복사 → 클립보드
  await page.getByTestId('share-copy').click();
  await expect(page.getByTestId('share-status')).toContainText(
    '링크를 복사했어요',
  );
  await expect(page.getByTestId('share-copy')).toContainText('복사했어요');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    pageUrl,
  );

  // Web Share: 그림 파일 + 링크
  await page.getByTestId('share-web').click();
  await expect(page.getByTestId('share-status')).toHaveText('보냈어요!');
  const shared = (await rec()).share[0];
  expect(shared.url).toBe(pageUrl);
  expect(shared.files).toEqual([
    { name: 'pyroad-levelup.png', type: 'image/png' },
  ]);

  // 카카오톡: init(키) + 피드 템플릿 인자
  await page.getByTestId('share-kakao').click();
  await expect.poll(async () => (await rec()).kakao.length).toBe(1);
  const r = await rec();
  expect(r.init).toEqual(['e2e-kakao-js-key']);
  expect(r.kakao[0]).toMatchObject({
    objectType: 'feed',
    content: {
      imageUrl: `${baseURL}${src}`,
      imageWidth: 1200,
      imageHeight: 630,
      link: { mobileWebUrl: pageUrl, webUrl: pageUrl },
    },
    buttons: [
      {
        title: '나도 해보기',
        link: { webUrl: `${baseURL}/#try`, mobileWebUrl: `${baseURL}/#try` },
      },
    ],
  });

  // 데스크톱 이미지 저장: 파일 이름이 카드 종류
  const download = page.waitForEvent('download');
  await page.getByTestId('share-save').click();
  expect((await download).suggestedFilename()).toBe('pyroad-levelup.png');
});
