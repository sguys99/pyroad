// 퀘스트 축하 오버레이 저사양 성능 측정 (P6-13, §2.10·P6-16 예산). P0-13 하네스의 "축하 A·B" 장면을
// world-map-bench.ts와 같은 방식(앱 저장소 안 정식 스크립트)으로 옮겼다. 결과·해석은 계획서 P6-13 기록
//
//   npm run perf:celebration                     # 이미 만든 빌드(.next)로 서버를 띄워 잰다 (e2e env, 로컬 Supabase 필요)
//   npm run perf:celebration -- --build          # e2e env로 빌드부터 (next build만: postbuild 검사는 건너뜀)
//   npm run perf:celebration -- --base http://localhost:3100 --runs 3 --out build/perf/quest-celebration.json
//
// 장면 (태블릿 820×1180 DPR 2 터치, 매 회 새 사용자·새 컨텍스트, CDP CPU 4배)
// - A: 1스테이지 마지막 퀘스트 정답 "코드 돌려보기" 클릭부터 7초 (채점 → 성공 장면 → 첫 축하 카드)
// - B: A 뒤 Enter로 다음 축하 카드, 그때부터 5초
// 지표: rAF 간격 p95·fps, 롱태스크 합(PerformanceObserver longtask), 메인 스레드 바쁨(TaskDuration)
// 예산(P6-16): rAF p95 ≤ 50ms, 롱태스크 합 ≤ 500ms. 넘으면 종료 코드 1

import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { chromium, type CDPSession, type Page } from '@playwright/test';
import { createServerClient } from '@supabase/ssr';

import { median, pct } from './worldMapBudget';
import { LEVEL_THRESHOLDS } from '../../src/lib/quest/xp';

export const CELEBRATION_BUDGET = { rafP95Ms: 50, longTaskSumMs: 500 };

const r1 = (x: number) => Math.round(x * 10) / 10;

const TABLET = {
  viewport: { width: 820, height: 1180 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; SM-X210) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
};

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : 'true';
}

async function main() {
  const { requireLocalStack, serverEnv, REPO_ROOT } =
    await import('../../e2e/support/env');
  const { adminClient, completeQuests } =
    await import('../../e2e/support/admin');
  const { stage } = await import('../../e2e/support/content');

  const RUNS = Number(arg('runs', '3'));
  const RATE = Number(arg('rate', '4'));
  const PORT = Number(arg('port', '3111'));
  const OUT = resolve(
    REPO_ROOT,
    arg('out', 'build/perf/quest-celebration.json') as string,
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
  const s1 = stage(1);
  const last = s1.quests[s1.quests.length - 1];
  const browser = await chromium.launch({
    args: ['--enable-precise-memory-info'],
  });

  /** 1스테이지 마지막 퀘스트 직전까지 끝낸 새 사용자 (정답 한 번에 스테이지 클리어 + 레벨 업 + 뱃지) */
  async function freshUser(tier: string, reduced: string) {
    const email = `perf-cel-${Date.now()}-${randomBytes(3).toString('hex')}@e2e.pyroad.test`;
    const password = randomBytes(18).toString('base64url');
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user)
      throw new Error(`사용자 생성 실패: ${error?.message}`);
    const uid = data.user.id;
    const now = new Date().toISOString();
    await admin
      .from('users')
      .update({
        onboarded_at: now,
        age_band: '14plus',
        age_checked_at: now,
        settings: { motion: { tier, reduced } },
      })
      .eq('id', uid);
    await completeQuests(uid, s1.quests.slice(0, -1));
    // 레벨 3 문턱 바로 아래: 정답 한 번에 레벨 업까지 (P0-13 "celeb" 사용자처럼 축하가 두 장 이상).
    // current_level 은 DB 트리거가 total_xp 에서 맞춤 (00028, B20)
    await admin
      .from('users')
      .update({ total_xp: LEVEL_THRESHOLDS[2] - 1 })
      .eq('id', uid);
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
      uid,
      cookies: [...jar].map(([name, value]) => ({
        name,
        value,
        domain: host,
        path: '/',
      })),
    };
  }

  const taskSec = async (cdp: CDPSession) =>
    (await cdp.send('Performance.getMetrics')).metrics.find(
      (m) => m.name === 'TaskDuration',
    )!.value;

  /** 측정 창 시작: rAF 기록 + 롱태스크 기록을 0부터 */
  const start = (page: Page) =>
    page.evaluate(() => {
      const w = window as unknown as {
        __f: number[];
        __on: boolean;
        __lt: number[];
        __t0: number;
      };
      w.__f = [];
      w.__on = true;
      w.__t0 = performance.now();
      const loop = (t: number) => {
        if (!w.__on) return;
        w.__f.push(t);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
  const stop = (page: Page) =>
    page.evaluate(() => {
      const w = window as unknown as {
        __f: number[];
        __on: boolean;
        __lt: number[][];
        __t0: number;
      };
      w.__on = false;
      const iv: number[] = [];
      for (let i = 1; i < w.__f.length; i++) iv.push(w.__f[i] - w.__f[i - 1]);
      const lt = (w.__lt ?? []).filter(([s]) => s >= w.__t0).map(([, d]) => d);
      // 긴 애니메이션 프레임(LoAF)의 원인: 스크립트(호출자·파일별 합)와 렌더(스타일·레이아웃) 합
      const loaf = (
        (w as unknown as { __loaf: PerformanceEntry[] }).__loaf ?? []
      ).filter((e) => e.startTime >= w.__t0) as unknown as Array<{
        duration: number;
        startTime: number;
        renderStart: number;
        styleAndLayoutStart: number;
        scripts: Array<{
          invoker: string;
          sourceURL: string;
          duration: number;
          forcedStyleAndLayoutDuration: number;
        }>;
      }>;
      const by: Record<string, number> = {};
      let render = 0;
      for (const f of loaf) {
        render +=
          f.startTime +
          f.duration -
          (f.renderStart || f.startTime + f.duration);
        for (const sc of f.scripts) {
          const k = `${sc.invoker} @ ${sc.sourceURL.split('/').pop()}`;
          by[k] = (by[k] ?? 0) + sc.duration;
        }
      }
      const top = Object.entries(by)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([k, v]) => `${Math.round(v)}ms ${k}`);
      return {
        iv,
        lt,
        loaf: { frames: loaf.length, renderMs: Math.round(render), top },
      };
    });

  async function measure(page: Page, cdp: CDPSession, ms: number) {
    const t0 = await taskSec(cdp);
    const w0 = Date.now();
    await page.waitForTimeout(ms);
    const { iv, lt, loaf } = await stop(page);
    if (arg('loaf')) console.log('  loaf', JSON.stringify(loaf));
    const busy = ((await taskSec(cdp)) - t0) / ((Date.now() - w0) / 1000);
    return {
      rafFps: r1(
        1000 / (iv.reduce((a, b) => a + b, 0) / Math.max(1, iv.length)),
      ),
      rafP95: r1(pct(iv, 95)),
      longTasks: lt.length,
      longTaskSum: Math.round(lt.reduce((a, b) => a + b, 0)),
      mainBusyPct: r1(busy * 100),
    };
  }

  async function once(tier: string, reduced: string) {
    const user = await freshUser(tier, reduced);
    const ctx = await browser.newContext({
      ...TABLET,
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
    });
    try {
      await ctx.addCookies(user.cookies);
      await ctx.addInitScript('window.__name = (f) => f');
      // 롱태스크는 페이지 시작부터 모아 두고 측정 창 안의 것만 센다
      await ctx.addInitScript(() => {
        const w = window as unknown as { __lt: number[][] };
        w.__lt = [];
        try {
          new PerformanceObserver((l) => {
            for (const e of l.getEntries())
              w.__lt.push([e.startTime, e.duration]);
          }).observe({ type: 'longtask', buffered: true });
          const lw = window as unknown as { __loaf: PerformanceEntry[] };
          lw.__loaf = [];
          new PerformanceObserver((l) => {
            lw.__loaf.push(...l.getEntries());
          }).observe({ type: 'long-animation-frame', buffered: true });
        } catch {
          /* 없음 */
        }
      });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Performance.enable');
      await page.goto(`${base}/quest/${last.id}`, { waitUntil: 'load' });
      // 준비는 1배로 (로딩 비용은 이 측정 대상이 아님), 측정 창만 스로틀. 태블릿은 번호 탭이라 공책 쪽으로
      const notebook = page.getByRole('tab', { name: /공책/ });
      await notebook.waitFor({ timeout: 30_000 });
      await notebook.click();
      const button = page.getByTestId('run-button').filter({ visible: true });
      await page
        .getByTestId('run-button')
        .filter({ visible: true, hasText: /코드 돌려보기/ })
        .waitFor({ timeout: 90_000 });
      const content = page
        .locator('.cm-editor .cm-content')
        .filter({ visible: true });
      await content.click();
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.insertText(last.solution);
      await page.waitForTimeout(1500);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
      await page.waitForTimeout(500);

      await start(page);
      await button.click();
      const a = await measure(page, cdp, 7000);
      const firstCard = await page
        .locator('[data-testid^="celebration-step-"]')
        .first()
        .getAttribute('data-testid')
        .catch(() => null);

      await start(page);
      await page.keyboard.press('Enter');
      const b = await measure(page, cdp, 5000);
      const secondCard = await page
        .locator('[data-testid^="celebration-step-"]')
        .first()
        .getAttribute('data-testid')
        .catch(() => null);
      return { a, b, cards: [firstCard, secondCard] };
    } finally {
      await ctx.close();
      await admin.auth.admin.deleteUser(user.uid);
    }
  }

  const result: Record<string, unknown> = {
    at: new Date().toISOString(),
    base,
    rate: RATE,
    load1: r1(loadavg()[0]),
    runs: RUNS,
  };
  const fails: string[] = [];
  try {
    const rows = [];
    for (const [tier, reduced] of [
      ['full', 'off'],
      ['full', 'on'],
    ] as const) {
      const reps: Awaited<ReturnType<typeof once>>[] = [];
      for (let i = 0; i < RUNS; i++) {
        const r = await once(tier, reduced);
        console.log(tier, reduced, JSON.stringify(r));
        reps.push(r);
      }
      for (const scene of ['a', 'b'] as const) {
        const pick = (k: keyof (typeof reps)[number]['a']) =>
          median(reps.map((r) => r[scene][k]));
        const row = {
          scene,
          tier,
          reduced,
          rafP95: pick('rafP95'),
          rafFps: pick('rafFps'),
          longTasks: pick('longTasks'),
          longTaskSum: pick('longTaskSum'),
          mainBusyPct: pick('mainBusyPct'),
          cards: reps[0].cards,
        };
        rows.push(row);
        console.log('scene', JSON.stringify(row));
        if (row.rafP95 > CELEBRATION_BUDGET.rafP95Ms)
          fails.push(
            `${scene} ${tier}/${reduced} rAF p95 ${row.rafP95}ms > ${CELEBRATION_BUDGET.rafP95Ms}ms`,
          );
        if (row.longTaskSum > CELEBRATION_BUDGET.longTaskSumMs)
          fails.push(
            `${scene} ${tier}/${reduced} 롱태스크 ${row.longTaskSum}ms > ${CELEBRATION_BUDGET.longTaskSumMs}ms`,
          );
      }
    }
    Object.assign(result, { rows, fails, load1After: r1(loadavg()[0]) });
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
