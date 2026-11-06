import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT, collectLandingText } from '../landing-text.mjs';
import { inspectSfnt, inspectWoff2 } from '../woff2.mjs';
import {
  EXTERNAL_FONT_PATTERNS,
  findMissingLandingChars,
  findMissingShareCardChars,
  findReservedNames,
} from '../check.mjs';
import { nicknameChars } from '../share-card-chars.mjs';
import { classifyFontFaces, findPreloadLeaks } from '../check-build.mjs';

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
    const { files, chars } = collectLandingText();
    expect(files).toContain('src/components/landing/HeroSection.tsx');
    expect(files).not.toContain('src/app/(protected)/layout.tsx');
    for (const ch of '파이썬 모험') {
      if (ch !== ' ') expect(chars).toContain(ch);
    }
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

describe('빌드 뒤 확인', () => {
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
