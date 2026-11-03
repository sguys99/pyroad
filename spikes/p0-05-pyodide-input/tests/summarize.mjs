// results/*.json → 보고서용 Markdown 표. 사용: node tests/summarize.mjs > results/summary.md
import fs from 'node:fs';

const dir = new URL('../results/', import.meta.url);
const load = (n) => {
  try {
    return JSON.parse(fs.readFileSync(new URL(`${n}.json`, dir)));
  } catch {
    return null;
  }
};
const BROWSERS = ['chromium', 'firefox', 'webkit'];
const OPTS = ['sab', 'sw', 'transform', 'jspi'];
const LABEL = { sab: '① SAB', sw: '② SW+동기XHR', transform: '③ 코드 변환', jspi: '④ JSPI' };
const row = (cells) => `| ${cells.join(' | ')} |`;
const sep = (n) => row(Array(n).fill('---'));
const p = (s) => console.log(s);

// 1. 준비 + 왕복 지연
p('### 준비 시간 · 입력 왕복 지연 (Pyodide 314.0.7, self-host)\n');
p(row(['브라우저', '방식', '준비(ms)', 'input 왕복 median / p95 (ms)', '채널(메인→워커) median', '비고']));
p(sep(6));
for (const b of BROWSERS)
  for (const o of OPTS) {
    const r = load(`${b}-${o}-314`);
    if (!r) {
      p(row([b, LABEL[o], '-', '-', '-', '결과 없음']));
      continue;
    }
    if (r.ready?.type !== 'ready') {
      p(row([b, LABEL[o], '실패', '-', '-', String(r.ready?.error || r.ready?.type)]));
      continue;
    }
    const l = r.latency;
    const info = r.ready.info || {};
    const note = [info.channel && `SW 채널 ${info.channel}`, info.canRunSync !== undefined && `can_run_sync=${info.canRunSync}`]
      .filter(Boolean)
      .join(', ');
    p(row([b, LABEL[o], r.ready.workerMs, l ? `${l.endToEnd.median} / ${l.endToEnd.p95}` : '-', l?.toWorker.median ?? '-', note]));
  }

// 2. 의미 보존 매트릭스
p('\n### input() 위치별 동작 (✅ 기대 출력 / ❌ 실패, 3개 브라우저 결과가 같으면 한 칸)\n');
const cases = load('chromium-sab-314')?.cases || load('chromium-transform-314')?.cases || {};
p(row(['케이스', ...OPTS.map((o) => LABEL[o])]));
p(sep(OPTS.length + 1));
for (const id of Object.keys(cases)) {
  const cells = OPTS.map((o) => {
    const per = BROWSERS.map((b) => load(`${b}-${o}-314`)?.cases?.[id]).map((c) =>
      !c ? '?' : c.pass ? '✅' : `❌ ${c.error ? c.error.replace(/\|/g, '/') : c.outcome === 'ok' ? '(잘못된 출력)' : c.outcome}`,
    );
    return per.every((x) => x === per[0]) ? per[0] : BROWSERS.map((b, i) => `${b[0].toUpperCase()}:${per[i]}`).join('<br>');
  });
  p(row([id, ...cells]));
}

// 3. 멈추기
p('\n### 멈추기(Stop) 동작\n');
p(row(['브라우저', '방식', '입력 대기 중', 'CPU 무한 루프', 'time.sleep 루프', 'time.sleep(0.5) 실측']));
p(sep(6));
const fmtStop = (s) => (!s ? '-' : s.how === 'graceful' ? `정상 중단 ${s.ms}ms` : `terminate ${s.ms}ms (재준비 ${s.reinitMs}ms)`) + (s && !s.nextRunOk ? ' ⚠️다음 실행 실패' : '');
for (const b of BROWSERS)
  for (const o of OPTS) {
    const r = load(`${b}-${o}-314`);
    if (!r?.stopBusyLoop) continue;
    p(row([b, LABEL[o], fmtStop(r.stopDuringInput), fmtStop(r.stopBusyLoop), fmtStop(r.stopSleepLoop), `${r.sleep?.out} (${r.sleep?.ms}ms)`]));
  }

// 4. 새로고침
p('\n### 입력 대기 중 새로고침 후\n');
p(row(['브라우저', ...OPTS.map((o) => LABEL[o])]));
p(sep(OPTS.length + 1));
for (const b of BROWSERS)
  p(
    row([
      b,
      ...OPTS.map((o) => {
        const a = load(`${b}-${o}-314`)?.afterReload;
        return !a ? '-' : a.type !== 'ready' ? '❌ ' + a.type : a.runOk ? `✅ (${a.workerMs}ms${a.info?.channel ? ', SW ' + a.info.channel : ''})` : '❌ 실행 실패';
      }),
    ]),
  );

// 5. 0.27.5 비교
p('\n### Pyodide 0.27.5(현재 앱 버전) 비교 (module worker)\n');
p(row(['브라우저', '방식', '준비(ms)', 'loop/init/stdin 케이스', 'time.sleep 루프 멈추기', 'time.sleep(0.5)']));
p(sep(6));
for (const b of BROWSERS)
  for (const o of ['sab', 'jspi']) {
    const r = load(`${b}-${o}-027`);
    if (!r) continue;
    if (r.ready?.type !== 'ready') {
      p(row([b, LABEL[o], '실패', String(r.ready?.error || ''), '-', '-']));
      continue;
    }
    const c = ['loop', 'init', 'stdin'].map((k) => `${k}:${r.cases?.[k]?.pass ? '✅' : '❌'}`).join(' ');
    p(row([b, LABEL[o], r.ready.workerMs, c, fmtStop(r.stopSleepLoop), r.sleep?.out]));
  }

// 6. CDN
p('\n### jsdelivr CDN에서 로드 (COEP require-corp, 방식 ①)\n');
p(row(['브라우저', '결과']));
p(sep(2));
for (const b of BROWSERS) {
  const r = load(`${b}-cdn`);
  p(row([b, !r ? '-' : r.ready?.type === 'ready' ? `✅ 준비 ${r.ready.workerMs}ms, 실행 ${r.runOk ? '✅' : '❌'}` : '❌ ' + (r.ready?.error || r.ready?.type)]));
}

// 7. 헤더 모드 (칸 = Chromium/Firefox/WebKit 순서, O=로드됨·격리됨, X=차단·안 됨)
p('\n### 헤더 모드별 격리 여부와 교차 출처 리소스 (각 칸: Chromium·Firefox·WebKit, O=됨 / X=안 됨)\n');
const H = Object.fromEntries(BROWSERS.map((b) => [b, load(`${b}-headers`)]));
const modes = ['plain', 'coop', 'coep', 'cred', 'dip'];
const MODE_LABEL = { plain: '헤더 없음', coop: 'COOP만', coep: 'COOP+COEP<br>require-corp', cred: 'COOP+COEP<br>credentialless', dip: 'Document-<br>Isolation-Policy' };
const tri = (f) => modes.map((m) => BROWSERS.map((b) => (H[b]?.[m] ? f(H[b][m]) : '?')).join(' '));
p(row(['항목', ...modes.map((m) => MODE_LABEL[m])]));
p(sep(1 + modes.length));
p(row(['crossOriginIsolated', ...tri((h) => (h.crossOriginIsolated ? 'O' : 'X'))]));
const probeNames = Object.keys(H.chromium?.plain?.probes || {});
for (const n of probeNames) p(row([n, ...tri((h) => ({ ok: 'O', blocked: 'X', timeout: 'T' })[h.probes?.[n]] ?? '?')]));
p(row(['교차 출처 팝업과 postMessage(opener)', ...tri((h) => (h.popup?.messageFromPopup ? 'O' : 'X'))]));

// 8. CSP
p('\n### 엄격한 CSP (`script-src \'self\' \'wasm-unsafe-eval\'`, `unsafe-eval` 없음)\n');
p(row(['브라우저', '② SW @ csp', '④ JSPI @ csp', '① SAB @ csp+COOP/COEP']));
p(sep(4));
for (const b of BROWSERS)
  p(
    row([
      b,
      ...['sw', 'jspi', 'sab'].map((o) => {
        const r = load(`${b}-csp-${o}`);
        if (!r) return '-';
        const v = r.violations?.length ? ` (CSP 경고 ${r.violations.length})` : '';
        return r.ready?.type === 'ready' ? (r.runOk ? '✅' : '❌ 실행') + v : '❌ ' + (r.ready?.error || r.ready?.type) + v;
      }),
    ]),
  );
