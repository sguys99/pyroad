// Lighthouse CI 판정·요약 (P12-03, §2.10). P0-13 스파이크 `spikes/p0-13-perf-baseline/scripts/summarize.mjs`의 Lighthouse 표를
// 정식으로 옮긴 것: 결과 JSON(scripts/perf/lighthouse.ts) → 예산 판정 + 사람이 읽는 마크다운, 기준 파일과 견줘 증감 표시.
//
//   node scripts/perf/summarize.mjs build/perf/lighthouse.json [docs/perf/lighthouse-baseline.json]
//   node scripts/perf/summarize.mjs build/perf/lighthouse.json --update-baseline   # 기준 파일을 이 결과로 (docs/perf/lighthouse.md)
//
// 차단(종료 코드 1): 모바일 Accessibility 중앙값 < 90, 라우트 JS·총 전송(Pyodide 뺌)·Pyodide 바이트가 예산 초과, 측정 실패,
//   서버 HTML에 opacity 0으로 그린 글자(§2.10 규칙 — LCP가 하이드레이션 뒤로 밀림, B102).
// 경고(표시만): Performance < 80, LCP·TBT 기준 초과, 기준보다 Performance 10점 이상 하락.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const BASELINE_FILE = join(ROOT, 'docs/perf/lighthouse-baseline.json');

/**
 * 화면별 예산 (KB, gzip) = 계획서 §2.10 표. routeJs = 서버 HTML이 처음부터 거는 `<script src>`를 빌드 파일 gzip -9로 센 합
 * (랜딩 postbuild·perf:quest와 같은 셈). total = Lighthouse 전송 바이트 합에서 Pyodide·Worker를 뺀 것. Pyodide = 자체 호스팅 코어.
 * 월드맵·프로필 JS(앱 화면이라 퀘스트와 같은 350)와 모든 화면 total은 P12-03 첫 실측(2026-11-17) + 약 15% 여유에서 시작해
 * 사용자가 그대로 확정(§12-Q82, docs/perf/lighthouse.md). 바꿀 때는 §2.10 표와 함께
 */
export const BUDGETS = {
  landing: { routeJsKB: 250, totalKB: 500 },
  world: { routeJsKB: 350, totalKB: 1100 },
  quest1: { routeJsKB: 350, totalKB: 1500, pyodideKB: 6350 },
  project: { routeJsKB: 350, totalKB: 1500, pyodideKB: 6350 },
  profile: { routeJsKB: 350, totalKB: 1100 },
};
export const BLOCK = { accessibility: 90 };
export const WARN = { performance: 80, lcpMs: 2500, tbtMs: 800, perfDrop: 10 };

const fmt = (v, d = 0) =>
  v == null || Number.isNaN(v) ? '-' : Number(v).toFixed(d);

/**
 * 결과 하나의 판정
 * @param {any} result
 * @param {any} [baseline]
 * @returns {{ blocking: string[], warnings: string[] }}
 */
export function evaluate(result, baseline = null) {
  const blocking = [];
  const warnings = [];
  for (const [key, r] of Object.entries(result.routes)) {
    const m = r.median;
    const b = BUDGETS[key] ?? {};
    if (!m) {
      blocking.push(`${r.label}: 측정 실패 (${r.errors?.join(' / ')})`);
      continue;
    }
    if (m.accessibility == null || m.accessibility < BLOCK.accessibility)
      blocking.push(
        `${r.label}: Accessibility ${fmt(m.accessibility)} < ${BLOCK.accessibility}`,
      );
    if (m.hiddenText?.length)
      blocking.push(
        `${r.label}: 서버 HTML에 opacity 0인 글자 ${m.hiddenText.length}곳 (${m.hiddenText[0]})`,
      );
    for (const [field, label] of [
      ['routeJsKB', '라우트 JS'],
      ['totalKB', '총 전송(Pyodide 뺌)'],
      ['pyodideKB', 'Pyodide'],
    ])
      if (b[field] != null && m[field] > b[field])
        blocking.push(
          `${r.label}: ${label} ${fmt(m[field])}KB > ${b[field]}KB`,
        );
    if (m.performance < WARN.performance)
      warnings.push(
        `${r.label}: Performance ${m.performance} < ${WARN.performance}`,
      );
    if (m.lcp > WARN.lcpMs)
      warnings.push(`${r.label}: LCP ${fmt(m.lcp)}ms > ${WARN.lcpMs}ms`);
    if (m.tbt > WARN.tbtMs)
      warnings.push(`${r.label}: TBT ${fmt(m.tbt)}ms > ${WARN.tbtMs}ms`);
    const o = baseline?.routes?.[key]?.median;
    if (o && m.performance <= o.performance - WARN.perfDrop)
      warnings.push(
        `${r.label}: Performance 기준 ${o.performance} → ${m.performance}`,
      );
  }
  return { blocking, warnings };
}

/** "지금 (기준 대비 ±차이)" */
const cmp = (cur, base, d = 0) => {
  if (base == null || cur == null) return fmt(cur, d);
  const diff = Number((cur - base).toFixed(d)) || 0; // -0 → 0
  return `${fmt(cur, d)} (${diff >= 0 ? '+' : ''}${fmt(diff, d)})`;
};
const withBudget = (cur, base, budget, d = 0) =>
  `${cmp(cur, base, d)}${budget != null ? ` / ${budget}` : ''}`;

/**
 * @param {any} result
 * @param {any} [baseline]
 */
export function summarize(result, baseline = null) {
  const { blocking, warnings } = evaluate(result, baseline);
  const out = [];
  const p = (s = '') => out.push(s);
  p(
    `## Lighthouse 모바일 (${result.runs}회 중앙값) — ${blocking.length ? '❌ 차단' : '✅ 통과'}${warnings.length ? ` · 경고 ${warnings.length}` : ''}`,
  );
  p();
  p(
    `Lighthouse ${result.lighthouse} · ${result.chrome} · git ${result.git} · ${result.date}` +
      (baseline
        ? ` · 괄호는 기준(git ${baseline.git}, ${baseline.date}) 대비`
        : ' · 기준 파일 없음'),
  );
  p();
  p(
    '| 화면 | Perf | A11y | BP | LCP ms | TBT ms | CLS | 라우트 JS KB / 예산 | 전송 KB (Pyodide 뺌) / 예산 | Pyodide KB / 예산 | Perf 범위 |',
  );
  p('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [key, r] of Object.entries(result.routes)) {
    const m = r.median ?? {};
    const o = baseline?.routes?.[key]?.median;
    const b = BUDGETS[key] ?? {};
    p(
      `| ${r.label} | ${cmp(m.performance, o?.performance)} | ${cmp(m.accessibility, o?.accessibility)} | ${fmt(m.bestPractices)} | ${cmp(m.lcp, o?.lcp)} | ${cmp(m.tbt, o?.tbt)} | ${fmt(m.cls, 3)} | ${withBudget(m.routeJsKB, o?.routeJsKB, b.routeJsKB, 1)} | ${withBudget(m.totalKB, o?.totalKB, b.totalKB)} | ${b.pyodideKB ? withBudget(m.pyodideKB, o?.pyodideKB, b.pyodideKB) : fmt(m.pyodideKB)} | ${r.spread?.performance?.join('~') ?? '-'} |`,
    );
  }
  p();
  if (blocking.length) {
    p('**차단**');
    p();
    for (const s of blocking) p(`- ${s}`);
    p();
  }
  if (warnings.length) {
    p('**경고** (러너 부하에 민감, 표시만)');
    p();
    for (const s of warnings) p(`- ${s}`);
    p();
  }
  const audits = {};
  for (const [key, r] of Object.entries(result.routes))
    for (const cat of ['accessibility', 'best-practices'])
      for (const a of r.failing?.[cat] ?? [])
        (audits[`${cat}:${a.id}`] ??= { cat, ...a, routes: [] }).routes.push(
          key,
        );
  if (Object.keys(audits).length) {
    p('<details><summary>실패한 접근성·모범 사례 감사</summary>');
    p();
    p('| 분류 | 감사 | 화면 |');
    p('|---|---|---|');
    for (const a of Object.values(audits))
      p(`| ${a.cat} | \`${a.id}\` ${a.title} | ${a.routes.join(', ')} |`);
    p();
    p('</details>');
    p();
  }
  return { markdown: out.join('\n'), blocking, warnings };
}

/** 기준 파일: 판정·비교에 쓰는 값만 (회차별 원본은 아티팩트에) */
export function toBaseline(result) {
  return {
    git: result.git,
    date: result.date,
    lighthouse: result.lighthouse,
    chrome: result.chrome,
    runs: result.runs,
    routes: Object.fromEntries(
      Object.entries(result.routes).map(([k, r]) => [
        k,
        { label: r.label, median: r.median, spread: r.spread },
      ]),
    ),
  };
}

export function readBaseline(file = BASELINE_FILE) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [file, second] = process.argv.slice(2);
  if (!file) {
    console.error(
      '사용법: node scripts/perf/summarize.mjs <결과.json> [기준.json | --update-baseline]',
    );
    process.exit(2);
  }
  const result = JSON.parse(readFileSync(file, 'utf8'));
  if (second === '--update-baseline') {
    writeFileSync(
      BASELINE_FILE,
      JSON.stringify(toBaseline(result), null, 2) + '\n',
    );
    console.log(`[lighthouse] 기준 갱신 → ${BASELINE_FILE}`);
  } else {
    const { markdown, blocking } = summarize(
      result,
      readBaseline(second ?? BASELINE_FILE),
    );
    console.log(markdown);
    process.exitCode = blocking.length ? 1 : 0;
  }
}
