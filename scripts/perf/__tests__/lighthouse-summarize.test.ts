import { describe, expect, it } from 'vitest';
import { BUDGETS, evaluate, summarize, toBaseline } from '../summarize.mjs';

// Lighthouse CI 판정 (P12-03): 차단(Accessibility·바이트)과 경고(Performance·LCP·TBT)를 나눠 내는지

const ok = {
  performance: 95,
  accessibility: 100,
  bestPractices: 100,
  lcp: 1200,
  tbt: 100,
  cls: 0,
  routeJsKB: 200,
  totalKB: 400,
  pyodideKB: 0,
};
const result = (median: Record<string, number> | null, key = 'landing') => ({
  date: '2026-11-17',
  git: 'abc',
  lighthouse: '13.6.0',
  chrome: 'Chromium',
  runs: 3,
  routes: {
    [key]: { label: key, median, spread: {}, errors: ['#1 boom'] },
  },
});

describe('evaluate', () => {
  it('예산 안이면 차단·경고 없음', () => {
    expect(evaluate(result(ok))).toEqual({ blocking: [], warnings: [] });
  });

  it('Accessibility 90 미만·라우트 JS·총 전송 초과는 차단', () => {
    const { blocking } = evaluate(
      result({
        ...ok,
        accessibility: 89,
        routeJsKB: BUDGETS.landing.routeJsKB + 1,
        totalKB: BUDGETS.landing.totalKB + 1,
      }),
    );
    expect(blocking).toHaveLength(3);
  });

  it('Pyodide는 퀘스트 화면만 별도 예산', () => {
    const big = { ...ok, pyodideKB: BUDGETS.quest1.pyodideKB + 1 };
    expect(evaluate(result(big, 'quest1')).blocking).toHaveLength(1);
    expect(evaluate(result(big, 'landing')).blocking).toHaveLength(0);
  });

  it('Performance·LCP·TBT는 경고만, 기준보다 10점 하락도 경고', () => {
    const cur = result({ ...ok, performance: 70, lcp: 4000, tbt: 900 });
    const { blocking, warnings } = evaluate(
      cur,
      toBaseline(result({ ...ok, performance: 90 })),
    );
    expect(blocking).toEqual([]);
    expect(warnings).toHaveLength(4);
  });

  it('서버 HTML에 opacity 0인 글자가 있으면 차단 (B102)', () => {
    const { blocking } = evaluate(
      result({ ...ok, hiddenText: ['<div style="opacity:0">'] } as never),
    );
    expect(blocking[0]).toContain('opacity 0');
  });

  it('측정 실패는 차단', () => {
    expect(evaluate(result(null)).blocking[0]).toContain('측정 실패');
  });
});

describe('summarize', () => {
  it('기준 대비 증감을 표에 적는다', () => {
    const { markdown } = summarize(
      result({ ...ok, totalKB: 420 }),
      toBaseline(result(ok)),
    );
    expect(markdown).toContain(`420 (+20) / ${BUDGETS.landing.totalKB}`);
    expect(markdown).toContain('✅ 통과');
  });
});
