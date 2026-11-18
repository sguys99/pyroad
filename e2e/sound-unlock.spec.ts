// 소리 잠금 해제·자동재생 금지 (P12-01, P0-15 §2 "측정 함정"). Playwright 의 page.evaluate·waitForFunction·locator 확인·트레이스 스냅샷은
// CDP 호출에 userGesture 를 붙여 페이지에 사용자 활성화를 준다 → 그 뒤에 "제스처 전에는 조용하다"를 보면 진짜 제스처 없는 상태가 아니다.
// 그래서 여기는
//   - 실제 기본 정책(--autoplay-policy=document-user-activation-required, P0-15 재현과 같음)으로 브라우저를 띄우고
//   - "제스처 전" 상태는 페이지 스크립트(addInitScript)가 타이머로 찍어 console 로만 보낸다(그동안 Playwright 는 evaluate 하지 않음)
//   - 잠금 해제는 실제 클릭(locator.click → CDP 입력 이벤트, isTrusted)으로
// support/test 의 page.goto 는 스트리밍 대기(waitForFunction)를 덧붙여 활성화를 주므로 여기서는 기본 test 를 쓴다(로그인 쿠키는 프로젝트 storageState).
// 곡 전환·책장·퀘스트 이어 가기는 world-select.spec.ts "월드 BGM"

import { test, expect } from '@playwright/test';

test.use({
  // 트레이스 스냅샷도 페이지에 userGesture evaluate 를 해서 로드 직후(약 40ms) 활성화가 생긴다(실측) → 이 파일만 끔
  trace: 'off',
  launchOptions: {
    args: ['--autoplay-policy=document-user-activation-required'],
  },
});

interface Snapshot {
  active: boolean;
  desired: string | null;
  playing: string | null;
  appContexts: string[];
  probe: string;
}

type AudioLog = {
  ctxs: AudioContext[];
  gestures: { type: string; trusted: boolean }[];
};

test('제스처 전에는 조용하고, evaluate 활성화로는 안 열리며, 실제 클릭으로 BGM 이 난다', async ({
  page,
}) => {
  await page.addInitScript(() => {
    // 배경음악 켬 (기본 꺼짐). 기기 값이 서버 값보다 늦게 바뀐 것으로
    localStorage.setItem(
      'pyroad.sound.v1',
      JSON.stringify({
        version: 1,
        muted: false,
        master: 0.8,
        sfx: { enabled: true, volume: 0.7 },
        bgm: { enabled: true, volume: 0.4 },
        voice: { enabled: true, volume: 0.9 },
        updatedAt: Date.now(),
      }),
    );
    const Native = window.AudioContext;
    const log: AudioLog = { ctxs: [], gestures: [] };
    (window as unknown as { __e2eAudio: AudioLog }).__e2eAudio = log;
    // 앱이 만드는 AudioContext 를 모아 상태를 본다
    window.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) {
        super(options);
        log.ctxs.push(this);
      }
    };
    for (const type of ['pointerdown', 'mousedown', 'keydown', 'touchend'])
      window.addEventListener(
        type,
        (e) => log.gestures.push({ type, trusted: e.isTrusted }),
        true,
      );
    // 제스처 전 기록: 로드 3초 뒤 페이지 스크립트가 찍는다. probe = 지금 새로 만든 AudioContext 상태(정책이 막는지)
    addEventListener('load', () =>
      setTimeout(() => {
        const probe = new Native();
        const html = document.documentElement.dataset;
        const snap: Snapshot = {
          active: navigator.userActivation.hasBeenActive,
          desired: html.bgm ?? null,
          playing: html.bgmPlaying ?? null,
          appContexts: log.ctxs.map((c) => c.state),
          probe: probe.state,
        };
        void probe.close();
        console.log(`e2e-audio-snapshot ${JSON.stringify(snap)}`);
      }, 3000),
    );
  });

  const snapshot = page.waitForEvent('console', {
    predicate: (m) => m.text().startsWith('e2e-audio-snapshot '),
    timeout: 30_000,
  });
  await page.goto('/world/python-island');
  const snap = JSON.parse(
    (await snapshot).text().replace('e2e-audio-snapshot ', ''),
  ) as Snapshot;
  expect(
    snap,
    '제스처 전: 활성화 없음 · 곡은 정했지만 안 남 · 정책이 막음',
  ).toMatchObject({
    active: false,
    desired: 'world1',
    playing: '',
    probe: 'suspended',
  });
  expect(snap.appContexts).not.toContain('running');

  // evaluate 는 활성화를 주지만(P0-15 함정) 입력 이벤트가 아니라 앱은 잠금을 풀지 않는다
  expect(
    await page.evaluate(() => navigator.userActivation.hasBeenActive),
  ).toBe(true);
  await page.waitForTimeout(1000);
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-bgm-playing', '');

  // 실제 클릭 → 신뢰된 입력 이벤트에서 잠금 해제 → 곡이 남
  await page.getByRole('heading', { level: 1 }).click();
  await expect(html).toHaveAttribute('data-bgm-playing', 'world1');
  const after = await page.evaluate(() => {
    const log = (window as unknown as { __e2eAudio: AudioLog }).__e2eAudio;
    return {
      gestures: log.gestures,
      states: log.ctxs.map((c) => c.state),
    };
  });
  expect(after.gestures.length).toBeGreaterThan(0);
  expect(after.gestures.every((g) => g.trusted)).toBe(true);
  expect(after.states).toContain('running');
});
