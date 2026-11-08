import { describe, expect, it } from 'vitest';
import {
  LANDING_CSS_BUDGET,
  LANDING_JS_BUDGET,
  blockingStylesheets,
  firstLoadScripts,
  hiddenTextByInlineOpacity,
  judge,
  staticFile,
} from '../check-landing-budget.mjs';

// 랜딩 바이트 예산 postbuild 검사 (P4-12)의 HTML 해석 부분

describe('firstLoadScripts', () => {
  it('<script src>만, noModule 폴리필은 뺀다', () => {
    const html =
      '<script src="/_next/static/chunks/a.js" async=""></script>' +
      '<script src="/_next/static/chunks/poly.js" noModule=""></script>' +
      '<script>self.__next_f.push([1,"x"])</script>' +
      '<script type="application/ld+json">{}</script>';
    expect(firstLoadScripts(html)).toEqual(['/_next/static/chunks/a.js']);
  });
});

describe('blockingStylesheets', () => {
  it('rel=stylesheet만, media=print·disabled는 뺀다', () => {
    const html =
      '<link rel="stylesheet" href="/_next/static/chunks/a.css" data-precedence="next"/>' +
      '<link rel="preload" href="/_next/static/media/f.woff2" as="font"/>' +
      '<link rel="stylesheet" href="/late.css" media="print"/>' +
      '<link rel="stylesheet" href="/off.css" disabled=""/>';
    expect(blockingStylesheets(html)).toEqual(['/_next/static/chunks/a.css']);
  });
});

describe('hiddenTextByInlineOpacity', () => {
  it('글자가 든 요소의 인라인 opacity:0을 찾는다 (예전 Framer initial="hidden" SSR, P0-13)', () => {
    const html =
      '<h1 style="opacity:0;transform:translateY(20px)">코드 주문으로</h1>';
    expect(hiddenTextByInlineOpacity(html)).toHaveLength(1);
  });

  it('글자 없는 장식·opacity 0.5·스크립트 안 글자는 괜찮다', () => {
    const html =
      '<span style="opacity:0" aria-hidden="true"></span>' +
      '<p style="opacity:0.5">반투명</p>' +
      '<div style="opacity:0;"><svg><path d="M0 0"/></svg></div>' +
      '<script>document.body.innerHTML=\'<b style="opacity:0">x</b>\'</script>';
    expect(hiddenTextByInlineOpacity(html)).toEqual([]);
  });
});

describe('judge', () => {
  it('예산을 넘으면 error, 95%를 넘으면 warn', () => {
    expect(judge('JS', LANDING_JS_BUDGET + 1, LANDING_JS_BUDGET).level).toBe(
      'error',
    );
    expect(
      judge('CSS', LANDING_CSS_BUDGET * 0.97, LANDING_CSS_BUDGET).level,
    ).toBe('warn');
    expect(
      judge('CSS', LANDING_CSS_BUDGET * 0.5, LANDING_CSS_BUDGET).level,
    ).toBe('ok');
  });
});

describe('staticFile', () => {
  it('Skew Protection 쿼리(?dpl=)를 떼고 .next 경로로', () => {
    expect(staticFile('/_next/static/chunks/a.css?dpl=abc', '/x/.next')).toBe(
      '/x/.next/static/chunks/a.css',
    );
  });
});
