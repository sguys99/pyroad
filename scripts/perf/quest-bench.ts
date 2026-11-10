// 퀘스트 화면 첫 로드 성능 측정 (P6-16, §2.10 퀘스트 예산). 같은 하네스: quest-celebration-bench.ts·world-map-bench.ts
//
//   npm run perf:quest                       # 이미 만든 빌드(.next)로 서버를 띄워 잰다 (e2e env, 로컬 Supabase 필요)
//   npm run perf:quest -- --build            # e2e env로 빌드부터 (next build만: postbuild 검사는 건너뜀)
//   npm run perf:quest -- --base http://localhost:3100 --runs 3 --slow4g --out build/perf/quest.json
//
// 대상: 1스테이지 첫 퀘스트(처음 방문, 진행 없음 = P0-13 `newbie`). 기기 = Lighthouse 모바일과 같은 412×823 DPR 1.75 터치
// 지표 (매 회 새 사용자·새 컨텍스트 = HTTP 캐시 없음, 3회 중앙값)
// - JS 바이트: 페이지(메인 스레드)가 받은 `/_next/static/**.js`를 `.next`의 파일로 gzip -9 한 합 (랜딩 예산 검사와 같은 셈).
//   **라우트 JS(예산)** = HTML이 처음부터 거는 `<script src>` (Next "First Load JS"와 같은 범위, 하이드레이션 전에 받아 실행할 것).
//   참고: "활성까지" = 실행 버튼이 켜지기 전까지 받은 지연 chunk 포함 전부(CodeMirror 등), "2초 뒤까지" = 그 뒤 쉬는 틈에 받는 것
//   (자동 저장의 Supabase 클라이언트·축하 오버레이 미리 받기)까지. Pyodide·Worker 파일은 별도 예산(§2.10)이라 뺀다
// - 실행 버튼 활성: 내비게이션 시작 → `run-button`이 `data-runner-state="ready"`가 된 시각. CPU 1배 첫 방문 / 같은 컨텍스트로 다시 열기
// - TBT(관측): CPU 4배에서 FCP부터 실행 버튼 활성까지 롱태스크의 50ms 넘는 부분 합. Lighthouse 시뮬레이션 TBT와 같은 값은 아님
//   (같은 장비 전후 비교용, Lighthouse 값은 docs/perf/P6-16-quest.md)
// - LCP 요소: 마지막 largest-contentful-paint 항목의 요소 (서버가 그린 이야기 쪽이어야 함, 튜터 응답을 기다리지 않음)
// - --slow4g: Slow 4G(150ms·1.6Mbps, Worker 요청에도 걸림) 첫 방문에서 준비 중 진행 단계(`data-load-stage`)가 보였는지 + 활성 시각
// 예산(넘으면 종료 코드 1): 라우트 JS ≤ 350KB, TBT(관측) ≤ 800ms, 활성 1배 첫 방문 ≤ 3초·다시 열기 ≤ 2초

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { createServerClient } from '@supabase/ssr';

import { median } from './worldMapBudget';
import { firstLoadScripts } from './check-landing-budget.mjs';

export const QUEST_BUDGET = {
  routeJsKB: 350,
  readyFirstMs: 3000,
  readyRevisitMs: 2000,
  tbtMs: 800,
};

const r1 = (x: number) => Math.round(x * 10) / 10;

const MOBILE = {
  viewport: { width: 412, height: 823 },
  deviceScaleFactor: 1.75,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36',
};

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : 'true';
}

/** 페이지에 심는 기록기: LCP 요소·롱태스크·FCP·실행 버튼 활성 시각·진행 단계 */
function recorder() {
  const w = window as unknown as Record<string, unknown> & {
    __lt: number[][];
    __lcp: string;
    __ready: number;
    __stages: string[];
    __tiers: string[];
  };
  w.__lt = [];
  w.__lcp = '';
  w.__ready = 0;
  w.__stages = [];
  // 연출 단계(<html data-motion>)가 바뀐 기록: Pyodide 로딩·실행 중 실측 판정이 멈춰 있는지 (pauseSampling, P0-16)
  w.__tiers = [];
  const noteTier = () => {
    const t = document.documentElement.dataset.motion ?? '';
    if (w.__tiers.at(-1) !== t) w.__tiers.push(t);
  };
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__lt.push([e.startTime, e.duration]);
    }).observe({ type: 'longtask', buffered: true });
    new PerformanceObserver((l) => {
      const e = l.getEntries().at(-1) as unknown as { element?: Element };
      const el = e?.element;
      if (!el) return;
      const cls = (el.getAttribute('class') ?? '').split(/\s+/).slice(0, 2);
      w.__lcp = `${el.tagName.toLowerCase()}${cls.map((c) => (c ? `.${c}` : '')).join('')} "${(el.textContent ?? '').trim().slice(0, 40)}"`;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    /* 없음 */
  }
  // 시작 스크립트 시점에는 <html>이 아직 없을 수 있어 첫 프레임에서 붙인다
  let watching = false;
  const tick = () => {
    if (!watching && document.documentElement) {
      watching = true;
      noteTier();
      new MutationObserver(noteTier).observe(document.documentElement, {
        attributeFilter: ['data-motion'],
      });
    }
    const b = document.querySelector('[data-runner-state]');
    const st = b?.getAttribute('data-load-stage');
    if (st && !w.__stages.includes(st)) w.__stages.push(st);
    if (b?.getAttribute('data-runner-state') === 'ready' && !w.__ready) {
      w.__ready = performance.now();
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function main() {
  const { requireLocalStack, serverEnv, REPO_ROOT } =
    await import('../../e2e/support/env');
  const { adminClient } = await import('../../e2e/support/admin');
  const { stage } = await import('../../e2e/support/content');

  const RUNS = Number(arg('runs', '3'));
  const PORT = Number(arg('port', '3112'));
  const OUT = resolve(REPO_ROOT, arg('out', 'build/perf/quest.json') as string);
  const NEXT = join(REPO_ROOT, '.next');
  const stack = requireLocalStack();
  let base = arg('base');
  let server: ChildProcess | null = null;

  const run = (cmd: string, env: Record<string, string>) =>
    new Promise<void>((ok, fail) => {
      const p = spawn(cmd, {
        shell: true,
        cwd: REPO_ROOT,
        stdio: 'inherit',
        env: { ...process.env, ...env },
      });
      p.on('exit', (c) => (c === 0 ? ok() : fail(new Error(`${cmd} → ${c}`))));
    });

  if (!base) {
    const env = serverEnv(stack, PORT);
    await run('npm run content:build -- --fixtures e2e/fixtures/content', env);
    if (arg('build'))
      await run(
        'node scripts/pyodide/copy-assets.mjs && npx next build --turbopack',
        env,
      );
    base = `http://localhost:${PORT}`;
    server = spawn(`npx next start --port ${PORT}`, {
      shell: true,
      cwd: REPO_ROOT,
      stdio: 'ignore',
      env: { ...process.env, ...env },
      detached: true,
    });
    const until = Date.now() + 60_000;
    for (;;) {
      try {
        if ((await fetch(base)).status < 500) break;
      } catch {
        /* 아직 */
      }
      if (Date.now() > until) throw new Error(`서버가 뜨지 않음: ${base}`);
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const admin = adminClient();
  const first = stage(1).quests[0];
  const browser = await chromium.launch();

  const gz = new Map<string, number>();
  /** `/_next/static/...js` → 빌드 파일 gzip -9 크기 (바이트). 운영 brotli 전송은 이보다 조금 작다 */
  const gzipOf = (url: string) => {
    const p = new URL(url).pathname;
    if (!gz.has(p)) {
      const file = join(NEXT, p.replace(/^\/_next\//, ''));
      gz.set(
        p,
        existsSync(file)
          ? gzipSync(readFileSync(file), { level: 9 }).length
          : 0,
      );
    }
    return gz.get(p)!;
  };

  async function freshUser() {
    const email = `perf-quest-${Date.now()}-${randomBytes(3).toString('hex')}@e2e.pyroad.test`;
    const password = randomBytes(18).toString('base64url');
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user)
      throw new Error(`사용자 생성 실패: ${error?.message}`);
    const now = new Date().toISOString();
    await admin
      .from('users')
      .update({ onboarded_at: now, age_band: '14plus', age_checked_at: now })
      .eq('id', data.user.id);
    const jar = new Map<string, string>();
    const sb = createServerClient(stack.url, stack.anonKey, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cs) =>
          cs.forEach(({ name, value }) =>
            value ? jar.set(name, value) : jar.delete(name),
          ),
      },
    });
    const signIn = await sb.auth.signInWithPassword({ email, password });
    if (signIn.error) throw new Error(`로그인 실패: ${signIn.error.message}`);
    const host = new URL(base!).hostname;
    return {
      uid: data.user.id,
      cookies: [...jar].map(([name, value]) => ({
        name,
        value,
        domain: host,
        path: '/',
      })),
    };
  }

  /** 한 번 열기: 받은 JS·활성 시각·롱태스크·LCP */
  async function open(
    ctx: BrowserContext,
    opts: { rate?: number; slow4g?: boolean; run?: boolean } = {},
  ) {
    const page: Page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    if (opts.rate)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: opts.rate });
    if (opts.slow4g) {
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
      });
    }
    const scripts: string[] = [];
    let readyAt = 0;
    const beforeReady = new Set<string>();
    page.on('response', (r) => {
      const u = r.url();
      if (
        r.request().resourceType() === 'script' &&
        u.includes('/_next/static/')
      ) {
        scripts.push(u);
        if (!readyAt) beforeReady.add(u);
      }
    });
    const doc = await page.goto(`${base}/quest/${first.id}`, {
      waitUntil: 'load',
    });
    // 서버가 보낸 HTML 그대로 (지연 chunk도 DOM에 <script>로 붙으므로 DOM으로 세면 섞인다)
    const html = firstLoadScripts(await doc!.text()).map(
      (src: string) => new URL(src, base).href,
    );
    await page.waitForFunction(
      () => (window as unknown as { __ready: number }).__ready > 0,
      null,
      { timeout: opts.slow4g ? 180_000 : 60_000, polling: 50 },
    );
    readyAt = Date.now();
    await page.waitForTimeout(2000);
    // 한 번 돌려 본다 (실행 중에도 판정이 멈추는지). 시작 코드로 누를 수 있을 때만
    const run = page.getByTestId('run-button').filter({ visible: true });
    if (opts.run) await page.getByRole('tab', { name: /공책/ }).click();
    if (opts.run && (await run.isEnabled())) {
      await run.click();
      await page.waitForTimeout(3000);
    }
    const m = await page.evaluate(() => {
      const w = window as unknown as {
        __lt: number[][];
        __lcp: string;
        __ready: number;
        __stages: string[];
        __tiers: string[];
      };
      const fcp =
        performance.getEntriesByName('first-contentful-paint')[0]?.startTime ??
        0;
      const tbt = w.__lt
        .filter(([s, d]) => s + d > fcp && s < w.__ready)
        .reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
      return {
        readyMs: Math.round(w.__ready),
        fcpMs: Math.round(fcp),
        tbtMs: Math.round(tbt),
        longTasks: w.__lt.filter(([s]) => s < w.__ready).length,
        lcp: w.__lcp,
        stages: w.__stages,
        tierEnd: document.documentElement.dataset.motion ?? '',
        tierChanges: w.__tiers,
      };
    });
    const uniq = [...new Set(scripts)];
    const kb = (urls: string[]) =>
      r1(urls.reduce((a, u) => a + gzipOf(u), 0) / 1024);
    const htmlSet = new Set(html.map((u) => new URL(u).pathname));
    const lazy = uniq.filter((u) => !htmlSet.has(new URL(u).pathname));
    await page.close();
    return {
      ...m,
      htmlJsKB: kb(html.filter((u) => u.includes('/_next/static/'))),
      readyJsKB: kb([...beforeReady]),
      allJsKB: kb(uniq),
      lazyKB: kb(lazy),
      chunks: uniq
        .map((u) => ({
          path: new URL(u).pathname.split('/').pop(),
          kb: r1(gzipOf(u) / 1024),
          lazy: !htmlSet.has(new URL(u).pathname),
        }))
        .sort((a, b) => b.kb - a.kb),
    };
  }

  async function withUser<T>(fn: (ctx: BrowserContext) => Promise<T>) {
    const user = await freshUser();
    const ctx = await browser.newContext({
      ...MOBILE,
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
    });
    try {
      await ctx.addCookies(user.cookies);
      await ctx.addInitScript('window.__name = (f) => f');
      await ctx.addInitScript(recorder);
      return await fn(ctx);
    } finally {
      await ctx.close();
      await admin.auth.admin.deleteUser(user.uid);
    }
  }

  const result: Record<string, unknown> = {
    at: new Date().toISOString(),
    base,
    load1: r1(loadavg()[0]),
    runs: RUNS,
  };
  const fails: string[] = [];
  try {
    const cold = [];
    const revisit = [];
    const slow = [];
    for (let i = 0; i < RUNS; i++) {
      const r = await withUser(async (ctx) => {
        const a = await open(ctx);
        const b = await open(ctx);
        return { a, b };
      });
      const t = await withUser((ctx) => open(ctx, { rate: 4, run: true }));
      console.log(
        `#${i + 1} 1배 첫 방문 활성 ${r.a.readyMs}ms · 다시 열기 ${r.b.readyMs}ms · 라우트 JS ${r.a.htmlJsKB}KB · 활성까지 ${r.a.readyJsKB}KB · 2초 뒤까지 ${r.a.allJsKB}KB · 4배 TBT ${t.tbtMs}ms 활성 ${t.readyMs}ms 단계 ${t.tierChanges.join('→')} · LCP ${r.a.lcp}`,
      );
      cold.push(r.a);
      revisit.push(r.b);
      slow.push(t);
    }
    // 실측 판정이 Pyodide 로딩·실행 중 멈춰 있으면 연출 단계는 처음 값 그대로 (P0-16 pauseSampling)
    for (const t of slow)
      if (t.tierChanges.length > 1)
        fails.push(
          `CPU 4배 로딩·실행 중 연출 단계가 바뀜: ${t.tierChanges.join('→')}`,
        );
    let slow4g = null;
    if (arg('slow4g')) {
      slow4g = await withUser((ctx) => open(ctx, { slow4g: true }));
      console.log(
        `Slow 4G 첫 방문 활성 ${slow4g.readyMs}ms · 단계 ${slow4g.stages.join('→')}`,
      );
      if (!slow4g.stages.length)
        fails.push('Slow 4G 첫 방문에 준비 단계(data-load-stage)가 안 보임');
    }
    const med = (xs: Array<Record<string, unknown>>, k: string) =>
      median(xs.map((x) => x[k] as number));
    const summary = {
      htmlJsKB: med(cold, 'htmlJsKB'),
      readyJsKB: med(cold, 'readyJsKB'),
      allJsKB: med(cold, 'allJsKB'),
      lazyKB: med(cold, 'lazyKB'),
      readyFirstMs: med(cold, 'readyMs'),
      readyRevisitMs: med(revisit, 'readyMs'),
      fcpMs: med(cold, 'fcpMs'),
      tbt4xMs: med(slow, 'tbtMs'),
      ready4xMs: med(slow, 'readyMs'),
      lcp: cold.map((c) => c.lcp),
      slow4g: slow4g && { readyMs: slow4g.readyMs, stages: slow4g.stages },
    };
    console.log('요약', JSON.stringify(summary));
    if (summary.htmlJsKB > QUEST_BUDGET.routeJsKB)
      fails.push(
        `라우트 JS ${summary.htmlJsKB}KB > ${QUEST_BUDGET.routeJsKB}KB`,
      );
    if (summary.readyFirstMs > QUEST_BUDGET.readyFirstMs)
      fails.push(
        `실행 버튼 첫 방문 ${summary.readyFirstMs}ms > ${QUEST_BUDGET.readyFirstMs}ms`,
      );
    if (summary.readyRevisitMs > QUEST_BUDGET.readyRevisitMs)
      fails.push(
        `실행 버튼 다시 열기 ${summary.readyRevisitMs}ms > ${QUEST_BUDGET.readyRevisitMs}ms`,
      );
    if (summary.tbt4xMs > QUEST_BUDGET.tbtMs)
      fails.push(`TBT(관측) ${summary.tbt4xMs}ms > ${QUEST_BUDGET.tbtMs}ms`);
    if (cold.some((c) => !/qs-|story|h1/.test(c.lcp)))
      console.warn('경고: LCP 요소가 이야기 쪽이 아닐 수 있음 →', summary.lcp);
    Object.assign(result, {
      summary,
      chunks: cold[0].chunks,
      cold,
      revisit: revisit.map((x) => ({ ...x, chunks: undefined })),
      cpu4x: slow.map((x) => ({ ...x, chunks: undefined })),
      fails,
      load1After: r1(loadavg()[0]),
    });
    for (const c of cold[0].chunks.slice(0, 25))
      console.log(`  ${c.lazy ? '지연' : 'HTML'} ${c.kb}KB ${c.path}`);
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(result, null, 2));
    console.log(`\n→ ${OUT}`);
    if (fails.length) {
      console.error(`예산 밖:\n- ${fails.join('\n- ')}`);
      process.exitCode = 1;
    } else console.log('예산 모두 통과');
  } finally {
    await browser.close();
    try {
      if (server?.pid) process.kill(-server.pid);
    } catch {
      /* 이미 끝남 */
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
