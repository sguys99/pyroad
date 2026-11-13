// 퀴즈 입력을 화면에서 넣는다 (P7-15 quiz-mobile 에서 옮김, P9-12 보스 배틀도 같은 입력 컴포넌트). 값 모양은 content/README 퀴즈 정규형
import type { Locator, Page } from '@playwright/test';

export interface QuizInputKey {
  kind: string;
  /** 공개 퀴즈 (prompt_skeleton.quiz 또는 보스 rounds[i]) */
  quiz: Record<string, unknown>;
}

const blanks = (code: string) =>
  [...code.matchAll(/\{\{([^{}]+)\}\}/g)].map((m) => m[1]);

/** card 안에 답을 넣는다. touch 면 탭(360 휴대폰), 아니면 클릭 */
export async function enterQuizAnswer(
  page: Page,
  card: Locator,
  key: QuizInputKey,
  answer: unknown,
  touch = true,
) {
  const press = (l: Locator) => (touch ? l.tap() : l.click());
  switch (key.kind) {
    case 'multiple_choice':
      await press(
        card
          .getByTestId('quiz-option')
          .filter({ has: page.locator(`input[value="${answer as string}"]`) }),
      );
      return;
    case 'fill_blank': {
      const fill = answer as Record<string, string>;
      const tokens = key.quiz.tokens as { id: string; text: string }[];
      for (const b of blanks(key.quiz.code as string)) {
        const text = tokens.find((t) => t.id === fill[b])!.text;
        await press(
          card.getByTestId('quiz-token').filter({
            has: page.locator('code').getByText(text, { exact: true }),
          }),
        );
      }
      return;
    }
    case 'parsons': {
      const lines = answer as (string | { id: string; indent: number })[];
      for (const [i, x] of lines.entries()) {
        const id = typeof x === 'string' ? x : x.id;
        await press(card.locator(`[data-tray="${id}"]`));
        for (let k = 0; typeof x !== 'string' && k < x.indent; k++)
          await press(
            card.getByRole('button', {
              name: `${i + 1}번째 줄 들여쓰기 늘리기`,
            }),
          );
      }
      return;
    }
    case 'bug_hunt': {
      const { line, fix } = answer as { line: string; fix: string };
      await press(
        card
          .getByTestId('bughunt-line')
          .filter({ has: page.locator(`input[value="${line}"]`) }),
      );
      await press(
        card
          .getByTestId('bughunt-fix')
          .filter({ has: page.locator(`input[value="${fix}"]`) }),
      );
      return;
    }
  }
  throw new Error(`[e2e] 모르는 퀴즈 종류 ${key.kind}`);
}
