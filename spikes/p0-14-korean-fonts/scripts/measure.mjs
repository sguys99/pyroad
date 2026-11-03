// P0-14 폰트 로딩 실측 (Playwright + CDP).
//
//   FONTCONFIG_FILE=<scratch>/sysfonts/fonts.conf \
//   node spikes/p0-14-korean-fonts/scripts/measure.mjs [--runs 3] [--profiles slow4g,fast3g] [--variants a-next,b-next] [--out results.json]
//
// - 대상: http://localhost:3114/<variant> (실험 앱을 `next start -p 3114`로 띄운 상태)
// - 모바일 에뮬레이션(390×844, DPR 2, Android Chrome UA) + 네트워크·CPU 스로틀링(CDP), 매 회 새 컨텍스트(캐시 없음)
// - 수집: 폰트 요청 수·바이트(전송량), 전체/JS 바이트, FCP, LCP(+요소), CLS, 제목/본문/코드 텍스트의 웹폰트 적용 시각
// - FONTCONFIG_FILE로 시스템 한글 폰트(Noto Sans KR)를 넣어 Android·크롬북의 폴백 상황을 흉내 낸다.
import { chromium } from 'playwright';
import fs from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []),
);
const BASE = args.base ?? 'http://localhost:3114';
const RUNS = Number(args.runs ?? 3);
const VARIANTS = (args.variants ?? 'system,baseline,a-cdn,a-next,a-next-static,a-next-adj,a-subset,a-landing,a-cafe24,a-cafe24-full,b-cdn,b-next,b-subset,b-landing').split(',');
const PROFILES_ALL = {
  // Lighthouse 모바일 기본값과 같은 수치(RTT 150ms, 1.6Mbps). DevTools 방식(요청마다 지연)으로 적용
  slow4g: { latency: 150, down: (1.6 * 1024 * 1024) / 8, up: (750 * 1024) / 8, cpu: 4 },
  // DevTools 'Slow 4G'(구 Fast 3G) 프리셋: 562.5ms, 1.44Mbps
  fast3g: { latency: 562.5, down: ((1.6 * 1024 * 1024) / 8) * 0.9, up: ((750 * 1024) / 8) * 0.9, cpu: 4 },
};
const PROFILES = (args.profiles ?? 'slow4g,fast3g').split(',');
const OUT = args.out ?? 'p0-14-measure.json';

const INIT = `
(() => {
  const m = (window.__m = { lcp: [], cls: 0, shifts: [], fcp: null, ready: {}, fontEvents: [] });
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => m.lcp.push({ t: e.startTime, size: e.size, el: e.element ? (e.element.id || e.element.tagName + '.' + (e.element.className || '')) : null, text: e.element ? (e.element.textContent || '').slice(0, 24) : null }))).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) { m.cls += e.value; m.shifts.push({ t: e.startTime, v: e.value }); } })).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (e.name === 'first-contentful-paint') m.fcp = e.startTime; })).observe({ type: 'paint', buffered: true });
  } catch (e) { m.err = String(e); }
  const targets = { title: '#hero-title', body: '#hero-lead', code: '#code-section pre' };
  const firstFamily = (ff) => ff.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  function poll() {
    if (document.fonts) {
      for (const [k, sel] of Object.entries(targets)) {
        if (m.ready[k] != null) continue;
        const el = document.querySelector(sel);
        if (!el) continue;
        const cs = getComputedStyle(el);
        const fam = firstFamily(cs.fontFamily);
        const faces = [...document.fonts].filter((f) => f.family.replace(/^['"]|['"]$/g, '') === fam);
        if (!faces.length) { if (!/^(-apple-system|BlinkMacSystemFont|system-ui|ui-monospace)$/.test(fam)) continue; m.ready[k] = 0; continue; }
        // 첫 패밀리만 검사 (next/font의 'X Fallback'은 local(Arial) 폴백이라 리눅스에선 끝내 로드되지 않음)
        const spec = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' "' + fam + '"';
        // 공백·개행 제외 (D2Coding은 U+000A도 cmap에 있어, 렌더되지 않는 개행 때문에 check가 끝내 false가 됨)
        if (faces.some((f) => f.status === 'loaded') && document.fonts.check(spec, el.textContent.replace(/\\s+/g, ''))) m.ready[k] = performance.now();
      }
    }
    if (Object.keys(m.ready).length < 3 && performance.now() < 60000) requestAnimationFrame(poll);
  }
  requestAnimationFrame(poll);
  if (document.fonts) {
    document.fonts.addEventListener('loadingdone', (e) => m.fontEvents.push({ t: performance.now(), n: e.fontfaces.length }));
    document.fonts.ready.then(() => { m.fontsReadyFirst = performance.now(); });
  }
})();`;

const median = (xs) => {
  const v = xs.filter((x) => x != null && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

async function runOnce(browser, variant, profileName) {
  const p = PROFILES_ALL[profileName];
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'ko-KR',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36',
  });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: p.latency, downloadThroughput: p.down, uploadThroughput: p.up });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: p.cpu });
  const reqs = new Map();
  cdp.on('Network.requestWillBeSent', (e) => reqs.set(e.requestId, { url: e.request.url, type: e.type, t0: e.timestamp }));
  cdp.on('Network.responseReceived', (e) => { const r = reqs.get(e.requestId); if (r) { r.type = e.type; r.status = e.response.status; } });
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) { r.bytes = e.encodedDataLength; r.t1 = e.timestamp; } });
  const navStart = Date.now();
  await page.goto(`${BASE}/${variant}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => {});
  await page.waitForFunction(() => window.__m && Object.keys(window.__m.ready).length >= 3, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const fontRT = performance.getEntriesByType('resource').filter((r) => r.initiatorType === 'css' && /\.(woff2?|ttf|otf)(\?|$)/.test(r.name) || /font/.test(r.initiatorType));
    return {
      ...window.__m,
      load: nav ? nav.loadEventEnd : null,
      domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
      lastFontEnd: fontRT.length ? Math.max(...fontRT.map((r) => r.responseEnd)) : null,
      fontFamiliesLoaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight).filter((v, i, a) => a.indexOf(v) === i),
    };
  });
  const all = [...reqs.values()].filter((r) => r.bytes != null);
  const fonts = all.filter((r) => r.type === 'Font');
  const sum = (xs) => xs.reduce((s, r) => s + (r.bytes || 0), 0);
  const byHost = {};
  for (const f of fonts) { const h = new URL(f.url).host; byHost[h] = (byHost[h] || 0) + f.bytes; }
  await ctx.close();
  const lcp = m.lcp.length ? m.lcp[m.lcp.length - 1] : null;
  return {
    variant, profile: profileName, wall: Date.now() - navStart,
    fontRequests: fonts.length, fontBytes: sum(fonts), fontBytesByHost: byHost,
    cssBytes: sum(all.filter((r) => r.type === 'Stylesheet')), jsBytes: sum(all.filter((r) => r.type === 'Script')), totalBytes: sum(all), requests: all.length,
    fcp: m.fcp, lcp: lcp?.t ?? null, lcpEl: lcp?.el ?? null, lcpEntries: m.lcp.length, cls: m.cls, shifts: m.shifts,
    titleReady: m.ready.title ?? null, bodyReady: m.ready.body ?? null, codeReady: m.ready.code ?? null,
    lastFontEnd: m.lastFontEnd, load: m.load, families: m.fontFamiliesLoaded,
    fontUrls: fonts.map((f) => [f.url.replace(/^https?:\/\/[^/]+/, (h) => h.replace(/^https?:\/\//, '')).slice(0, 90), f.bytes]),
  };
}

// 설치된 Playwright 브라우저 빌드가 패키지 버전과 다르면 PW_CHROMIUM=<chrome 실행 파일>로 지정
const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--font-render-hinting=none'] });
const results = [];
for (let i = 0; i < RUNS; i++) {
  for (const profile of PROFILES) {
    for (const v of VARIANTS) {
      try {
        const r = await runOnce(browser, v, profile);
        r.run = i;
        results.push(r);
        console.log(`[${i}] ${profile.padEnd(6)} ${v.padEnd(14)} fonts ${String(r.fontRequests).padStart(3)} req ${(r.fontBytes / 1024).toFixed(0).padStart(5)}KB  FCP ${r.fcp?.toFixed(0)}  LCP ${r.lcp?.toFixed(0)} (${r.lcpEl})  CLS ${r.cls.toFixed(3)}  title ${r.titleReady?.toFixed(0)} body ${r.bodyReady?.toFixed(0)} code ${r.codeReady?.toFixed(0)}`);
      } catch (e) {
        console.log(`[${i}] ${profile} ${v} ERROR ${e.message.split('\n')[0]}`);
      }
    }
  }
}
await browser.close();

const summary = [];
for (const profile of PROFILES) {
  for (const v of VARIANTS) {
    const rs = results.filter((r) => r.variant === v && r.profile === profile);
    if (!rs.length) continue;
    const pick = (k) => median(rs.map((r) => r[k]));
    summary.push({
      profile, variant: v, n: rs.length,
      fontRequests: pick('fontRequests'), fontKB: +(pick('fontBytes') / 1024).toFixed(1), totalKB: +(pick('totalBytes') / 1024).toFixed(1), jsKB: +(pick('jsBytes') / 1024).toFixed(1),
      fcp: Math.round(pick('fcp')), lcp: Math.round(pick('lcp')), cls: +pick('cls').toFixed(3), clsMax: +Math.max(...rs.map((r) => r.cls)).toFixed(3),
      titleReady: Math.round(pick('titleReady') ?? NaN) || null, bodyReady: Math.round(pick('bodyReady') ?? NaN) || null, codeReady: Math.round(pick('codeReady') ?? NaN) || null,
      lcpEl: rs.map((r) => r.lcpEl).sort().find(Boolean),
    });
  }
}
fs.writeFileSync(OUT, JSON.stringify({ when: new Date().toISOString(), base: BASE, runs: RUNS, profiles: Object.fromEntries(PROFILES.map((p) => [p, PROFILES_ALL[p]])), summary, results }, null, 1));
console.table(summary.map(({ lcpEl, ...s }) => s));
console.log('→', OUT);
