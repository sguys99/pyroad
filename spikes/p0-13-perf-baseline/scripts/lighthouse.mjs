// P0-13 Lighthouse 기준선 (Lighthouse 노드 API + Puppeteer 페이지 흐름)
//
//   P013_WORK=<작업> CHROME_PATH=<chrome> node scripts/lighthouse.mjs [--runs 3] [--routes landing,world,quest1,project,profile] [--ff mobile,desktop]
//
// - 모바일 = Lighthouse 기본 설정(시뮬레이션 스로틀: RTT 150ms·1.6Mbps·CPU 4배, 412×823 DPR 1.75)
//   데스크톱 = desktop-config(RTT 40ms·10Mbps·CPU 1배, 1350×940)
// - 로그인 화면은 매 회 새 Chrome 프로필에 @supabase/ssr 가 만든 것과 같은 세션 쿠키를 넣고 측정한다.
//   Lighthouse 의 저장소 초기화는 쿠키를 지우지 않는다 (clearStorageTypes 기본값에 cookies 없음).
// - 전체 보고서(HTML/JSON)는 <작업>/raw/lh/ 에만, 요약은 results/lighthouse.json 에 남긴다.
import fs from 'node:fs';
import path from 'node:path';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import * as chromeLauncher from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import { APP, CHROME, QUEST, RAW, SPIKE, sessionCookies, waitQuiet, machineState, median, spread, r0, writeJSON } from './lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? [...a, [x.slice(2), arr[i + 1]]] : a), []));
const RUNS = Number(args.runs ?? 3);
export const ROUTES = {
  landing: { path: '/', user: null, label: '랜딩 /' },
  world: { path: '/world', user: 'perf', label: '월드맵 /world' },
  quest1: { path: `/quest/${QUEST.first}`, user: 'newbie', label: '첫 퀘스트 1-1 (첫 방문)' },
  project: { path: `/quest/${QUEST.project}`, user: 'perf', label: '프로젝트 퀘스트 7-1' },
  profile: { path: '/profile', user: 'perf', label: '프로필 /profile' },
};
const routeKeys = (args.routes ?? Object.keys(ROUTES).join(',')).split(',');
const ffs = (args.ff ?? 'mobile,desktop').split(',');
const OUTDIR = path.join(RAW, 'lh');
fs.mkdirSync(OUTDIR, { recursive: true });
const SUMMARY = path.resolve(SPIKE, 'results', args.out ?? 'lighthouse.json');

const METRICS = ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index', 'interactive', 'server-response-time', 'bootup-time', 'mainthread-work-breakdown', 'total-byte-weight'];

async function runOnce(routeKey, ff, i) {
  const route = ROUTES[routeKey];
  const chrome = await chromeLauncher.launch({
    chromePath: CHROME,
    chromeFlags: ['--headless=new', '--no-sandbox', '--no-first-run', '--lang=ko-KR', '--window-size=1350,940'],
  });
  let browser;
  try {
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}`, defaultViewport: null });
    const page = await browser.newPage();
    if (route.user) {
      const cookies = await sessionCookies(route.user);
      await browser.setCookie(...cookies.map((c) => ({ ...c, sameSite: 'Lax' })));
    }
    const flags = { port: chrome.port, output: ['json', 'html'], logLevel: 'error', locale: 'ko', maxWaitForLoad: 60000 };
    const config = ff === 'desktop' ? desktopConfig : undefined;
    const t0 = Date.now();
    const res = await lighthouse(APP + route.path, flags, config, page);
    const wall = Date.now() - t0;
    const lhr = res.lhr;
    const base = path.join(OUTDIR, `${routeKey}-${ff}-${i}`);
    fs.writeFileSync(base + '.report.json', res.report[0]);
    fs.writeFileSync(base + '.report.html', res.report[1]);
    if (lhr.runtimeError) throw new Error(`LH runtimeError ${lhr.runtimeError.code}: ${lhr.runtimeError.message}`);
    return { lhr, wall };
  } finally {
    await browser?.disconnect().catch(() => {});
    await chrome.kill();
  }
}

function digest(lhr) {
  const cat = Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, v.score == null ? null : Math.round(v.score * 100)]));
  const m = Object.fromEntries(METRICS.map((id) => [id, lhr.audits[id]?.numericValue ?? null]));
  const items = lhr.audits['network-requests']?.details?.items ?? [];
  const bytes = { total: 0, js: 0, css: 0, font: 0, image: 0, doc: 0, other: 0, wasm: 0 };
  const byHost = {};
  for (const it of items) {
    const t = it.transferSize ?? 0;
    bytes.total += t;
    const rt = (it.resourceType ?? '').toLowerCase();
    const mime = it.mimeType ?? '';
    const k = /wasm/.test(mime) || /\.wasm/.test(it.url) ? 'wasm' : rt === 'script' ? 'js' : rt === 'stylesheet' ? 'css' : rt === 'font' ? 'font' : rt === 'image' ? 'image' : rt === 'document' ? 'doc' : 'other';
    bytes[k] += t;
    const host = new URL(it.url).host;
    byHost[host] = (byHost[host] ?? 0) + t;
  }
  const largest = [...items]
    .sort((a, b) => (b.transferSize ?? 0) - (a.transferSize ?? 0))
    .slice(0, 8)
    .map((it) => ({ url: it.url.replace(APP, ''), type: it.resourceType, kb: +((it.transferSize ?? 0) / 1024).toFixed(1), resKb: +((it.resourceSize ?? 0) / 1024).toFixed(1) }));
  const failing = (catId) =>
    (lhr.categories[catId]?.auditRefs ?? [])
      .map((ref) => ({ ref, a: lhr.audits[ref.id] }))
      .filter(({ ref, a }) => a && a.score != null && a.score < 0.9 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'notApplicable' && a.scoreDisplayMode !== 'manual' && (ref.weight > 0 || catId === 'performance'))
      .map(({ ref, a }) => ({ id: a.id, title: a.title, score: a.score, weight: ref.weight, display: a.displayValue ?? null, n: a.details?.items?.length ?? null, savingsMs: a.metricSavings?.LCP ?? a.details?.overallSavingsMs ?? null }));
  const lcpEl = lhr.audits['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet ?? null;
  return {
    cat,
    m,
    requests: items.length,
    bytes,
    byHost,
    largest,
    failing: { performance: failing('performance'), accessibility: failing('accessibility'), 'best-practices': failing('best-practices'), seo: failing('seo') },
    lcpEl,
    benchmarkIndex: lhr.environment?.benchmarkIndex ?? null,
    finalUrl: lhr.finalDisplayedUrl,
    lhVersion: lhr.lighthouseVersion,
    ua: lhr.environment?.hostUserAgent,
    warnings: lhr.runWarnings,
  };
}

// 요약 JSON 을 작게: 감사 목록·큰 리소스·호스트별 바이트는 Performance 중앙값 회차에만 남김 (전체는 <작업>/raw/lh/)
export function compactRuns(runs) {
  const ok = runs.filter((r) => !r.error);
  const medPerf = median(ok.map((r) => r.cat.performance));
  const rep = ok.find((r) => r.cat.performance === medPerf) ?? ok[0];
  return runs.map((r) => {
    if (r.error) return r;
    const { failing, largest, byHost, warnings, ua, lhVersion, ...rest } = r;
    return r === rep ? { ...rest, representative: true, failing, largest, byHost, lhVersion } : rest;
  });
}

const existing = fs.existsSync(SUMMARY) ? JSON.parse(fs.readFileSync(SUMMARY, 'utf8')) : { batches: {} };
let first = true;
for (const rk of routeKeys) {
  for (const ff of ffs) {
    const quiet = await waitQuiet({ label: `lh ${rk} ${ff}`, maxMin: first ? Number(process.env.P013_MAX_WAIT_MIN ?? 40) : Number(process.env.P013_MAX_WAIT_MIN_NEXT ?? 15) });
    first = false;
    const runs = [];
    for (let i = 1; i <= RUNS; i++) {
      const before = machineState();
      try {
        const { lhr, wall } = await runOnce(rk, ff, i);
        const d = digest(lhr);
        runs.push({ i, wall, load1: before.load1, ...d });
        console.log(`[lh] ${rk} ${ff} #${i} perf=${d.cat.performance} a11y=${d.cat.accessibility} bp=${d.cat['best-practices']} seo=${d.cat.seo} LCP=${r0(d.m['largest-contentful-paint'])} TBT=${r0(d.m['total-blocking-time'])} CLS=${d.m['cumulative-layout-shift']?.toFixed(3)} req=${d.requests} KB=${r0(d.bytes.total / 1024)} bench=${d.benchmarkIndex} load=${before.load1} url=${d.finalUrl}`);
      } catch (e) {
        console.log(`[lh] ${rk} ${ff} #${i} FAILED ${e.message}`);
        runs.push({ i, error: String(e.message) });
      }
    }
    const ok = runs.filter((r) => !r.error);
    const med = (f) => median(ok.map(f));
    const spr = (f) => spread(ok.map(f));
    existing.batches[`${rk}:${ff}`] = {
      route: rk,
      label: ROUTES[rk].label,
      path: ROUTES[rk].path,
      user: ROUTES[rk].user,
      ff,
      quiet,
      loadAfter: machineState(),
      median: {
        performance: med((r) => r.cat.performance),
        accessibility: med((r) => r.cat.accessibility),
        bestPractices: med((r) => r.cat['best-practices']),
        seo: med((r) => r.cat.seo),
        fcp: med((r) => r.m['first-contentful-paint']),
        lcp: med((r) => r.m['largest-contentful-paint']),
        tbt: med((r) => r.m['total-blocking-time']),
        cls: med((r) => r.m['cumulative-layout-shift']),
        si: med((r) => r.m['speed-index']),
        tti: med((r) => r.m.interactive),
        ttfb: med((r) => r.m['server-response-time']),
        bootup: med((r) => r.m['bootup-time']),
        mainthread: med((r) => r.m['mainthread-work-breakdown']),
        requests: med((r) => r.requests),
        totalKB: med((r) => r.bytes.total / 1024),
        jsKB: med((r) => r.bytes.js / 1024),
        cssKB: med((r) => r.bytes.css / 1024),
        fontKB: med((r) => r.bytes.font / 1024),
        imageKB: med((r) => r.bytes.image / 1024),
        wasmKB: med((r) => r.bytes.wasm / 1024),
        benchmarkIndex: med((r) => r.benchmarkIndex),
      },
      spread: {
        performance: spr((r) => r.cat.performance),
        lcp: spr((r) => r.m['largest-contentful-paint']),
        tbt: spr((r) => r.m['total-blocking-time']),
        cls: spr((r) => r.m['cumulative-layout-shift']),
      },
      runs: compactRuns(runs),
    };
    writeJSON(SUMMARY, existing);
  }
}
console.log(`[lh] summary → ${SUMMARY}`);
