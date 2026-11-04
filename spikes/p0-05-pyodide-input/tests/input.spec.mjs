// P0-05 매트릭스 테스트: 브라우저 × 방식별로 input() 동작, 왕복 지연, 멈추기, 새로고침, 교차 출처 리소스를 기록한다.
// 결과는 results/<browser>-<name>.json 에 저장하고 tests/summarize.mjs가 표로 만든다.
// "실패"도 결과이므로 대부분 soft 단언만 쓴다.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const RESULTS = new URL('../results/', import.meta.url);
fs.mkdirSync(RESULTS, { recursive: true });
const save = (name, data) => fs.writeFileSync(new URL(`${name}.json`, RESULTS), JSON.stringify(data, null, 2));

const OPTIONS = [
  { opt: 'sab', mode: 'coep' },
  { opt: 'sw', mode: 'plain' },
  { opt: 'transform', mode: 'plain' },
  { opt: 'jspi', mode: 'plain' },
];

async function openRunner(page, mode, opt, extra = '') {
  await page.goto(`/m/${mode}/web/index.html?opt=${opt}${extra}`);
  const h = await page.waitForFunction(
    () => spike.log.find((e) => ['ready', 'start-failed', 'init-error'].includes(e.type)),
    null,
    { timeout: 300_000 },
  );
  return h.jsonValue();
}

const stats = (xs) => {
  const a = [...xs].sort((x, y) => x - y);
  const q = (p) => (a.length ? Math.round(a[Math.min(a.length - 1, Math.floor(a.length * p))] * 10) / 10 : null);
  return { n: a.length, median: q(0.5), p95: q(0.95), min: q(0) };
};

// 프로그램 실행 중 멈추기: when='input'이면 입력 대기 중, 숫자면 그 ms 뒤
const stopScenario = (page, prog, when) =>
  page.evaluate(
    async ([prog, when]) => {
      const from = spike.log.length;
      const p = spike.runner.run(spike.DEMO[prog]);
      if (when === 'input') await spike.waitFor('input-request', from);
      else await new Promise((r) => setTimeout(r, when));
      const s = await spike.runner.stop();
      const done = await p;
      const chain = spike.CASES.find((c) => c[0] === 'chain');
      const after = await spike.runner.runScripted(chain[2], chain[3], 15000);
      return { ...s, stoppedFlag: !!done.stopped, nextRunOk: !!after.done.ok && after.transcript.includes('x!x!') };
    },
    [prog, when],
  );

const step = (r, msg) => console.log(`[${r.browser}/${r.opt}/${r.ver}] ${msg}`);

async function fullMatrix(page, browserName, opt, mode, ver, checkpoint = () => {}) {
  const r = { browser: browserName, opt, mode, ver };
  const stepSave = (rr, msg) => (checkpoint(rr), step(rr, msg)); // 중간 결과도 저장
  stepSave(r, 'open');
  r.ready = await openRunner(page, mode, opt, `&v=${ver}`);
  if (r.ready.type !== 'ready') return r;

  // 1) 의미 보존 매트릭스
  r.cases = {};
  const cases = await page.evaluate(() => spike.CASES);
  stepSave(r, 'ready ' + JSON.stringify(r.ready.info));
  for (const [id, , code, inputs, want] of cases) {
    stepSave(r, 'case ' + id);
    const res = await page.evaluate(([c, i]) => spike.runner.runScripted(c, i, 10000), [code, inputs]);
    const text = res.transcript + '\n' + (res.done.error || '');
    const pass = text.includes(want) && (id === 'errorline' ? /ValueError/.test(text) : !!res.done.ok);
    r.cases[id] = {
      pass,
      used: res.used,
      outcome: res.done.type === 'timeout' ? 'timeout' : res.done.ok ? 'ok' : res.done.stopped ? 'stopped' : 'error',
      error: res.done.error ? res.done.error.trim().split('\n').slice(-1)[0].slice(0, 160) : undefined,
      notes: res.notes,
    };
  }

  // 2) 왕복 지연 (echo 40회)
  stepSave(r, 'latency');
  const lat = await page.evaluate(() =>
    spike.runner.runScripted(spike.DEMO.echo, [...Array.from({ length: 40 }, (_, i) => 'm' + i), '끝'], 60000),
  );
  const parts = lat.parts.slice(1);
  r.latency = {
    endToEnd: stats(lat.rtts.slice(1)),
    toWorker: stats(parts.map((p) => p.toWorker)),
    python: stats(parts.map((p) => p.python)),
    toMain: stats(parts.map((p) => p.toMain)),
  };

  // 3) time.sleep 동작
  stepSave(r, 'sleep');
  const sl = await page.evaluate(() => spike.runner.runScripted(spike.DEMO.sleepcheck, [], 10000));
  r.sleep = { out: sl.transcript.trim(), ms: sl.done.ms };

  // 4) 멈추기
  stepSave(r, 'stop');
  r.stopDuringInput = await stopScenario(page, 'age', 'input');
  r.stopBusyLoop = await stopScenario(page, 'busy', 500);
  r.stopSleepLoop = await stopScenario(page, 'sleepy', 700);
  r.restarts = await page.evaluate(() => spike.runner.restarts);

  // 5) 입력 대기 중 새로고침 → 다시 준비되고 실행되는지
  stepSave(r, 'reload');
  const from = await page.evaluate(() => {
    const n = spike.log.length;
    spike.runner.run(spike.DEMO.age); // 입력 대기 상태로 둔다 (await 하지 않음)
    return n;
  });
  await page.waitForFunction((n) => spike.log.slice(n).some((e) => e.type === 'input-request'), from);
  await page.reload();
  r.afterReload = await page
    .waitForFunction(() => spike.log.find((e) => ['ready', 'start-failed', 'init-error'].includes(e.type)), null, {
      timeout: 300_000,
    })
    .then((h) => h.jsonValue());
  if (r.afterReload.type === 'ready') {
    const res = await page.evaluate(() => {
      const c = spike.CASES.find((x) => x[0] === 'loop');
      return spike.runner.runScripted(c[2], c[3], 15000);
    });
    r.afterReload.runOk = !!res.done.ok;
  }
  return r;
}

for (const { opt, mode } of OPTIONS) {
  test(`${opt} @ ${mode} (Pyodide 314.0.7)`, async ({ page, browserName }) => {
    const r = await fullMatrix(page, browserName, opt, mode, '314.0.7', (part) => save(`${browserName}-${opt}-314`, part));
    save(`${browserName}-${opt}-314`, r);
    expect.soft(r.ready.type, JSON.stringify(r.ready)).toBe('ready');
  });
}

// Pyodide 0.27.5(현재 앱 버전) 비교: module worker로도 뜨는지, JSPI/sleep 차이
for (const { opt, mode } of OPTIONS.filter((o) => ['sab', 'jspi'].includes(o.opt))) {
  test(`${opt} @ ${mode} (Pyodide 0.27.5)`, async ({ page, browserName }) => {
    const r = await fullMatrix(page, browserName, opt, mode, '0.27.5', (part) => save(`${browserName}-${opt}-027`, part));
    save(`${browserName}-${opt}-027`, r);
    expect.soft(r.ready.type).toBe('ready');
  });
}

// jsdelivr CDN에서 Pyodide를 받는 경우 COEP require-corp에서도 워커 로드가 되는지 (실제 네트워크)
test('sab @ coep with jsdelivr CDN', async ({ page, browserName }) => {
  const r = { browser: browserName };
  r.ready = await openRunner(page, 'coep', 'sab', '&cdn=1');
  if (r.ready.type === 'ready') {
    const res = await page.evaluate(() => {
      const c = spike.CASES.find((x) => x[0] === 'loop');
      return spike.runner.runScripted(c[2], c[3], 15000);
    });
    r.runOk = !!res.done.ok;
  }
  save(`${browserName}-cdn`, r);
  expect.soft(r.ready.type).toBe('ready');
});

// 헤더 모드별 격리 여부 + 교차 출처 리소스 + 팝업(opener) 영향
test('isolation headers: cross-origin probes', async ({ page, browserName, context }) => {
  const out = {};
  for (const mode of ['plain', 'coop', 'coep', 'cred', 'dip']) {
    await page.goto(`/m/${mode}/web/index.html?opt=sab&autostart=0&real=1`);
    const env = await page.evaluate(() => spike.env);
    const probes = await page.evaluate(() => spike.runProbes());
    const popup = await page.evaluate(() => spike.popupProbe());
    for (const p of context.pages()) if (p !== page) await p.close();
    out[mode] = { crossOriginIsolated: env.crossOriginIsolated, sab: env.sab, jspi: env.jspi, probes, popup };
  }
  save(`${browserName}-headers`, out);
});

// B27 대비: 엄격한 CSP(script-src 'self' 'wasm-unsafe-eval', 'unsafe-eval' 없음)에서도 Pyodide·워커·SW가 동작하는지
for (const [opt, mode] of [['jspi', 'csp'], ['sw', 'csp'], ['sab', 'cspcoep']]) {
  test(`CSP: ${opt} @ ${mode}`, async ({ page, browserName }) => {
    const violations = [];
    page.on('console', (m) => /Content Security Policy|CSP/i.test(m.text()) && violations.push(m.text().slice(0, 200)));
    const r = { browser: browserName, opt, mode };
    r.ready = await openRunner(page, mode, opt);
    if (r.ready.type === 'ready') {
      const res = await page.evaluate(() => {
        const c = spike.CASES.find((x) => x[0] === 'loop');
        return spike.runner.runScripted(c[2], c[3], 15000);
      });
      r.runOk = !!res.done.ok;
    }
    r.violations = violations;
    save(`${browserName}-csp-${opt}`, r);
    expect.soft(r.ready.type).toBe('ready');
  });
}
