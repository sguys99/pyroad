// 월드맵 저사양 성능 측정 (P5-14, §2.10 예산). P0-13 하네스(spikes/p0-13-perf-baseline/scripts/runtime.mjs)의 방법을
// 앱 저장소 안 정식 스크립트로 옮겼다. 결과·해석은 docs/perf/P5-14-world-map.md
//
//   npm run perf:world                     # 이미 만든 빌드(.next)로 서버를 띄워 잰다 (e2e와 같은 env, 로컬 Supabase 필요)
//   npm run perf:world -- --build          # e2e env로 빌드부터 (`npm run build`를 .env.local로 하면 소셜 로그인 e2e가 깨짐)
//   npm run perf:world -- --base http://localhost:3100 --runs 3 --out build/perf/world-map.json
//
// 장면 (태블릿 820×1180 DPR 2 터치, 안드로이드 UA, 매 회 새 컨텍스트, CDP CPU 스로틀)
// - idle   : 4배에서 가만히 5초 — 메인 스레드 바쁨(TaskDuration/시간), rAF fps. 단계 full·lite·minimal·동작 줄이기
// - scroll : 4배에서 터치 스와이프(800px/s) 아래·위 2번 — rAF p95, Chrome trace PipelineReporter로 컴포지터가 낸 프레임 fps
// - detect : 자동 단계에서 CPU 1·4·6배 × 기기 신호(deviceMemory·hardwareConcurrency 덮어쓰기) — 10초 뒤 <html data-motion>이
//            정적 추정(staticGuess, 상한) 이하인지. P0-16 spikes/p0-16-low-spec/bench/validate.mjs의 프로필과 같은 값
// - still  : minimal에서 스크롤해도 앰비언트·패럴랙스 0 (getAnimations·.wm-par transform)
//
// 예산을 넘으면 종료 코드 1. 테스트 사용자는 실행마다 만들고 끝나면 지운다

import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type CDPSession,
  type Page,
} from '@playwright/test';
import { createServerClient } from '@supabase/ssr';

import { staticGuess } from '../../src/lib/motion/detect';
import type { MotionTier } from '../../src/lib/motion/tier';

import { judge, median, pct, tierOk, type Measured } from './worldMapBudget';

const r1 = (x: number) => Math.round(x * 10) / 10;

// ── 실행부 ──────────────────────────────────────────────────

const TABLET = {
  viewport: { width: 820, height: 1180 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; SM-X210) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
};

/** P0-16 validate.mjs와 같은 기기 신호 + 1GB(minimal 경계) */
const PROFILES: Record<
  string,
  { hardwareConcurrency?: number; deviceMemory?: number } | null
> = {
  pc: null,
  chromebook: { hardwareConcurrency: 2, deviceMemory: 4 },
  weak: { hardwareConcurrency: 2, deviceMemory: 2 },
  tiny: { hardwareConcurrency: 4, deviceMemory: 1 },
};

const AMBIENT = /^wm-(cloud|wave|boat|bird|flap|spark|leaf)$/;

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : 'true';
}

async function main() {
  // e2e 도우미는 실행할 때만 (단위 테스트가 judge만 불러도 스택을 찾지 않게)
  const { requireLocalStack, serverEnv, REPO_ROOT } =
    await import('../../e2e/support/env');
  const { adminClient, completeQuests } =
    await import('../../e2e/support/admin');
  const { stage } = await import('../../e2e/support/content');

  const RUNS = Number(arg('runs', '3'));
  const PORT = Number(arg('port', '3110'));
  const OUT = resolve(
    REPO_ROOT,
    arg('out', 'build/perf/world-map.json') as string,
  );
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
    if (arg('build')) await run('npm run build', env);
    base = `http://localhost:${PORT}`;
    server = spawn(`npm run start -- --port ${PORT}`, {
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

  // 테스트 사용자: 온보딩 끝, 1스테이지 둘째 퀘스트까지 완료 (지도 위 진행·지금 위치가 있는 보통 화면)
  const admin = adminClient();
  const email = `perf-${Date.now()}-${randomBytes(3).toString('hex')}@e2e.pyroad.test`;
  const password = randomBytes(18).toString('base64url');
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user)
    throw new Error(`사용자 생성 실패: ${error?.message}`);
  const uid = created.user.id;
  const now = new Date().toISOString();
  await admin
    .from('users')
    .update({ onboarded_at: now, age_band: '14plus', age_checked_at: now })
    .eq('id', uid);
  const s1 = stage(1);
  await completeQuests(uid, s1.quests.slice(0, 2));

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
  const host = new URL(base).hostname;
  const cookies = [...jar].map(([name, value]) => ({
    name,
    value,
    domain: host,
    path: '/',
  }));

  const setMotion = async (tier: string, reduced: string) => {
    const { error: e } = await admin
      .from('users')
      .update({ settings: { motion: { tier, reduced } } })
      .eq('id', uid);
    if (e) throw new Error(e.message);
  };

  const browser = await chromium.launch({
    args: ['--enable-precise-memory-info'],
  });

  async function open(
    rate: number,
    profile: (typeof PROFILES)[string] = null,
  ): Promise<{ ctx: BrowserContext; page: Page; cdp: CDPSession }> {
    const ctx = await browser.newContext({
      ...TABLET,
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
    });
    await ctx.addCookies(cookies);
    // tsx(esbuild)가 page.evaluate 함수 안 화살표에 붙이는 __name 도우미
    await ctx.addInitScript('window.__name = (f) => f');
    if (profile) {
      await ctx.addInitScript((p) => {
        Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', {
          get: () => p.hardwareConcurrency,
          configurable: true,
        });
        Object.defineProperty(Navigator.prototype, 'deviceMemory', {
          get: () => p.deviceMemory,
          configurable: true,
        });
      }, profile);
    }
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await cdp.send('Performance.enable');
    await page.goto(`${base}/world`, { waitUntil: 'load' });
    await page.locator('.world-map').first().waitFor();
    return { ctx, page, cdp };
  }

  const taskSec = async (cdp: CDPSession) =>
    (await cdp.send('Performance.getMetrics')).metrics.find(
      (m) => m.name === 'TaskDuration',
    )!.value;

  const startRaf = (page: Page) =>
    page.evaluate(() => {
      const w = window as unknown as { __f: number[]; __on: boolean };
      w.__f = [];
      w.__on = true;
      const loop = (t: number) => {
        if (!w.__on) return;
        w.__f.push(t);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
  const stopRaf = (page: Page) =>
    page.evaluate(() => {
      const w = window as unknown as { __f: number[]; __on: boolean };
      w.__on = false;
      const iv: number[] = [];
      for (let i = 1; i < w.__f.length; i++) iv.push(w.__f[i] - w.__f[i - 1]);
      return iv;
    });

  async function idle(rate: number) {
    const { ctx, page, cdp } = await open(rate);
    await page.waitForTimeout(3000);
    const t0 = await taskSec(cdp);
    const w0 = Date.now();
    await startRaf(page);
    await page.waitForTimeout(5000);
    const iv = await stopRaf(page);
    const busy = ((await taskSec(cdp)) - t0) / ((Date.now() - w0) / 1000);
    await ctx.close();
    return {
      mainBusyPct: r1(busy * 100),
      rafFps: r1(1000 / (iv.reduce((a, b) => a + b, 0) / iv.length)),
      rafP95: r1(pct(iv, 95)),
    };
  }

  async function scroll(rate: number) {
    const { ctx, page, cdp } = await open(rate);
    await page.waitForTimeout(2500);
    const { dist, w, h } = await page.evaluate(() => ({
      dist: document.scrollingElement!.scrollHeight - innerHeight,
      w: innerWidth,
      h: innerHeight,
    }));
    await page.evaluate(() => window.scrollTo(0, 0));
    await (browser as Browser).startTracing(page, {
      categories: [
        'benchmark',
        'cc',
        'disabled-by-default-devtools.timeline.frame',
        'viz',
      ],
    });
    const w0 = Date.now();
    await startRaf(page);
    for (let k = 0; k < 2; k++) {
      await cdp.send('Input.synthesizeScrollGesture', {
        x: Math.round(w / 2),
        y: Math.round(h * 0.8),
        yDistance: -dist,
        speed: 800,
        gestureSourceType: 'touch',
      });
      await page.waitForTimeout(200);
      await cdp.send('Input.synthesizeScrollGesture', {
        x: Math.round(w / 2),
        y: Math.round(h * 0.2),
        yDistance: dist,
        speed: 800,
        gestureSourceType: 'touch',
      });
      await page.waitForTimeout(200);
    }
    const iv = await stopRaf(page);
    const durMs = Date.now() - w0;
    const trace = JSON.parse((await browser.stopTracing()).toString()) as {
      traceEvents: Array<{
        name: string;
        ph: string;
        pid: number;
        args?: Record<
          string,
          { state?: string; frame_source?: number; frame_sequence?: number }
        >;
      }>;
    };
    const seen = new Set<string>();
    let presented = 0;
    let dropped = 0;
    for (const e of trace.traceEvents) {
      if (e.name !== 'PipelineReporter' || e.ph !== 'b') continue;
      const r = e.args?.frame_reporter ?? e.args?.chrome_frame_reporter;
      if (!r) continue;
      const key = `${e.pid}:${r.frame_source}:${r.frame_sequence}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (r.state?.startsWith('STATE_PRESENTED')) presented++;
      else if (r.state === 'STATE_DROPPED') dropped++;
    }
    await ctx.close();
    return {
      distPx: dist,
      rafP95: r1(pct(iv, 95)),
      rafFps: r1(1000 / (iv.reduce((a, b) => a + b, 0) / iv.length)),
      // 컴포지터가 내야 했던 프레임 중 실제로 낸 비율 × 60Hz. 스와이프 사이 쉬는 동안은 새 프레임이 필요 없어
      // 집계되지 않으므로 "낸 프레임 ÷ 전체 시간"(presentedPerSec, P0-13 방식)보다 끊김을 정확히 본다
      compositorFps: r1((60 * presented) / Math.max(1, presented + dropped)),
      presentedPerSec: r1((presented / durMs) * 1000),
      droppedPct: r1((dropped / Math.max(1, presented + dropped)) * 100),
    };
  }

  async function detect(rate: number, name: string) {
    const profile = PROFILES[name];
    const { ctx, page } = await open(rate, profile);
    await page.waitForTimeout(10_000);
    const observed = (await page.evaluate(
      () => document.documentElement.dataset.motion,
    )) as MotionTier;
    await ctx.close();
    const guess = staticGuess({
      ...(profile ?? {}),
      reducedMotion: false,
    }).tier;
    return {
      rate,
      profile: name,
      guess,
      observed,
      ok: tierOk(observed, guess),
    };
  }

  async function still() {
    const { ctx, page } = await open(4);
    await page.waitForTimeout(1500);
    const par0 = await page.$$eval('.wm-par', (els) =>
      els.map((e) => getComputedStyle(e).transform),
    );
    await page.evaluate(() => window.scrollTo(0, 700)); // 터치 기기 설정이라 휠 대신
    await page.waitForTimeout(800);
    const r = await page.evaluate((src) => {
      const re = new RegExp(src);
      const names = document
        .getAnimations()
        .filter((a) => a.playState === 'running')
        .map((a) => String((a as CSSAnimation).animationName ?? 'waapi'));
      return {
        ambient: names.filter((n) => re.test(n)).length,
        par: [...document.querySelectorAll('.wm-par')].map(
          (e) => getComputedStyle(e).transform,
        ),
      };
    }, AMBIENT.source);
    await ctx.close();
    // 패럴랙스(full만)는 스크롤에 따라 transform이 바뀐다 → 바뀐 레이어 수
    const parallaxMoved = r.par.filter((t, i) => t !== par0[i]).length;
    return { ambient: r.ambient, parallaxMoved };
  }

  const result: Record<string, unknown> = {
    at: new Date().toISOString(),
    base,
    load1: r1(loadavg()[0]),
    runs: RUNS,
  };
  try {
    // 첫 방문: 잠금 해제 본 기록이 조용히 남는다 (측정 중에 연출이 끼지 않게)
    await setMotion('minimal', 'off');
    await (await open(1)).ctx.close();

    const idleRows: Record<string, unknown>[] = [];
    for (const [tier, reduced] of [
      ['full', 'off'],
      ['lite', 'off'],
      ['minimal', 'off'],
      ['full', 'on'],
    ] as const) {
      await setMotion(tier, reduced);
      const reps = [];
      for (let i = 0; i < RUNS; i++) reps.push(await idle(4));
      const row = {
        tier,
        reduced,
        mainBusyPct: median(reps.map((x) => x.mainBusyPct)),
        rafFps: median(reps.map((x) => x.rafFps)),
        rafP95: median(reps.map((x) => x.rafP95)),
        reps: reps.map((x) => x.mainBusyPct),
      };
      idleRows.push(row);
      console.log('idle 4x', JSON.stringify(row));
    }

    const scrollRows: Array<
      Record<string, unknown> & Measured['scroll4x'][number]
    > = [];
    for (const rate of [4, 6]) {
      for (const tier of ['full', 'lite', 'minimal'] as const) {
        await setMotion(tier, 'off');
        const reps = [];
        for (let i = 0; i < RUNS; i++) reps.push(await scroll(rate));
        const row = {
          rate,
          tier,
          distPx: reps[0].distPx,
          rafP95: median(reps.map((x) => x.rafP95)),
          rafFps: median(reps.map((x) => x.rafFps)),
          compositorFps: median(reps.map((x) => x.compositorFps)),
          presentedPerSec: median(reps.map((x) => x.presentedPerSec)),
          droppedPct: median(reps.map((x) => x.droppedPct)),
        };
        scrollRows.push(row);
        console.log(`scroll ${rate}x`, JSON.stringify(row));
      }
    }

    await setMotion('auto', 'off');
    const detectRows = [];
    for (const rate of [1, 4, 6])
      for (const name of Object.keys(PROFILES)) {
        const row = await detect(rate, name);
        detectRows.push(row);
        console.log('detect', JSON.stringify(row));
      }

    // 대조군: full에서는 앰비언트가 돌고 패럴랙스가 움직여야 아래 0 검사가 살아 있다
    await setMotion('full', 'off');
    const full = await still();
    await setMotion('minimal', 'off');
    const minimal = await still();
    await setMotion('full', 'on');
    const reduced = await still();
    console.log(
      'still full',
      JSON.stringify(full),
      'minimal',
      JSON.stringify(minimal),
      'reduced',
      JSON.stringify(reduced),
    );

    const fails = judge({
      idleFull4x: idleRows[0] as Measured['idleFull4x'],
      // 예산은 4배에서 full·lite (6배는 참고)
      scroll4x: scrollRows.filter((r) => r.rate === 4 && r.tier !== 'minimal'),
    });
    detectRows
      .filter((d) => !d.ok)
      .forEach((d) =>
        fails.push(
          `${d.rate}x ${d.profile}: 자동 단계 ${d.observed} > 추정 ${d.guess}`,
        ),
      );
    if (!full.ambient || !full.parallaxMoved)
      fails.push(
        `대조군 full 앰비언트 ${full.ambient} · 패럴랙스 ${full.parallaxMoved} (검사가 아무것도 못 봄)`,
      );
    if (minimal.ambient || minimal.parallaxMoved)
      fails.push(
        `minimal 앰비언트 ${minimal.ambient} · 패럴랙스 ${minimal.parallaxMoved}`,
      );
    if (reduced.ambient || reduced.parallaxMoved)
      fails.push(
        `동작 줄이기 앰비언트 ${reduced.ambient} · 패럴랙스 ${reduced.parallaxMoved}`,
      );

    Object.assign(result, {
      idle: idleRows,
      scroll: scrollRows,
      detect: detectRows,
      still: { full, minimal, reduced },
      fails,
      load1After: r1(loadavg()[0]),
    });
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(result, null, 2));
    console.log(`\n→ ${OUT}`);
    if (fails.length) {
      console.error(`예산·기대 밖:\n- ${fails.join('\n- ')}`);
      process.exitCode = 1;
    } else console.log('예산 모두 통과');
  } finally {
    await browser.close();
    await admin.auth.admin.deleteUser(uid);
    if (server?.pid) process.kill(-server.pid);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
