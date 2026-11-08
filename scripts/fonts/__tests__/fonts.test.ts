import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ROOT,
  collectDisplayText,
  collectLandingText,
  cssFontClasses,
  parseModule,
  subsetText,
} from '../landing-text.mjs';
import { inspectSfnt, inspectWoff2 } from '../woff2.mjs';
import {
  EXTERNAL_FONT_PATTERNS,
  findDeclaredWeight,
  findMissingLandingChars,
  findMissingShareCardChars,
  findReservedNames,
} from '../check.mjs';
import { nicknameChars } from '../share-card-chars.mjs';
import {
  classifyFontFaces,
  findMissingGlyphs,
  findPreloadLeaks,
  fontFamilyRules,
  staticFile,
  textByFont,
} from '../check-build.mjs';

const fontFile = (p: string) => readFileSync(join(ROOT, 'src/fonts', p));

describe('WOFF2 읽기 (P2-10)', () => {
  it('랜딩 서브셋의 cmap과 이름을 읽는다', () => {
    const jua = inspectWoff2(fontFile('jua/Jua-landing.woff2'));
    expect(jua.names[1]).toBe('Jua');
    for (const ch of 'pyRoad 파이뱀') {
      expect(jua.codepoints.has(ch.codePointAt(0)!)).toBe(true);
    }
    // 랜딩에 없는 드문 글자는 서브셋에 없다
    expect(jua.codepoints.has('똠'.codePointAt(0)!)).toBe(false);
  });

  it('이름을 바꾼 글꼴에는 예약 이름이 이름 레코드에 남지 않는다', () => {
    const sans = inspectWoff2(fontFile('pyroad-sans/pyRoadSans-landing.woff2'));
    expect(sans.names[1]).toBe('pyRoad Sans');
    expect(sans.names[6]).toBe('pyRoadSans-Regular');
    expect(findReservedNames(sans.names, ['Pretendard'])).toEqual([]);
    // 저작권·상표 고지(0·7)는 원문 그대로
    expect(sans.names[7]).toContain('Pretendard');

    const mono = inspectWoff2(
      fontFile('pyroad-mono/slices/pyRoadMono.0.woff2'),
    );
    expect(mono.names[1]).toBe('pyRoad Mono');
    expect(findReservedNames(mono.names, ['D2Coding'])).toEqual([]);
  });
});

describe('랜딩 글자 검사', () => {
  it('서브셋에 없는 글자만 고르고, 원본에 없다고 기록된 글자는 허용한다', () => {
    const cps = new Set([...'가나'].map((c) => c.codePointAt(0)!));
    expect(
      findMissingLandingChars(['가', '나', '다', '🐍'], cps, '🐍'),
    ).toEqual(['다']);
  });

  it('랜딩 페이지에서 import를 따라가며 문구를 모은다', () => {
    const { files, chars, displayChars, dynamicFiles } = collectLandingText();
    expect(files).toContain('src/components/landing/hero/HeroSection.tsx');
    expect(files).not.toContain('src/app/(protected)/layout.tsx');
    // 로그인 시트는 동적 import로만 닿는다
    expect(dynamicFiles).toContain('src/components/auth/LoginSheet.tsx');
    for (const ch of '파이썬 모험') {
      if (ch !== ' ') expect(chars).toContain(ch);
    }
    // 제목 글자는 히어로 제목을 담고, 본문 글자의 부분집합이며 훨씬 적다 (P4-12)
    for (const ch of '모험지도') expect(displayChars).toContain(ch);
    const all = new Set(chars);
    expect(displayChars.every((c: string) => all.has(c))).toBe(true);
    expect(displayChars.length).toBeLessThan(chars.length * 0.6);
  });

  it('서브셋 글자열: 본문은 ASCII 전부, 제목은 숫자·문장부호 + 나온 영문의 대·소문자만', () => {
    const r = { chars: ['가', 'z'], displayChars: ['가', 'p'] };
    const sans = subsetText('all', r);
    expect(sans).toContain('~');
    expect(sans).toContain('Q');
    expect(sans).toContain('가');
    const display = subsetText('display', r);
    for (const ch of '0189!?p가P ') expect(display).toContain(ch);
    expect(display).not.toContain('Q');
    expect(display).not.toContain('z');
  });

  it('외부 폰트 출처를 잡는다', () => {
    const hit = (s: string) => EXTERNAL_FONT_PATTERNS.some((re) => re.test(s));
    expect(hit("import { Jua } from 'next/font/google'")).toBe(true);
    expect(hit('https://fonts.googleapis.com/css2?family=Jua')).toBe(true);
    expect(
      hit('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/x.css'),
    ).toBe(true);
    expect(hit('https://cdn.jsdelivr.net/pyodide/v314.0.7/')).toBe(false);
  });
});

describe('제목 글꼴 자리 찾기 (P4-12)', () => {
  const display = (
    sources: Record<string, string>,
    cssClasses?: ReturnType<typeof cssFontClasses>,
  ) =>
    collectDisplayText(
      Object.entries(sources).map(([f, src]) => parseModule(f, src)),
      { cssClasses },
    ).join('|');

  it('h1~h3·font-display 아래 글자만, 안쪽 font-sans·숨은 속성·비교식은 뺀다', () => {
    const got = display({
      'a.tsx': `
        export function A({ x }) {
          return (
            <main>
              <h1 aria-label="숨김">제목<span className="font-sans">본문안</span></h1>
              <p className={cn('lead', ok && 'font-display')}>표시글</p>
              <p>그냥본문</p>
              <h2 className="font-sans">산스제목</h2>
              <h3>{x === '비교' ? '참' : '거짓'}</h3>
            </main>
          );
        }`,
    });
    for (const t of ['제목', '표시글', '참', '거짓']) expect(got).toContain(t);
    for (const t of ['숨김', '본문안', '그냥본문', '산스제목', '비교'])
      expect(got).not.toContain(t);
  });

  it('props·children·{...props}·데이터 속성·객체 조회를 따라간다', () => {
    const got = display({
      'ui.tsx': `
        function Shell({ title, description }) {
          return <div><h2>{title}</h2><p>{description}</p></div>;
        }
        export function Sheet({ wide, ...props }) { return <Shell {...props} />; }
        export function Btn({ children, icon }) {
          return <button><span className="font-display">{children}</span></button>;
        }`,
      'page.tsx': `
        const FRIENDS = [{ name: '파이뱀', line: '대사는본문' }];
        const HEADINGS = { hero: '시트제목' };
        export function Page({ ctx }) {
          return (
            <>
              <Sheet title={HEADINGS[ctx]} description="설명은본문" />
              <Btn>눌러봐</Btn>
              {FRIENDS.map((f) => <h3 key={f.name}>{f.name}</h3>)}
            </>
          );
        }`,
    });
    for (const t of ['시트제목', '눌러봐', '파이뱀']) expect(got).toContain(t);
    for (const t of ['설명은본문', '대사는본문']) expect(got).not.toContain(t);
  });

  it('CSS에서 @apply font-display한 클래스도 제목 자리로 본다', () => {
    const css = cssFontClasses(`
      @layer components {
        .ld-x { @apply font-display; color: red; }
        .ld-y:hover, .ld-z { @apply font-sans; }
      }`);
    expect([...css.display]).toEqual(['ld-x']);
    expect([...css.sans].sort()).toEqual(['ld-y', 'ld-z']);
    const got = display(
      {
        'a.tsx': `export const A = () => <div><p className="ld-x">씨에스에스</p><p>아님</p></div>;`,
      },
      css,
    );
    expect(got).toContain('씨에스에스');
    expect(got).not.toContain('아님');
  });
});

describe('빌드 뒤 확인', () => {
  it('렌더된 HTML 글자를 CSS 캐스케이드대로 제목·본문으로 나눈다 (P4-12)', async () => {
    const css = `@layer theme,base,components,utilities;
      @layer base{html,:host{font-family:ui-sans-serif}html{font-family:var(--font-sans-landing,"pyRoad Sans"),"pyRoad Sans"}h1,h2,h3{font-family:var(--font-display-landing,"Jua"),"Jua"}code{font-family:pyRoad Mono,monospace}}
      @layer utilities{.font-display{font-family:var(--font-display-landing,"Jua"),"Jua"}.font-sans{font-family:var(--font-sans-landing,"pyRoad Sans")}}`;
    const rules = fontFamilyRules(css);
    expect(rules.map((r) => `${r.selector}:${r.kind}:${r.layer}`)).toEqual([
      'html:other:1',
      ':host:other:1',
      'html:sans:1',
      'h1:display:1',
      'h2:display:1',
      'h3:display:1',
      'code:mono:1',
      '.font-display:display:3',
      '.font-sans:sans:3',
    ]);
    const html = `<html><body><div class="landing">
      <h1>제목<span class="font-sans">작은</span></h1>
      <h2 class="font-sans">산스</h2>
      <p>본문 <b class="font-display">굵게</b> <code>x</code></p>
      <span class="sr-only">숨김</span><script>var s="스크립트"</script>
    </div></body></html>`;
    const used = await textByFont(html, rules);
    expect(used.display.text.replace(/\s/g, '')).toBe('제목굵게');
    expect(used.sans.text.replace(/\s/g, '')).toBe('작은산스본문');
    expect(used.mono.text).toBe('x');

    const cps = new Set([...'제목'].map((c) => c.codePointAt(0)!));
    expect(findMissingGlyphs(used.display, cps, '')).toEqual({
      missing: ['굵', '게'],
      samples: ['굵게'],
    });
    expect(findMissingGlyphs(used.display, cps, '굵게').missing).toEqual([]);
  });

  it('landing.ts의 굵기 선언을 서브셋 파일별로 읽는다', () => {
    const src = readFileSync(join(ROOT, 'src/fonts/landing.ts'), 'utf8');
    expect(findDeclaredWeight(src, 'jua/Jua-landing.woff2')).toBe('100 900');
    expect(
      findDeclaredWeight(src, 'pyroad-sans/pyRoadSans-landing.woff2'),
    ).toBe('400 700');
    expect(findDeclaredWeight(src, 'nope.woff2')).toBeNull();
  });

  it('랜딩이 아닌 라우트의 preload를 누수로 본다', () => {
    expect(
      findPreloadLeaks({
        app: {
          '[project]/src/app/page': ['a.woff2', 'b.woff2'],
          '[project]/src/app/(protected)/world/page': [],
          '[project]/src/app/notice/page': ['a.woff2'],
        },
      }),
    ).toEqual(['[project]/src/app/notice/page: a.woff2']);
  });

  it('@font-face를 조각·단일 파일·local 폴백으로 나눈다', () => {
    const css = `
      @font-face{font-family:"Jua";src:url(../media/Jua.0.woff2) format("woff2");unicode-range:U+ac00}
      @font-face{font-family:"Jua";src:url(../media/Jua.1.woff2) format("woff2");unicode-range:U+ac01}
      @font-face{font-family:displayLanding;src:url(../media/Jua_landing.woff2) format("woff2")}
      @font-face{font-family:"Jua Fallback Malgun";src:local("Malgun Gothic");size-adjust:81%;unicode-range:U+ac00-d7a3}`;
    expect(classifyFontFaces(css)).toEqual({
      slices: { Jua: 2 },
      files: ['../media/Jua_landing.woff2'],
      locals: 1,
    });
  });
});

describe('글꼴 토큰 (globals.css)', () => {
  const css = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8');

  it('새 토큰 셋이 있고 예전 토큰은 없다', () => {
    for (const token of ['--font-display:', '--font-sans:', '--font-mono:']) {
      expect(css).toContain(token);
    }
    for (const old of ['--font-heading', '--font-noto', '--font-jetbrains']) {
      expect(css).not.toContain(old);
    }
  });
});

describe('공유 카드 폰트 검사 (P2-19)', () => {
  it('빠진 닉네임 글자를 찾는다 (2,350자 + 영문·숫자, full은 11,172자까지)', () => {
    const ks = new Set(nicknameChars().map((c: string) => c.codePointAt(0)!));
    expect(findMissingShareCardChars(ks, 'ks2350')).toEqual([]);
    expect(findMissingShareCardChars(ks, 'full')).toHaveLength(11172 - 2350);
    ks.delete('가'.codePointAt(0)!);
    ks.delete('7'.codePointAt(0)!);
    expect(findMissingShareCardChars(ks, 'ks2350')).toEqual(['가', '7']);
  });

  it('TTF/OTF의 cmap과 이름을 읽는다', () => {
    const jua = inspectSfnt(fontFile('share-card/jua/Jua-KS2350.ttf'));
    expect(jua.names[1]).toBe('Jua');
    expect(jua.codepoints.has('똠'.codePointAt(0)!)).toBe(false);
    expect(jua.codepoints.has('힝'.codePointAt(0)!)).toBe(true);
    expect(() => inspectSfnt(fontFile('jua/Jua-landing.woff2'))).toThrow();
  });
});

describe('빌드 검사 정적 파일 경로 (B42)', () => {
  it('Vercel이 붙이는 ?dpl= 쿼리와 해시를 떼고 .next/static 파일로 본다', () => {
    const plain = staticFile('/_next/static/chunks/a1b2.css');
    expect(staticFile('/_next/static/chunks/a1b2.css?dpl=dpl_F6FZzgpV')).toBe(
      plain,
    );
    expect(staticFile('/_next/static/media/x.woff2#iefix')).toBe(
      staticFile('/_next/static/media/x.woff2'),
    );
    expect(plain.endsWith(join('.next', 'static', 'chunks', 'a1b2.css'))).toBe(
      true,
    );
  });
});
