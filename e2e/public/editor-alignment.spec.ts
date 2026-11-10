// 코드 에디터 한글 주석 정렬 (P2-18, docs/design/editor.md). 비로그인 `public` 프로젝트 → CI e2e-smoke
//
// D2Coding(pyRoad Mono)은 한글 1자 = 영문 2자 폭이어야 주석 속 한글이 줄을 맞춘다. 반각이 0.5em이라 홀수 px에서는
// 반올림으로 어긋난다(15px: 비 1.875, 4px 어긋남 — P2-01·P2-10 실측). 그래서 글자 크기는 14·16·18·20만 고를 수 있다.
// 실제 브라우저 렌더에서 재야 하므로 테스트 전용 페이지 /dev/editor(개발·e2e 서버만, 운영 404)에 같은 CodeEditor를 띄운다.

import { test, expect, type Page } from '@playwright/test';
import { watchCspViolations } from '../support/test';
import {
  CODE_FONT_SIZES,
  CODE_FONT_SIZE_STORAGE_KEY,
  DEFAULT_CODE_FONT_SIZE,
} from '../../src/lib/editor/fontSize';

let violations: string[] = [];
test.beforeEach(async ({ page }) => {
  violations = await watchCspViolations(page);
});
test.afterEach(() => {
  expect(violations, 'CSP 위반이 없어야 함 (B27)').toEqual([]);
});

interface Measure {
  fontSize: string;
  fontFamily: string;
  lineHeight: string;
  ligatures: string;
  monoLoaded: boolean;
  /** 1~7줄 `#`의 x */
  hashX: number[];
  /** 8~10줄 `|`의 x */
  barX: number[];
  /** `파` 한 글자 폭 / `n` 한 글자 폭 */
  ratio: number;
}

/** 에디터 줄에서 글자 범위의 화면 좌표를 잰다 (Range.getBoundingClientRect, 소수 px까지) */
function measure(page: Page): Promise<Measure> {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const lines = [...document.querySelectorAll('.cm-content .cm-line')];
    const rectOf = (line: Element, index: number) => {
      // 줄 안의 글자 위치 → 텍스트 노드와 오프셋 (구문색 span으로 나뉘어 있다)
      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      let rest = index;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const len = n.textContent?.length ?? 0;
        if (rest < len) {
          const r = document.createRange();
          r.setStart(n, rest);
          r.setEnd(n, rest + 1);
          return r.getBoundingClientRect();
        }
        rest -= len;
      }
      throw new Error(`글자 ${index}을 찾지 못함: ${line.textContent}`);
    };
    const xOf = (line: Element, ch: string, from = 0) =>
      rectOf(line, (line.textContent ?? '').indexOf(ch, from)).left;
    const first = lines[0];
    const text = first.textContent ?? '';
    const style = getComputedStyle(document.querySelector('.cm-content')!);
    return {
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      lineHeight: getComputedStyle(document.querySelector('.cm-line')!)
        .lineHeight,
      ligatures: style.fontVariantLigatures,
      monoLoaded: [...document.fonts].some(
        (f) =>
          f.family.replace(/"/g, '') === 'pyRoad Mono' && f.status === 'loaded',
      ),
      hashX: lines.slice(0, 7).map((l) => xOf(l, '#')),
      barX: lines.slice(7, 10).map((l) => xOf(l, '|')),
      ratio:
        rectOf(first, text.indexOf('파')).width /
        rectOf(first, text.indexOf('n')).width,
    };
  });
}

const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);

test.describe('코드 에디터 한글 정렬 (P2-18)', () => {
  for (const size of CODE_FONT_SIZES) {
    test(`${size}px에서 한글 주석의 # 열과 주석 속 표의 | 열이 0px 차이로 맞는다`, async ({
      page,
    }) => {
      await page.addInitScript(
        ([key, value]) => window.localStorage.setItem(key, value),
        [CODE_FONT_SIZE_STORAGE_KEY, String(size)] as const,
      );
      await page.goto('/dev/editor');
      const editor = page.locator('.cm-editor');
      await expect(editor).toHaveAttribute('data-code-font-size', String(size));
      await expect(page.getByTestId('code-font-size-value')).toContainText(
        String(size),
      );

      const m = await measure(page);
      expect(m.monoLoaded, 'pyRoad Mono 조각이 실려야 함').toBe(true);
      expect(m.fontFamily).toMatch(/^"?pyRoad Mono"?/);
      expect(m.fontSize).toBe(`${size}px`);
      expect(parseFloat(m.lineHeight)).toBeCloseTo(size * 1.6, 1);
      expect(m.ligatures).toBe('none');
      expect(m.ratio, '한글 1자 = 영문 2자 폭').toBeCloseTo(2, 3);
      expect(spread(m.hashX), `# x 좌표 ${m.hashX.join(', ')}`).toBe(0);
      expect(spread(m.barX), `| x 좌표 ${m.barX.join(', ')}`).toBe(0);
    });
  }

  test('좁은 화면(360px)·20px에서도 줄이 꺾이지 않고(가로 스크롤) 정렬이 맞는다', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [CODE_FONT_SIZE_STORAGE_KEY, '20'] as const,
    );
    await page.goto('/dev/editor');
    await expect(page.locator('.cm-editor')).toHaveAttribute(
      'data-code-font-size',
      '20',
    );
    const m = await measure(page);
    expect(spread(m.hashX)).toBe(0);
    // 줄마다 한 줄 높이 = 꺾이지 않음
    const heights = await page
      .locator('.cm-content .cm-line')
      .evaluateAll((ls) => ls.map((l) => l.getBoundingClientRect().height));
    for (const h of heights) expect(h).toBeCloseTo(32, 0);
    const scroller = page.locator('.cm-scroller');
    expect(
      await scroller.evaluate((el) => el.scrollWidth > el.clientWidth),
    ).toBe(true);
  });

  test('글자 크기 버튼은 짝수 단계만 오가고 기기에 저장된다', async ({
    page,
  }) => {
    await page.goto('/dev/editor');
    const editor = page.locator('.cm-editor');
    const smaller = page.getByRole('button', { name: '코드 글자 작게' });
    const larger = page.getByRole('button', { name: '코드 글자 크게' });
    await expect(editor).toHaveAttribute(
      'data-code-font-size',
      String(DEFAULT_CODE_FONT_SIZE),
    );

    // 48px 터치 영역
    for (const b of [smaller, larger]) {
      const box = await b.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(48);
      expect(box?.height).toBeGreaterThanOrEqual(48);
    }

    // 16 → 14 → 16 → 18 → 20 (홀수 단계 없음, 양 끝에서 버튼이 꺼짐)
    await smaller.click();
    await expect(editor).toHaveAttribute('data-code-font-size', '14');
    await expect(smaller).toBeDisabled();
    for (const size of CODE_FONT_SIZES.slice(1)) {
      await larger.click();
      await expect(editor).toHaveAttribute('data-code-font-size', String(size));
    }
    await expect(larger).toBeDisabled();

    await page.reload();
    await expect(editor).toHaveAttribute('data-code-font-size', '20');
  });

  for (const width of [360, 1280]) {
    test(`${width}px: 공책 머리(제목·처음 코드로·글자 크기)가 한 줄이고, 처음 코드로는 물어본 뒤 되돌린다 (P6-03)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/dev/editor');
      const title = page.getByRole('heading', { name: '나의 주문 공책' });
      // 확인 창의 같은 이름 버튼과 구분 (닫히는 연출 동안 둘 다 있다)
      const reset = page.getByTestId('reset-code');
      await expect(reset).toHaveAccessibleName('처음 코드로');
      const size = page.getByTestId('code-font-size');
      const mids = await Promise.all(
        [title, reset, size].map(async (l) => {
          const b = (await l.boundingBox())!;
          return b.y + b.height / 2;
        }),
      );
      expect(Math.max(...mids) - Math.min(...mids)).toBeLessThan(4);
      const sizeBox = (await size.boundingBox())!;
      expect(sizeBox.x + sizeBox.width).toBeLessThanOrEqual(width);

      // 처음 코드와 같으면 꺼져 있고, 고치면 켜진다
      await expect(reset).toBeDisabled();
      const content = page.locator('.cm-content');
      await content.click();
      await page.keyboard.insertText('x = 1 ');
      await expect(reset).toBeEnabled();

      await reset.click();
      const dialog = page.getByRole('alertdialog');
      await dialog.getByRole('button', { name: '그대로 두기' }).click();
      await expect(content).toContainText('x = 1');

      await reset.click();
      await dialog.getByRole('button', { name: '처음 코드로' }).click();
      await expect(content).not.toContainText('x = 1');
      await expect(reset).toBeDisabled();
    });
  }

  test('오류 줄 표시는 줄 띠와 줄 번호에 붙고, 코드를 고치면 사라진다', async ({
    page,
  }) => {
    await page.goto('/dev/editor?error=3');
    const errLine = page.locator('.cm-line[data-error-line]');
    await expect(errLine).toHaveCount(1);
    await expect(errLine).toContainText('greeting');
    await expect(
      page.locator('.cm-gutterElement.cm-errorLineGutter'),
    ).toHaveText('3');

    await page.locator('.cm-content').click();
    await page.keyboard.press('End');
    await page.keyboard.insertText(' ');
    await expect(errLine).toHaveCount(0);
  });
});
