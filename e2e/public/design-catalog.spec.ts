// 컴포넌트 카탈로그 /dev/design + 연출 단계 대체 검사 (P2-12, docs/design/catalog.md). 비로그인 `public` 프로젝트 → CI e2e-smoke
//
// Phase 2 완료 기준 "reduced-motion과 연출 단계(lite·minimal)에서 모든 연출에 대체 동작이 있다"의 자동 검사:
// - 반복 연출: 단계마다 돌고 있는 무한 반복 애니메이션을 모아 minimal·동작 줄이기는 허용 목록(e2e/support/motion.ts) 밖 0개,
//   lite는 앰비언트·흐림 0개. 카탈로그 "연출 단계 견본"은 앱과 같은 클래스라 CSS 조건 자체를 검사한다
// - 마스코트 리그(JS rAF): minimal은 전환 뒤 DOM 쓰기 0, 동작 줄이기는 위치·크기(transform) 쓰기 0
// - 일회성 연출: 버튼 눌림·HUD 카운트업·시트 등장·진행바 빛 띠·토스트·타자 효과가 단계마다 다르게
// 앱 화면(월드맵·퀘스트)은 로그인 스펙 e2e/motion-tiers.spec.ts. 테스트 전용 페이지라 서버 env PYROAD_TEST_PAGES=1 (support/env.ts)

import { test, expect, type Page } from '@playwright/test';
import { watchCspViolations } from '../support/test';
import {
  AMBIENT,
  IDLE_LOOPS,
  MINIMAL_ALLOW,
  MOTION_MODES,
  blurredCount,
  loopNames,
  loopViolations,
  runningLoops,
  type MotionMode,
} from '../support/motion';

let violations: string[] = [];
test.beforeEach(async ({ page }) => {
  violations = await watchCspViolations(page);
});
test.afterEach(() => {
  expect(violations, 'CSP 위반이 없어야 함 (B27)').toEqual([]);
});

async function openCatalog(page: Page, mode?: MotionMode) {
  const q = mode ? `?motion=${mode.tier}&reduced=${mode.reduced}` : '';
  await page.goto(`/dev/design${q}`);
  await expect(
    page.getByRole('heading', { name: 'pyRoad 디자인 카탈로그' }),
  ).toBeVisible();
  if (mode) {
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-motion', mode.tier);
    await expect(html).toHaveAttribute(
      'data-reduced',
      mode.reduced === 'on' ? 'true' : 'false',
    );
  }
}

/** 리그 SVG 안의 속성 쓰기를 ms 동안 센다 (전체 / transform만) */
function rigWrites(page: Page, testId: string, ms: number) {
  return page.evaluate(
    ({ testId, ms }) =>
      new Promise<{ all: number; transform: number }>((resolve) => {
        const svg = document.querySelector(`[data-testid="${testId}"] svg`);
        if (!svg) return resolve({ all: -1, transform: -1 });
        const n = { all: 0, transform: 0 };
        const mo = new MutationObserver((records) => {
          for (const r of records) {
            n.all++;
            if (r.attributeName === 'transform') n.transform++;
          }
        });
        mo.observe(svg, { attributes: true, subtree: true });
        setTimeout(() => {
          mo.disconnect();
          resolve(n);
        }, ms);
      }),
    { testId, ms },
  );
}

/** 요소의 transform 세로 이동(px). none이면 0 */
async function translateY(page: Page, selector: string): Promise<number> {
  return page.locator(selector).evaluate((el) => {
    const t = getComputedStyle(el).transform;
    if (t === 'none') return 0;
    return new DOMMatrixReadOnly(t).m42;
  });
}

test.describe('카탈로그 /dev/design (P2-12)', () => {
  test('모든 절과 공통 컴포넌트가 보이고, 공유 카드는 실제 PNG로 그려진다', async ({
    page,
  }) => {
    await openCatalog(page);
    for (const id of [
      'motion',
      'colors',
      'type',
      'shape',
      'worlds',
      'motion-tokens',
      'buttons',
      'cards',
      'alert-dialog',
      'sheet',
      'toast',
      'tabs',
      'progress',
      'hud',
      'bubble',
      'reward',
      'tooltip',
      'social-login',
      'rig',
      'editor',
      'run-controls',
      'output-slip',
      'error-staging',
      'success-staging',
      'quiz',
      'celebrations',
      'share-card',
      'sound',
      'legal',
    ]) {
      await expect(page.locator(`section#${id}`)).toHaveCount(1);
    }
    // 버튼 5변형 × 3크기
    for (const v of ['primary', 'secondary', 'reward', 'danger', 'ghost']) {
      for (const s of ['sm', 'md', 'lg']) {
        await expect(page.getByTestId(`btn-${v}-${s}`)).toBeVisible();
      }
    }
    await expect(page.getByTestId('sfx-celebrate')).toBeVisible();
    // 웹폰트: 제목은 Jua로 그려진다 (앱 레이아웃 밖이라 페이지가 직접 싣는다)
    expect(
      await page.evaluate(async () => {
        await document.fonts.ready;
        return document.fonts.check('24px Jua', '카탈로그');
      }),
    ).toBe(true);
    const res = await page.request.get('/dev/design/share-card/levelup');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
    // 확인 모달: 열고 닫으면 연 버튼으로 포커스 복귀
    await page.getByTestId('open-alert').click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByTestId('open-alert')).toBeFocused();
  });

  test('막대에서 단계를 고르면 이 화면에만 적용되고 기기 저장소는 그대로', async ({
    page,
  }) => {
    await openCatalog(page);
    const before = await page.evaluate(() =>
      localStorage.getItem('pyroad.motion.prefs.v1'),
    );
    const detected = await page.locator('html').getAttribute('data-motion');
    await page
      .getByTestId('motion-tier-choice')
      .getByRole('radio', { name: 'minimal' })
      .click();
    await expect(page.locator('html')).toHaveAttribute(
      'data-motion',
      'minimal',
    );
    await expect(page.getByTestId('budget-idleLoops')).toHaveText('끔');
    await page
      .getByTestId('motion-reduced-choice')
      .getByRole('radio', { name: '켜기' })
      .click();
    await expect(page.locator('html')).toHaveAttribute('data-reduced', 'true');
    await expect(page).toHaveURL(/motion=minimal/);
    await expect(page).toHaveURL(/reduced=on/);
    // 자동 + 기기 설정으로 돌아가면 루트(감지) 값으로
    await page
      .getByTestId('motion-tier-choice')
      .getByRole('radio', { name: '자동' })
      .click();
    await page
      .getByTestId('motion-reduced-choice')
      .getByRole('radio', { name: '기기 설정' })
      .click();
    await expect(page.locator('html')).toHaveAttribute('data-reduced', 'false');
    await expect(page.locator('html')).toHaveAttribute(
      'data-motion',
      detected ?? 'full',
    );
    expect(
      await page.evaluate(() => localStorage.getItem('pyroad.motion.prefs.v1')),
    ).toBe(before);
  });

  test('기기의 동작 줄이기(prefers-reduced-motion)를 따른다', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openCatalog(page);
    await expect(page.locator('html')).toHaveAttribute('data-reduced', 'true');
    await expect(page.getByTestId('budget-springs')).toHaveText('끔');
  });
});

test.describe('연출 단계 대체: 반복 연출 (P2-12)', () => {
  for (const mode of MOTION_MODES) {
    test(`${mode.name}: 허용 목록 밖 반복 연출 0개`, async ({ page }) => {
      await openCatalog(page, mode);
      // 타자 효과 커서처럼 잠깐 도는 것과 시작 지연을 지나 자리 잡을 때까지
      await page.waitForTimeout(800);
      const loops = await runningLoops(page);
      const names = loopNames(loops);
      expect(loopViolations(mode, loops), names.join(', ')).toEqual([]);

      const blurred = await blurredCount(page);
      if (mode.tier === 'full') {
        // 검사가 실제로 무언가를 잡는지 (견본이 돌고 있음). 흐림은 움직임이 아니라 단계를 따른다
        if (mode.reduced === 'off') {
          expect(names).toEqual(
            expect.arrayContaining([...AMBIENT, 'mascot-bob', 'qr-sweep']),
          );
        }
        expect(blurred).toBeGreaterThan(0);
      } else {
        expect(blurred, 'lite부터 흐림 없음').toBe(0);
        // 큰 그림자는 단색 오프셋
        const shadow = await page
          .locator('.m-shadow')
          .first()
          .evaluate((el) => getComputedStyle(el).boxShadow);
        expect(shadow).toContain('0px 4px 0px');
      }
      if (mode.tier === 'lite' && mode.reduced === 'off') {
        expect(names).toEqual(expect.arrayContaining(['mascot-bob']));
        expect(names.filter((n) => AMBIENT.includes(n))).toEqual([]);
      }
      if (mode.tier === 'minimal' && mode.reduced === 'off') {
        expect(names.filter((n) => IDLE_LOOPS.includes(n))).toEqual([]);
        // 바쁨 표시는 기능 신호라 계속 돈다
        expect(names).toEqual(
          expect.arrayContaining(['waking-dot', 'spin', 'qr-busy']),
        );
        expect(names.every((n) => n in MINIMAL_ALLOW)).toBe(true);
      }
    });
  }
});

test.describe('연출 단계 대체: 마스코트 리그 (P2-12)', () => {
  test('full은 계속 그리고, minimal은 전환 뒤 DOM 쓰기 0, 동작 줄이기는 위치·크기 쓰기 0', async ({
    page,
  }) => {
    await openCatalog(page, MOTION_MODES[0]);
    await page.getByTestId('rig-pybaem').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    expect((await rigWrites(page, 'rig-pybaem', 1000)).all).toBeGreaterThan(0);

    await openCatalog(page, MOTION_MODES[2]);
    await page.getByTestId('rig-pybaem').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500); // 첫 전환이 끝날 때까지
    expect((await rigWrites(page, 'rig-pybaem', 1500)).all).toBe(0);

    await openCatalog(page, MOTION_MODES[3]);
    await page.getByTestId('rig-pybaem').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    // 상태를 바꿔도(기쁨 → 춤) 몸은 그대로, 표정만 즉시
    await page
      .getByTestId('rig-pybaem')
      .getByRole('button', { name: '춤', exact: true })
      .click();
    expect((await rigWrites(page, 'rig-pybaem', 1500)).transform).toBe(0);
  });
});

test.describe('연출 단계 대체: 일회성 연출 (P2-12)', () => {
  const face = '[data-testid="btn-primary-md"] .g-btn-face';

  test('버튼 눌림: full·minimal은 3px 내려감(minimal은 전환 없음), 동작 줄이기는 움직임 0 + 면 색', async ({
    page,
  }) => {
    for (const mode of [MOTION_MODES[0], MOTION_MODES[2], MOTION_MODES[3]]) {
      await openCatalog(page, mode);
      const btn = page.getByTestId('btn-primary-md');
      await btn.scrollIntoViewIfNeeded();
      const box = (await btn.boundingBox())!;
      const before = await btn
        .locator('.g-btn-face')
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(800); // 올려놓기 전환(jellyB 602ms)이 끝날 때까지
      const hover = await translateY(page, face);
      await page.mouse.down();
      await page.waitForTimeout(200);
      const down = await translateY(page, face);
      const pressedBg = await btn
        .locator('.g-btn-face')
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      const duration = await btn
        .locator('.g-btn-face')
        .evaluate((el) => getComputedStyle(el).transitionDuration);
      await page.mouse.up();
      // WAAPI만 센다 (CSS 전환 복귀는 CSSTransition으로 따로 잡힘)
      const jelly = await btn
        .locator('.g-btn-face')
        .evaluate(
          (el) =>
            el.getAnimations().filter((a) => !(a instanceof CSSTransition))
              .length,
        );
      await page.mouse.move(0, 0);

      if (mode.reduced === 'on') {
        expect(hover, `${mode.name} 올려놓기`).toBe(0);
        expect(down, `${mode.name} 누름`).toBe(0);
        expect(pressedBg, '눌림은 면 색으로').not.toBe(before);
      } else {
        expect(hover, `${mode.name} 올려놓기 1px 뜸`).toBeCloseTo(-1, 0);
        expect(down, `${mode.name} 누름 3px`).toBeCloseTo(3, 0);
        if (mode.tier === 'minimal') expect(duration).toBe('0s');
        // full만 손을 떼면 젤리 출렁임(WAAPI)
        if (mode.tier === 'full') expect(jelly).toBeGreaterThan(0);
        else expect(jelly).toBe(0);
      }
    }
  });

  test('HUD 카운트업·팝: full은 숫자가 올라가며 팝, minimal·동작 줄이기는 바로 바뀌고 금색 틴트', async ({
    page,
  }) => {
    for (const mode of [MOTION_MODES[0], MOTION_MODES[2], MOTION_MODES[3]]) {
      await openCatalog(page, mode);
      const chip = page.getByTestId('hud-live').getByTestId('hud-coin');
      await chip.scrollIntoViewIfNeeded();
      await page.getByTestId('hud-coin-up').click();
      await page.waitForTimeout(150); // 카운트업 700ms의 앞부분
      const mid = await chip.locator('.g-hud-num').innerText();
      const anims = await chip.evaluate((el) => el.getAnimations().length);
      if (mode.tier === 'full' && mode.reduced === 'off') {
        expect(['1,280', '1,317'], `카운트업 중간값 ${mid}`).not.toContain(mid);
        expect(anims, '칩 팝').toBeGreaterThan(0);
        await expect(chip).not.toHaveAttribute('data-flash', /.*/);
      } else {
        expect(mid, '즉시 교체').toBe('1,317');
        await expect(chip).toHaveAttribute('data-flash', 'true');
      }
      await expect(chip.locator('.g-hud-num')).toHaveText('1,317');
    }
  });

  test('시트 등장·진행바 빛 띠·토스트·타자 효과가 단계마다 다르다', async ({
    page,
  }) => {
    const expected = {
      full: { toast: 'g-toast-in', shine: true, caret: true, pop: 'qo-pop' },
      lite: {
        toast: 'g-toast-in-lite',
        shine: true,
        caret: true,
        pop: 'qo-pop-lite',
      },
      minimal: { toast: 'g-fade-in', shine: false, caret: false, pop: 'none' },
      reduced: { toast: 'none', shine: false, caret: false, pop: 'none' },
    };
    for (const mode of MOTION_MODES.slice(0, 4)) {
      const want = expected[mode.reduced === 'on' ? 'reduced' : mode.tier];
      await openCatalog(page, mode);

      // 시트 (넓은 화면 = 가운데 상자): 동작 줄이기는 전환 없이 바로, minimal은 페이드만
      // 전환 속성은 누르기 **전에** transitionrun 으로 모은다: 보이는지 확인한 뒤에 getAnimations 로 보면 minimal 페이드(150ms)가
      // 이미 끝나 있는 일이 있었다 (P3-17 전체 실행에서 3번 중 1번 실패)
      await page.evaluate(() => {
        const w = window as unknown as { __sheetTransitions: Set<string> };
        w.__sheetTransitions = new Set();
        document.addEventListener('transitionrun', (e) => {
          const el = e.target as Element | null;
          if (el?.closest?.('[data-testid="sheet-popup"]') === el)
            w.__sheetTransitions.add(e.propertyName);
        });
      });
      await page.getByTestId('open-sheet').click();
      const sheet = page.getByTestId('sheet-popup');
      await expect(sheet).toBeVisible();
      await page.waitForTimeout(400);
      const props = await page.evaluate(() =>
        [
          ...(window as unknown as { __sheetTransitions: Set<string> })
            .__sheetTransitions,
        ].sort(),
      );
      if (mode.reduced === 'on') expect(props, mode.name).toEqual([]);
      else if (mode.tier === 'minimal') expect(props).toEqual(['opacity']);
      else expect(props).toContain('transform');
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveCount(0);

      // 진행바 빛 띠
      await page.getByTestId('progress-up').click();
      const shineEl = page.getByTestId('progress-bar').locator('.g-prog-shine');
      await expect(page.getByTestId('progress-bar')).toHaveAttribute(
        'data-rising',
        /a|b/,
      );
      const shine = await shineEl.evaluate(
        (el) => getComputedStyle(el).animationName,
      );
      expect(shine !== 'none', `${mode.name} 빛 띠`).toBe(want.shine);

      // 토스트 등장
      await page.getByTestId('toast-good').click();
      const toast = page.locator('.g-toast-region .g-toast').last();
      await expect(toast).toBeVisible();
      expect(
        await toast.evaluate((el) => getComputedStyle(el).animationName),
      ).toBe(want.toast);

      // 타자 효과: minimal·동작 줄이기는 처음부터 전체 문장(커서 없음)
      await page.getByTestId('bubble-retype').click();
      await expect(
        page.getByTestId('bubble-typing').getByTestId('bubble-caret'),
      ).toHaveCount(want.caret ? 1 : 0);
      // 대사창(P6-01): 같은 대체 + 누르면 남은 글자를 한 번에
      const dialogue = page.getByTestId('dialogue-box');
      if (want.caret) {
        await expect(dialogue).toHaveAttribute('data-typing', '');
        await dialogue.click();
      }
      await expect(dialogue).not.toHaveAttribute('data-typing');
      await expect(dialogue.locator('.g-bubble-rest')).toHaveText('');

      // 결과 쪽지 줄 카드 등장 (P6-06): full 스프링 · lite 짧게 · minimal·동작 줄이기 없음, 긴 출력은 앞 12줄만
      const slipLine = page
        .locator('section#output-slip [data-verdict="pass"] .qo-line')
        .first();
      await expect(slipLine).toHaveClass(/qo-pop/);
      expect(
        await slipLine.evaluate((el) => getComputedStyle(el).animationName),
        `${mode.name} 줄 카드`,
      ).toBe(want.pop);
    }
  });
});

test.describe('동행 펫 슬롯 (P5-08)', () => {
  for (const mode of MOTION_MODES.filter((m) =>
    ['full', 'lite', '동작 줄이기(full)'].includes(m.name),
  )) {
    test(`${mode.name}: 견본 펫이 파이뱀 곁에 서고 해제 뒤에도 따라와 지도 안에 있다`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await openCatalog(page, mode);
      const demo = page.getByTestId('world-pet-demo');
      // 운영과 같은 지도 견본에는 펫이 없다
      await expect(
        page.getByTestId('world-map-1').getByTestId('world-pet'),
      ).toHaveCount(0);
      const pet = demo.getByTestId('world-pet');
      const marker = demo.getByTestId('world-current-marker');
      await demo.scrollIntoViewIfNeeded();

      const near = async () => {
        const map = (await demo.locator('.world-map').boundingBox())!;
        const p = (await pet.boundingBox())!;
        const m = (await marker.boundingBox())!;
        expect(p.x).toBeGreaterThanOrEqual(map.x - 1);
        expect(p.x + p.width).toBeLessThanOrEqual(map.x + map.width + 1);
        // 파이뱀 발치 옆 (가로로 파이뱀 폭 안팎, 바닥 높이가 비슷)
        expect(Math.abs(p.x + p.width / 2 - (m.x + m.width / 2))).toBeLessThan(
          m.width,
        );
        expect(Math.abs(p.y + p.height - (m.y + m.height))).toBeLessThan(40);
      };
      await expect(pet).toBeVisible();
      await near();
      await demo.getByTestId('pet-demo-play').click();
      await expect(page.getByText('새 스테이지가 열렸어요! 3단계')).toBeVisible(
        {
          timeout: 15_000,
        },
      );
      await page.waitForTimeout(400);
      await near();
    });
  }
});

test.describe('성공 연출 (P6-08)', () => {
  for (const mode of [MOTION_MODES[0], MOTION_MODES[2], MOTION_MODES[3]]) {
    test(`${mode.name}: 도장·별·카운트업이 단계를 따르고, Esc로 끝 상태로 건너뛴다`, async ({
      page,
    }) => {
      await openCatalog(page, mode);
      const demo = page.getByTestId('success-flags-on');
      await demo.scrollIntoViewIfNeeded();
      await page.getByTestId('success-replay').click();
      const strip = demo.getByTestId('quest-reward');
      const xp = strip.getByTestId('reward-xp-count');
      await expect(strip).toBeVisible();
      await expect(strip.getByTestId('reward-stars')).toHaveAccessibleName(
        '별 2개 / 3개',
      );
      await expect(strip.getByTestId('reward-coins')).toBeVisible();
      const stampAnims = () =>
        demo.locator('.qx-stamp').evaluate((el) => el.getAnimations().length);

      if (mode.tier === 'full' && mode.reduced === 'off') {
        // 진행 중: 숫자가 아직 끝 값 전, 도장은 내려찍는 중 → Esc 한 번에 끝 값·끝 모습
        await expect(strip).not.toHaveAttribute('data-done', /.*/);
        expect(await xp.innerText()).not.toBe('45');
        expect(await stampAnims()).toBeGreaterThan(0);
        await page.keyboard.press('Escape');
        await expect(strip).toHaveAttribute('data-done', 'true');
        await expect(xp).toHaveText('45');
        expect(await stampAnims()).toBe(0);
        // 축하 카드 파이뱀(리그, B32 대체): 뿌듯 → 기쁨 점프
        await expect(
          page.getByTestId('success-card').getByTestId('celebration-mascot'),
        ).toHaveAttribute('data-rig-state', 'happy');
      } else {
        // minimal·동작 줄이기: 처음부터 끝 값 (minimal 도장은 페이드, 동작 줄이기는 움직임 0)
        await expect(strip).toHaveAttribute('data-done', 'true');
        await expect(xp).toHaveText('45');
        if (mode.reduced === 'on') expect(await stampAnims()).toBe(0);
      }
      // 이야기 쪽 파이뱀: 기쁨 점프 뒤 응원
      await expect(page.getByTestId('success-pybaem')).toHaveAttribute(
        'data-rig-state',
        'cheer',
        { timeout: 3_000 },
      );
    });
  }
});

test.describe('축하 오버레이 (P6-13)', () => {
  for (const mode of MOTION_MODES) {
    test(`${mode.name}: 카드 7종 견본, 실제 오버레이는 연출 중 Esc로 끝 상태 → Enter로 다음 → 맨 뒤 스테이지 클리어`, async ({
      page,
    }) => {
      await openCatalog(page, mode);
      const section = page.locator('section#celebrations');
      await section.scrollIntoViewIfNeeded();
      for (const kind of [
        'level_up',
        'badges',
        'stage_clear',
        'golden_key',
        'project_complete',
        'rewards',
        'chest',
      ]) {
        await expect(section.getByTestId(`catalog-cel-${kind}`)).toBeVisible();
      }
      // 견본도 연출이 끝나면 끝 모습 (보물상자는 열린 뚜껑)
      await expect(
        section.getByTestId('catalog-cel-chest').locator('.cel-card'),
      ).toHaveAttribute('data-settled', 'true', { timeout: 5_000 });

      await page.getByTestId('celebration-open-stage').click();
      const overlay = page.getByTestId('celebration-overlay');
      const level = overlay.getByTestId('celebration-step-level_up');
      await expect(level).toBeVisible();
      await expect(
        page.getByRole('dialog', { name: '레벨 3 달성' }),
      ).toBeVisible();
      if (mode.tier === 'full' && mode.reduced === 'off') {
        // 등장 연출 중: 카드 안 1회성 애니메이션이 돈다 → Esc 한 번에 끝 상태(돌고 있는 애니메이션 0), 오버레이는 그대로
        await expect(level).not.toHaveAttribute('data-settled', /.*/);
        await page.keyboard.press('Escape');
        await expect(level).toHaveAttribute('data-settled', 'true');
        expect(
          await level.evaluate(
            (el) =>
              el.getAnimations({ subtree: true }).filter(
                (a) =>
                  a instanceof CSSAnimation &&
                  a.playState === 'running' &&
                  // 자동 넘김 막대는 연출이 아니라 타이머 표시라 Esc 뒤에도 돈다 (마우스가 카드 위면 멈춤 → 그때만 통과하던 것, B48)
                  a.animationName !== 'celebration-countdown',
              ).length,
          ),
        ).toBe(0);
      } else {
        // lite는 짧게 끝나고, minimal·동작 줄이기는 처음부터 끝 상태
        await expect(level).toHaveAttribute('data-settled', 'true', {
          timeout: mode.tier === 'lite' && mode.reduced === 'off' ? 3_000 : 500,
        });
      }
      await expect(overlay.getByTestId('celebration-cta')).toBeFocused();
      const stage = overlay.getByTestId('celebration-step-stage_clear');
      await expect(async () => {
        if (!(await stage.isVisible())) await page.keyboard.press('Enter');
        await expect(stage).toBeVisible({ timeout: 500 });
      }).toPass({ timeout: 15_000 });
      await expect(stage.getByTestId('celebration-map-cta')).toBeFocused();
      // 닫으면 연 버튼으로 포커스 복귀, 뒤 화면 조용히 해제
      await overlay.getByRole('button', { name: '모두 닫기' }).click();
      await expect(overlay).toHaveCount(0);
      await expect(page.getByTestId('celebration-open-stage')).toBeFocused();
      await expect(page.locator('html')).not.toHaveAttribute(
        'data-celebrating',
      );
    });
  }
});
