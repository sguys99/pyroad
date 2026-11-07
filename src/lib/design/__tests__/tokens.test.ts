import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  COLOR,
  CONTRAST_MIN,
  CONTRAST_PAIRS,
  FONT_FAMILY,
  MIN_TEXT_PX,
  TYPE,
  WORLD_THEMES,
  colorVarName,
  contrastRatio,
  fmtRatio,
  pairBackground,
  pairContrast,
  rootCssVars,
  themeCssVars,
  worldCssVars,
  type ColorName,
  type WorldId,
} from '../tokens';
import { DEFAULT_CONCEPT, JELLY_BY_CONCEPT } from '@/lib/motion/tokens';
import { STYLE_RULES, DEFAULT_RIG_STYLE } from '@/components/characters/rig/style';
import { PYBAEM_PALETTES } from '@/components/characters/rig/pybaem/Markup';

const CSS = readFileSync(
  join(__dirname, '../../../app/globals.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

/** 공백을 하나로, 괄호 안쪽 공백 제거, hex 소문자 (prettier 줄바꿈·소문자 변환과 상관없이 비교) */
const norm = (v: string) =>
  v
    .replace(/#[0-9a-f]{3,8}\b/gi, (h) => h.toLowerCase())
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();

/** 선택자로 시작하는 첫 블록의 사용자 정의 속성 (중첩 없는 블록만) */
function block(selector: string): Record<string, string> {
  const start = CSS.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`globals.css에 ${selector} 블록이 없다`);
  const end = CSS.indexOf('\n}', start);
  const body = CSS.slice(CSS.indexOf('{', start) + 1, end);
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    vars[m[1]] = norm(m[2]);
  }
  return vars;
}

function expectSameVars(
  actual: Record<string, string>,
  expected: Record<string, string>,
  where: string,
) {
  const want = Object.fromEntries(
    Object.entries(expected).map(([k, v]) => [k, norm(v)]),
  );
  const extra = Object.keys(actual).filter((k) => !(k in want));
  const missing = Object.keys(want).filter((k) => !(k in actual));
  const diff = Object.keys(want)
    .filter((k) => k in actual && actual[k] !== want[k])
    .map((k) => `${k}: css=${actual[k]} ts=${want[k]}`);
  expect(
    { extra, missing, diff },
    `${where}가 src/lib/design/tokens.ts와 다르다`,
  ).toEqual({ extra: [], missing: [], diff: [] });
}

describe('디자인 토큰 ↔ globals.css 드리프트 (P2-09)', () => {
  it(':root 변수가 TS 원본과 같다 (빠진 것·남는 것·다른 값 없음)', () => {
    expectSameVars(block(':root'), rootCssVars(), 'globals.css :root');
  });

  it('@theme inline의 Tailwind 변수가 TS 원본과 같다 (글꼴 --font-*은 P2-10 소관)', () => {
    const theme = block('@theme inline');
    const fonts = Object.keys(theme).filter((k) => k.startsWith('--font-'));
    expect(fonts.sort()).toEqual(['--font-display', '--font-mono', '--font-sans']);
    for (const k of fonts) delete theme[k];
    expectSameVars(theme, themeCssVars(), 'globals.css @theme inline');
  });

  it('글꼴 스택 첫 이름이 TS FONT_FAMILY와 같다', () => {
    const theme = block('@theme inline');
    expect(theme['--font-display']).toContain(`'${FONT_FAMILY.display}'`);
    expect(theme['--font-sans']).toContain(`'${FONT_FAMILY.sans}'`);
    expect(theme['--font-mono'].startsWith(`'${FONT_FAMILY.mono}'`)).toBe(true);
  });

  it('[data-world="1|2|3"]는 월드 틴트 3개만 바꾼다', () => {
    for (const id of [1, 2, 3] as WorldId[]) {
      expectSameVars(
        block(`[data-world='${id}']`),
        worldCssVars(id),
        `globals.css [data-world='${id}']`,
      );
    }
    // 속성이 없으면 월드 1
    const root = rootCssVars();
    expect(root['--world-soft']).toBe(worldCssVars(1)['--world-soft']);
  });

  it('다크 모드 변수를 두지 않는다 (범위 밖, 대비 검사가 라이트만 본다)', () => {
    expect(CSS).not.toMatch(/\.dark\s*\{/);
  });

  it('색 변수 이름 규칙: 숫자 앞에 하이픈, 월드는 w1-ink', () => {
    expect(colorVarName('surface2')).toBe('--surface-2');
    expect(colorVarName('w1Ink')).toBe('--w1-ink');
    expect(colorVarName('primaryText')).toBe('--primary-text');
  });
});

describe('대비 (WCAG AA, P2-09)', () => {
  it.each(CONTRAST_PAIRS.map((p) => [p.use, p] as const))(
    '%s',
    (_use, p) => {
      const r = pairContrast(p);
      expect(
        r + 1e-9,
        `${p.fg} ${COLOR[p.fg]} on ${p.bg} ${pairBackground(p)} = ${fmtRatio(r)}:1 (기준 ${CONTRAST_MIN[p.kind]})`,
      ).toBeGreaterThanOrEqual(CONTRAST_MIN[p.kind]);
    },
  );

  it('글자를 얹는 토큰은 모두 표에 있다 (장식 전용 토큰은 글자 조합에 안 쓴다)', () => {
    const decorOnly: ColorName[] = [
      'line',
      'surfaceLip',
      'primaryLip',
      'primaryBright',
      'accent',
      'accentLip',
      'accentLight',
      'w1',
      'w2',
      'w3',
    ];
    for (const p of CONTRAST_PAIRS) {
      if (p.kind === 'ui') continue;
      expect(decorOnly, `${p.use}: ${p.fg}는 장식 전용`).not.toContain(p.fg);
    }
    const fgs = new Set(CONTRAST_PAIRS.map((p) => p.fg));
    for (const name of [
      'text',
      'textMuted',
      'primaryText',
      'onPrimary',
      'accentText',
      'onAccent',
      'error',
      'onScrim',
      'w1Ink',
      'w2Ink',
      'w3Ink',
      'codeComment',
    ] as ColorName[]) {
      expect(fgs.has(name), name).toBe(true);
    }
  });

  it('지금 앱의 브랜드 초록 #31983d는 미달이었고 새 토큰은 통과한다 (P0-13)', () => {
    const legacy = '#31983d';
    expect(contrastRatio('#ffffff', legacy)).toBeLessThan(4.5);
    expect(contrastRatio(legacy, '#f8f5ee')).toBeLessThan(4.5);
    expect(contrastRatio(COLOR.onPrimary, COLOR.primary)).toBeGreaterThan(5);
    expect(contrastRatio(COLOR.primaryText, COLOR.bg)).toBeGreaterThan(5);
    // 예전 amber-600 on amber-50 (3.08:1) 대신 금색 글자 on 금색 틴트
    expect(contrastRatio(COLOR.warning, COLOR.warningSoft)).toBeGreaterThan(5);
  });
});

describe('타이포 스케일', () => {
  it('모든 단계가 14px 이상, 본문 17px · 행간 1.7', () => {
    for (const [name, step] of Object.entries(TYPE)) {
      expect(step.size, name).toBeGreaterThanOrEqual(MIN_TEXT_PX);
    }
    expect(TYPE.body).toMatchObject({ size: 17, lineHeight: 1.7, font: 'sans' });
    // D2Coding은 짝수 px에서만 한글 2칸이 맞는다
    expect(TYPE.code.size % 2).toBe(0);
  });

  it('globals.css body 기본값이 TYPE.body와 같다', () => {
    expect(CSS).toMatch(
      new RegExp(`font-size:\\s*${TYPE.body.size / 16}rem;\\s*line-height:\\s*${TYPE.body.lineHeight};`),
    );
  });
});

describe('모션·리그와의 연결', () => {
  it('기본 젤리 = 최종 시안 B = 리그 기본 스타일의 젤리', () => {
    expect(DEFAULT_CONCEPT).toBe('b');
    expect(DEFAULT_RIG_STYLE).toBe('B');
    expect(STYLE_RULES[DEFAULT_RIG_STYLE].jelly).toBe(
      JELLY_BY_CONCEPT[DEFAULT_CONCEPT],
    );
  });

  it('리그 B 팔레트의 그림자·외곽선 규칙이 토큰과 맞다 (몸색은 캐릭터 고유색이라 별개)', () => {
    // 바닥 그림자는 입력 경계와 같은 회갈색
    expect(PYBAEM_PALETTES.B.shadow).toBe(COLOR.lineStrong);
    // 외곽선은 몸색의 진한 톤 (토큰 색이 아님), 눈·입 잉크는 본문 글자색 수준으로 짙다
    expect(STYLE_RULES.B.tonal).toBe(true);
    expect(contrastRatio(PYBAEM_PALETTES.B.ink, COLOR.surface)).toBeGreaterThan(
      contrastRatio(COLOR.textMuted, COLOR.surface),
    );
  });

  it('월드 테마 표의 토큰이 모두 있다', () => {
    for (const t of Object.values(WORLD_THEMES)) {
      for (const name of [t.tint, t.ink, t.soft]) expect(COLOR[name]).toBeTruthy();
    }
  });
});
