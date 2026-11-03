// P0-13 요약표(markdown). 두 번째 인자로 다른 결과 폴더를 주면 "기준 → 지금 (차이)"로 비교
//   node scripts/summarize.mjs <results 디렉터리> [기준 results 디렉터리] > summary.md
import fs from 'node:fs';
import path from 'node:path';

const [dir, baseDir] = process.argv.slice(2);
const load = (d, f) => (d && fs.existsSync(path.join(d, f)) ? JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')) : null);
const LH = load(dir, 'lighthouse.json');
const PY = load(dir, 'runtime-pyodide.json');
const FR = load(dir, 'runtime-frames.json');
const FR2 = load(dir, 'runtime-frames-rerun.json');
const ENV = load(dir, 'env.json');
const B = baseDir ? { LH: load(baseDir, 'lighthouse.json'), PY: load(baseDir, 'runtime-pyodide.json'), FR: load(baseDir, 'runtime-frames.json') } : null;
const fmt = (v, d = 0) => (v == null || Number.isNaN(v) ? '-' : Number(v).toFixed(d));
const cmp = (cur, base, d = 0) => (base == null || cur == null ? fmt(cur, d) : `${fmt(base, d)} → ${fmt(cur, d)} (${cur - base >= 0 ? '+' : ''}${fmt(cur - base, d)})`);
const out = [];
const p = (s = '') => out.push(s);

p(`# P0-13 성능 기준선 요약 (${ENV?.date ?? ''})`);
p();
if (ENV) p(`git ${ENV.git} · Next ${ENV.next} · ${ENV.chrome} · Lighthouse ${ENV.lighthouse} · playwright-core ${ENV.playwrightCore} · ${ENV.cpu} · ${ENV.memGB}GB`);
p();

if (LH) {
  for (const ff of ['mobile', 'desktop']) {
    p(`## Lighthouse ${ff} (중앙값, ms)`);
    p();
    p('| 화면 | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS | SI | TTFB | 요청 | 전송 KB | JS KB | Perf 범위 | LCP 범위 | 부하 |');
    p('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const b of Object.values(LH.batches).filter((x) => x.ff === ff)) {
      const m = b.median;
      const o = B?.LH?.batches?.[`${b.route}:${ff}`]?.median;
      p(`| ${b.label} | ${cmp(m.performance, o?.performance)} | ${cmp(m.accessibility, o?.accessibility)} | ${fmt(m.bestPractices)} | ${fmt(m.seo)} | ${cmp(m.fcp, o?.fcp)} | ${cmp(m.lcp, o?.lcp)} | ${cmp(m.tbt, o?.tbt)} | ${fmt(m.cls, 3)} | ${fmt(m.si)} | ${fmt(m.ttfb)} | ${fmt(m.requests)} | ${cmp(m.totalKB, o?.totalKB)} | ${cmp(m.jsKB, o?.jsKB)} | ${b.spread.performance?.join('~') ?? '-'} | ${b.spread.lcp?.map((x) => Math.round(x)).join('~') ?? '-'} | ${b.quiet.load1}${b.quiet.settled ? '' : '⚠'} |`);
    }
    p();
  }
  // 실패 감사 집계 (모바일)
  for (const cat of ['accessibility', 'performance']) {
    const agg = {};
    for (const b of Object.values(LH.batches).filter((x) => x.ff === 'mobile')) {
      const r = b.runs.find((x) => x.representative) ?? b.runs.find((x) => !x.error);
      for (const a of r?.failing?.[cat] ?? []) {
        if (cat === 'performance' && ['largest-contentful-paint', 'total-blocking-time', 'speed-index', 'first-contentful-paint', 'cumulative-layout-shift', 'interactive', 'max-potential-fid'].includes(a.id)) continue;
        (agg[a.id] ??= { title: a.title, routes: [], display: new Set(), n: 0 }).routes.push(b.route);
        if (a.display) agg[a.id].display.add(a.display);
        agg[a.id].n += a.n ?? 0;
      }
    }
    p(`### 모바일 ${cat} 실패 감사 (화면 수 순)`);
    p();
    p('| 감사 | 화면 | 표시값 |');
    p('|---|---|---|');
    for (const [id, a] of Object.entries(agg).sort((x, y) => y[1].routes.length - x[1].routes.length)) p(`| \`${id}\` ${a.title} | ${a.routes.join(', ')} | ${[...a.display].slice(0, 3).join(' / ')} |`);
    p();
  }
  p('### 화면별 큰 리소스 (모바일 중앙값 회차, 전송 KB)');
  p();
  for (const b of Object.values(LH.batches).filter((x) => x.ff === 'mobile')) {
    const r = b.runs.find((x) => x.representative) ?? b.runs.find((x) => !x.error);
    if (!r) continue;
    p(`- **${b.label}**: ` + r.largest.slice(0, 6).map((x) => `${x.url.split('/').pop().slice(0, 28)} ${x.kb}`).join(' · ') + ` · 호스트별 ${Object.entries(r.byHost).map(([h, v]) => `${h} ${Math.round(v / 1024)}KB`).join(', ')}`);
  }
  p();
}

if (PY) {
  p('## 퀘스트 1-1 첫 화면 · Pyodide (태블릿, 중앙값 ms)');
  p();
  p('| 조건 | FCP | LCP | 에디터 | Worker 생성 | 마지막 바이트 | init→ready | 다운로드 후 CPU | 실행 버튼 활성 | 첫 실행 | 이후 실행 | 재방문 init→ready | Worker 재시작 | CDN KB | 롱태스크(준비 전) | 부하 |');
  p('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const b of Object.values(PY.batches)) {
    const m = b.median;
    const o = B?.PY?.batches?.[b.plan]?.median;
    p(`| ${b.plan} | ${fmt(m.fcp)} | ${fmt(m.lcp)} | ${fmt(m.editor)} | ${fmt(m.workerCreated)} | ${fmt(m.pyodideLastByte)} | ${fmt(m.workerInitToReady)} | ${fmt(m.pyodideCpuAfterDownload)} | ${cmp(m.runEnabled, o?.runEnabled)} | ${fmt(m.runFirstPaint)} | ${fmt(m.runNextPaint)} | ${fmt(m.warmInitToReady)} | ${fmt(m.reinit)} | ${fmt(m.cdnKB)} | ${fmt(m.longTasksToReady)}개 ${fmt(m.longTaskMsToReady)}ms | ${b.quiet.load1}${b.quiet.settled ? '' : '⚠'} |`);
  }
  p();
}

for (const [title, FRX] of [['프레임 1차', FR], ['프레임 재측정 (같은 조건, 다른 시각·부하)', FR2]]) if (FRX) {
  p(`## ${title} (태블릿, rAF 기준 중앙값. comp = 컴포지터가 낸 프레임)`);
  p();
  p('| 장면 | CPU | fps | p50 | p95 | p99 | 끊김% | 롱태스크 | LoAF 차단 ms | 메인 바쁨% | 레이아웃+스타일 ms | comp fps | comp 드롭% | 힙 MB | p95 범위 | 부하 |');
  p('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const b of Object.values(FRX.batches)) {
    for (const [part, m] of Object.entries(b.median)) {
      if (m.p95 == null) {
        if (m.readyMs != null) p(`| ${b.scene} 로딩→준비 | ${b.rate}×${b.reducedMotion ? ' rm' : ''} | 준비 ${fmt(m.readyMs)}ms | | | | | ${fmt(m.longTasks)}개 ${fmt(m.longTaskMs)}ms (최대 ${fmt(m.maxLongTaskMs)}) | | | | | | | | ${b.quiet.load1} |`);
        continue;
      }
      const o = B?.FR?.batches?.[`${b.scene}:${b.rate}x${b.reducedMotion ? ':rm' : ''}`]?.median?.[part];
      p(`| ${b.scene} ${part} | ${b.rate}×${b.reducedMotion ? ' rm' : ''} | ${cmp(m.fps, o?.fps, 1)} | ${fmt(m.p50, 1)} | ${cmp(m.p95, o?.p95, 1)} | ${fmt(m.p99, 1)} | ${fmt(m.jankPct, 1)} | ${fmt(m.longTasks)}개 ${fmt(m.longTaskMs)}ms | ${fmt(m.loafBlockingMs)} | ${fmt(m.mainBusyPct)} | ${fmt(m.layoutStyleMs)} | ${fmt(m.compositorFps, 1)} | ${fmt(m.compositorDroppedPct, 1)} | ${fmt(m.heapMB, 1)} | ${m.p95Spread?.join('~') ?? '-'} | ${b.quiet.load1}${b.quiet.settled ? '' : '⚠'} |`);
    }
  }
  p();
}
console.log(out.join('\n'));
