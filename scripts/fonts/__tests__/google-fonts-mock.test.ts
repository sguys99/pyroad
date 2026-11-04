import { describe, expect, it } from 'vitest';
import { protectFontUrl, protectStylesheet } from '../google-fonts-mock.mjs';

const KIT =
  'https://fonts.gstatic.com/l/font?kit=PbyCFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzuoyGr_IAKa93uftYFRn826S7r_0KN9plx7TnXkHIRC4sUoyclAlC2Ae&skey=87e7ee645936e2c7&v=v40';
const STATIC =
  'https://fonts.gstatic.com/s/notosanskr/v40/PbykFmXiEBPT4ITbgNA5Cgm203Tq4JJWq209pU0DPdWuqxJFA4GNDCBYtw.0.woff2';

// Turbopack 15.5 가 쓰는 qstring 0.7 흉내: 날 `&`에서 쌍을 나누고 첫 `=`에서 키/값을 나눈 뒤 퍼센트 디코딩.
// 인코딩은 제어 문자·공백·`"<>\`&?=`만 이스케이프 (`%`·`#`는 그대로)
function qsParse(s: string): [string, string | null][] {
  return s
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf('=');
      return i === -1
        ? [decodeURIComponent(pair), null]
        : [
            decodeURIComponent(pair.slice(0, i)),
            decodeURIComponent(pair.slice(i + 1)),
          ];
    });
}
function qsEncode(s: string): string {
  return s.replace(
    /[\x00-\x20"<>`&?=\x7f]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`,
  );
}
function qsDisplay(pairs: [string, string | null][]): string {
  return pairs
    .map(([k, v]) =>
      v === null ? qsEncode(k) : `${qsEncode(k)}=${qsEncode(v)}`,
    )
    .join('&');
}

/** update_google_stylesheet → NextFontGoogleFontFileReplacer 경로를 흉내 내 최종 글꼴 옵션을 돌려준다 */
function turbopackRoundTrip(cssUrl: string) {
  const query = qsDisplay(
    qsParse(
      JSON.stringify({ url: cssUrl, preload: false, has_size_adjust: true }),
    ),
  );
  const pairs = qsParse(query);
  if (pairs.length !== 1)
    throw new Error('next/font/google queries have exactly one entry');
  return JSON.parse(pairs[0][0]) as { url: string };
}

describe('protectFontUrl', () => {
  it('확장자 있는 주소는 그대로 둔다', () => {
    expect(protectFontUrl(STATIC, 'woff2')).toBe(STATIC);
  });

  it('감싸지 않은 kit 주소는 Turbopack 15.5 에서 실제 CI 와 같은 에러가 난다', () => {
    expect(() => turbopackRoundTrip(KIT)).toThrow('exactly one entry');
  });

  it('감싼 kit 주소는 원래 주소 + 확장자 파라미터로 풀린다', () => {
    const wrapped = protectFontUrl(KIT, 'woff2');
    expect(wrapped).not.toMatch(/[&=]/);
    expect(turbopackRoundTrip(wrapped).url).toBe(`${KIT}&_=.woff2`);
  });

  it('format() 힌트로 확장자를 정하고 없으면 woff2', () => {
    expect(decodeURIComponent(protectFontUrl(KIT, 'truetype'))).toMatch(
      /&_=\.ttf$/,
    );
    expect(decodeURIComponent(protectFontUrl(KIT, undefined))).toMatch(
      /&_=\.woff2$/,
    );
    expect(
      decodeURIComponent(protectFontUrl('https://example.com/font', 'woff')),
    ).toBe('https://example.com/font?_=.woff');
  });

  it('두 번 디코딩되거나 잘리는 문자가 있으면 멈춘다', () => {
    expect(() => protectFontUrl(`${KIT}%2B`, 'woff2')).toThrow();
    expect(() => protectFontUrl(`${KIT}#x`, 'woff2')).toThrow();
  });
});

describe('protectStylesheet', () => {
  it('확장자 없는 src 만 감싸고 나머지는 그대로', () => {
    const css = [
      '/* latin */',
      '@font-face {',
      `  src: url(${KIT}) format('woff2');`,
      '}',
      '@font-face {',
      `  src: url(${STATIC}) format('woff2');`,
      '}',
    ].join('\n');
    const { css: out, protectedCount } = protectStylesheet(css);
    expect(protectedCount).toBe(1);
    expect(out).toContain(`src: url(${STATIC}) format('woff2');`);
    expect(out).toContain(
      `src: url(${protectFontUrl(KIT, 'woff2')}) format('woff2');`,
    );
    expect(out.replace(protectFontUrl(KIT, 'woff2'), KIT)).toBe(css);
  });
});
