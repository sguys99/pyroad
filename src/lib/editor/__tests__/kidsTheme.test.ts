import { describe, it, expect } from 'vitest';
import { highlightTree } from '@lezer/highlight';
import { pythonLanguage } from '@codemirror/lang-python';
import {
  CONTRAST_MIN,
  fmtRatio,
  pairContrast,
  rootCssVars,
} from '@/lib/design/tokens';
import {
  EDITOR_CONTRAST_PAIRS,
  KIDS_THEME_SPEC,
  TOKEN_CLASS,
  kidsHighlighter,
} from '../kidsTheme';
import { CODE_LINE_HEIGHT } from '../fontSize';

const entries = Object.entries(KIDS_THEME_SPEC);
const allValues = entries.flatMap(([, style]) => Object.values(style));

/** 색 리터럴: hex·rgb()·hsl()·oklch() … 이름 색(white·black 등) */
const COLOR_LITERAL =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(|\b(?:white|black|red|green|blue|gray|grey)\b/i;

describe('CodeMirror 키즈 테마 (P2-18)', () => {
  it('색은 디자인 토큰 CSS 변수만 쓴다 (색 리터럴 없음)', () => {
    for (const v of allValues) expect(v).not.toMatch(COLOR_LITERAL);
  });

  it('가리키는 CSS 변수는 모두 globals.css :root에 있는 토큰이다', () => {
    const known = new Set(Object.keys(rootCssVars()));
    known.add('--font-mono'); // 글꼴 변수는 P2-10 소관 (globals.css @theme)
    const used = new Set(
      allValues.flatMap((v) =>
        [...v.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]),
      ),
    );
    expect(used.size).toBeGreaterThan(10);
    for (const name of used) expect(known, name).toContain(name);
  });

  it('구문색은 주석·키워드·문자열 3종 + 본문색이고 굵게·기울임이 없다', () => {
    const colorOf = (cls: string) => KIDS_THEME_SPEC[`.${cls}`].color;
    expect(colorOf(TOKEN_CLASS.comment)).toBe('var(--code-comment)');
    expect(colorOf(TOKEN_CLASS.keyword)).toBe('var(--code-keyword)');
    expect(colorOf(TOKEN_CLASS.string)).toBe('var(--code-string)');
    expect(colorOf(TOKEN_CLASS.number)).toBe('var(--code-number)');
    expect(colorOf(TOKEN_CLASS.func)).toBe('var(--code-func)');
    for (const style of Object.values(KIDS_THEME_SPEC)) {
      expect(style.fontWeight).toBeUndefined();
      expect(style.fontStyle ?? 'normal').toBe('normal');
    }
  });

  it('글꼴은 pyRoad Mono 토큰, 리거처 끔, 행간 1.6', () => {
    const root = KIDS_THEME_SPEC['&'];
    expect(root.fontFamily).toBe('var(--font-mono)');
    expect(root.fontVariantLigatures).toBe('none');
    // CodeMirror 기본 테마가 .cm-scroller에 monospace·행간 1.4를 넣으므로 거기도 덮어야 한다
    expect(KIDS_THEME_SPEC['.cm-scroller'].fontFamily).toBe('var(--font-mono)');
    expect(KIDS_THEME_SPEC['.cm-scroller'].lineHeight).toBe('1.6');
    expect(CODE_LINE_HEIGHT).toBe(1.6);
    // 글자 크기는 테마에 고정하지 않는다 (codeFontSizeTheme이 짝수 단계로만 넣음)
    expect(root.fontSize).toBeUndefined();
  });

  it('틴트 면 위 주석은 textMuted로 진하게 바꾼다', () => {
    const rule = entries.find(([sel]) =>
      sel.includes('.cm-errorLine .pr-tok-comment'),
    );
    expect(rule?.[1].color).toBe('var(--text-muted)');
    for (const s of [
      '.cm-activeLine',
      '.cm-searchMatch',
      '.cm-selectionMatch',
    ]) {
      expect(rule?.[0]).toContain(`${s} .${TOKEN_CLASS.comment}`);
    }
  });

  it('파이썬 구문을 키워드·문자열·주석 클래스로 나눈다', () => {
    const code = 'for i in range(3):  # 반복\n    print("안녕", True, None)\n';
    const tree = pythonLanguage.parser.parse(code);
    const spans: Record<string, string[]> = {};
    highlightTree(tree, kidsHighlighter, (from, to, classes) => {
      for (const c of classes.split(' '))
        (spans[c] ??= []).push(code.slice(from, to));
    });
    expect(spans[TOKEN_CLASS.keyword]).toEqual(
      expect.arrayContaining(['for', 'in', 'True', 'None']),
    );
    expect(spans[TOKEN_CLASS.string]).toEqual(['"안녕"']);
    expect(spans[TOKEN_CLASS.comment]).toEqual(['# 반복']);
    expect(spans[TOKEN_CLASS.number]).toEqual(['3']);
  });

  it.each(EDITOR_CONTRAST_PAIRS.map((p) => [`${p.use}: ${p.fg}`, p] as const))(
    '대비 AA — %s',
    (_, pair) => {
      const ratio = pairContrast(pair);
      expect(
        ratio,
        `${pair.fg} / ${pair.bg}${pair.over ? `(${pair.alpha} over ${pair.over})` : ''} = ${fmtRatio(ratio)}`,
      ).toBeGreaterThanOrEqual(CONTRAST_MIN[pair.kind]);
    },
  );
});
