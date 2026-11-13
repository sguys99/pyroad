// 모바일 코드 키보드 (P6-04). Phase 6 완료 기준: "360px 모바일에서 키보드 툴바로 1월드 1~2스테이지 퀘스트를 끝까지 풀 수 있다"
//
// 360×740 터치 화면에서 1·2스테이지 코드 퀘스트를 차례로 연다. 각 퀘스트는 정답 코드(content/ YAML)를 처음부터 다시 쓰는데,
// 기호·주문은 모두 코드 키보드를 탭해서 넣고, 폰 키보드로 치는 것은 글자·숫자·띄어쓰기·문장 부호(! ? .)·줄 바꿈(Enter)만.
// 짝 기호(" " · ( ) · print())는 한 쌍이 들어가므로 닫는 짝은 다시 치지 않고 → 키로 건너간다 (아이가 실제로 하는 방법)
// 시작 코드는 전체 선택 후 지우고 시작한다(폰에서는 길게 눌러 전체 선택 → 지우기)

import { test, expect } from './support/test';
import { stage } from './support/content';
import { completeQuests } from './support/admin';
import { outputPanel, runButton, waitForRunner } from './support/quest';
import type { Page } from '@playwright/test';

// 주문 키 (넣으면 닫는 괄호까지 들어감)
const SPELLS: Record<string, string> = {
  'print(': 'print 주문 넣기',
  'input(': 'input 주문 넣기',
  'str(': 'str 주문 넣기',
  'int(': 'int 주문 넣기',
};
// 한 글자 기호 키
const SYMBOLS: Record<string, string> = {
  '=': '같다 기호 넣기',
  '+': '더하기 기호 넣기',
  '-': '빼기 기호 넣기',
  _: '밑줄 넣기',
  ',': '쉼표 넣기',
  ':': '쌍점 넣기',
  "'": '작은따옴표 넣기',
  '#': '메모 기호 넣기',
  ')': '닫는 괄호 넣기',
};
// 폰 키보드 첫 화면에서 바로 치는 글자
const TYPED = /^[\p{L}\p{N} !?.]$/u;

/** 정답 코드를 코드 키보드 + 글자 타자로 쓴다. 키를 몇 번 탭했는지 돌려준다 */
async function writeWithKeyboard(page: Page, code: string): Promise<number> {
  const keyboard = page.getByRole('toolbar', { name: '코드 키보드' });
  let taps = 0;
  const tap = async (name: string) => {
    await keyboard.getByRole('button', { name, exact: true }).tap();
    taps++;
  };
  // 커서 뒤에 키보드가 미리 넣어 둔 닫는 짝들
  let ahead = '';
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    const rest = code.slice(i);
    const spell = Object.keys(SPELLS).find(
      (s) => rest.startsWith(s) && !/\w/.test(code[i - 1] ?? ''),
    );
    if (ahead.startsWith(c)) {
      await tap('커서 오른쪽으로');
      ahead = ahead.slice(1);
      i++;
    } else if (spell) {
      await tap(SPELLS[spell]);
      ahead = ')' + ahead;
      i += spell.length;
    } else if (rest.startsWith('\\n')) {
      await tap('줄바꿈 글자 넣기');
      i += 2;
    } else if (c === '"') {
      await tap('따옴표 한 쌍 넣기');
      ahead = '"' + ahead;
      i++;
    } else if (c === '(') {
      await tap('괄호 한 쌍 넣기');
      ahead = ')' + ahead;
      i++;
    } else if (SYMBOLS[c]) {
      await tap(SYMBOLS[c]);
      i++;
    } else if (c === '\n') {
      expect(ahead, '줄 끝에서는 닫는 짝이 남지 않음').toBe('');
      // 자동 완성 목록이 열려 있으면 Enter가 목록을 고르므로 닫는다 (폰도 같음, P6-11 메모)
      if (await page.locator('.cm-tooltip-autocomplete').isVisible())
        await page.keyboard.press('Escape');
      await page.keyboard.press('Enter');
      i++;
    } else {
      expect(c, `"${c}"는 코드 키보드에 있어야 함`).toMatch(TYPED);
      await page.keyboard.type(c);
      i++;
    }
  }
  expect(ahead).toBe('');
  return taps;
}

test.describe('모바일 코드 키보드 (360px 터치)', () => {
  test.use({
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
  });

  test('키보드 툴바로 1월드 1~2스테이지 퀘스트를 끝까지 푼다', async ({
    page,
    e2eUser,
  }) => {
    const quests = [...stage(1).quests, ...stage(2).quests];
    test.setTimeout(60_000 + quests.length * 30_000);

    for (const quest of quests) {
      await test.step(`${quest.title}`, async () => {
        // 2단계는 1단계 보스(P9-12)를 이겨야 열림 — 보스 화면은 boss-battle 스펙, 여기서는 서버로 끝내 둠
        const boss = stage(1).boss;
        if (boss && quest.id === stage(2).quests[0].id)
          await completeQuests(e2eUser.id, [{ id: boss.id, solution: '' }]);
        await page.goto(`/quest/${quest.id}`);
        await page.getByRole('tab', { name: /공책/ }).tap();
        await waitForRunner(page);

        const keyboard = page.getByRole('toolbar', { name: '코드 키보드' });
        await expect(keyboard).toBeVisible();

        // 시작 코드 지우기
        await page.locator('.cm-editor .cm-content').tap();
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.press('Backspace');

        const taps = await writeWithKeyboard(page, quest.solution);
        expect(taps).toBeGreaterThan(0);
        // 키를 눌러도 포커스는 에디터에 (폰 키보드가 닫히지 않음)
        await expect(page.locator('.cm-content')).toBeFocused();
        await expect(page.locator('.cm-content')).toHaveText(
          quest.solution.replace(/\n/g, ''),
        );

        // 완료 기록이 끝나야 다음 스테이지가 열린다 (바로 넘어가면 요청이 끊김)
        const completed = page.waitForResponse(
          (r) => r.url().includes('/api/quest/complete') && r.ok(),
        );
        await runButton(page).tap();
        const output = outputPanel(page);
        await expect(output).toHaveAttribute('data-state', 'success', {
          timeout: 30_000,
        });
        await expect(output).toContainText('정답이에요!');
        await completed;
      });
    }
  });

  test('에디터를 누르기 전에도 키를 누르면 시작 코드 뒤에 들어간다', async ({
    page,
  }) => {
    const quest = stage(1).quests[0];
    await page.goto(`/quest/${quest.id}`);
    await page.getByRole('tab', { name: /공책/ }).tap();
    const keyboard = page.getByRole('toolbar', { name: '코드 키보드' });
    await keyboard.getByRole('button', { name: 'print 주문 넣기' }).tap();
    await keyboard.getByRole('button', { name: '따옴표 한 쌍 넣기' }).tap();
    await expect(page.locator('.cm-content')).toBeFocused();
    await expect(page.locator('.cm-line').last()).toHaveText('print("")');
    await keyboard.getByRole('button', { name: '되돌리기' }).tap();
    await expect(page.locator('.cm-line').last()).toHaveText('print()');
  });
});

test('넓은 화면 + 마우스에서는 코드 키보드를 받지 않는다', async ({ page }) => {
  const quest = stage(1).quests[0];
  await page.goto(`/quest/${quest.id}`);
  await expect(page.locator('.cm-editor')).toBeVisible();
  await expect(page.getByTestId('code-keyboard')).toHaveCount(0);
});
