// Lighthouse CI (P12-03, §2.10). P0-13 하네스(로컬 Supabase·시드 사용자·`@supabase/ssr` 쿠키 주입·`next start`)를 정식으로 옮긴 것.
// 같은 하네스: quest-bench.ts·world-map-bench.ts. 사용법: docs/perf/lighthouse.md
//
//   npm run perf:lighthouse                  # 이미 만든 빌드(.next, e2e env)로 서버를 띄워 5화면 × 3회 (로컬 Supabase 필요)
//   npm run perf:lighthouse -- --build       # e2e env로 빌드부터 (next build만: postbuild 검사는 건너뜀)
//   npm run perf:lighthouse -- --runs 1 --routes landing,world --out build/perf/lh-try.json
//
// - 모바일 = Lighthouse 기본 설정(시뮬레이션 스로틀: RTT 150ms·1.6Mbps·CPU 4배, 412×823 DPR 1.75). 회차마다 새 Chrome 프로필(캐시 없음)
// - 로그인 화면은 Chrome 기본 컨텍스트에 세션 쿠키를 넣고 측정한다. Lighthouse의 저장소 초기화는 쿠키를 지우지 않는다 (P0-13)
// - 사용자: 진행 중(1·2스테이지 + 3스테이지 앞 두 퀘스트 = P0-13 `perf`) · 첫 방문(진행 없음 = `newbie`) · 코드 퀘스트 다 깬 사용자(7스테이지 프로젝트가 열림)
// - 결과: --out(기본 build/perf/lighthouse.json) + 회차별 Lighthouse 원본 JSON(<out 폴더>/lighthouse-raw/), 요약 마크다운은
//   stdout·<out>.md·GitHub job summary. 판정·예산·기준 비교는 summarize.mjs (차단이면 종료 코드 1)

import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { parse } from 'yaml';
import { chromium } from '@playwright/test';

import { median } from './worldMapBudget';
import {
  firstLoadScripts,
  hiddenTextByInlineOpacity,
} from './check-landing-budget.mjs';
import { readBaseline, summarize } from './summarize.mjs';

type Who = 'progress' | 'newbie' | 'unlocked' | null;

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : 'true';
}

const freePort = () =>
  new Promise<number>((ok) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number };
      s.close(() => ok(port));
    });
  });

async function connectWhenReady(url: string) {
  const until = Date.now() + 30_000;
  for (;;) {
    try {
      return await chromium.connectOverCDP(url);
    } catch (e) {
      if (Date.now() > until) throw e;
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

/** 7스테이지 프로젝트 퀘스트 id (support/content의 projectQuest는 단계 정답까지 읽어 무거움) */
function projectQuestId(root: string): string {
  const dir = join(root, 'content/worlds/python-island');
  for (const d of readdirSync(dir).sort())
    for (const f of existsSync(join(dir, d, 'stage.yaml'))
      ? readdirSync(join(dir, d)).sort()
      : []) {
      if (f === 'stage.yaml' || !f.endsWith('.yaml')) continue;
      const q = parse(readFileSync(join(dir, d, f), 'utf8'));
      if (q.quest_type === 'project') return q.id;
    }
  throw new Error('프로젝트 퀘스트가 content/에 없음');
}

/** Lighthouse 감사 한 회차를 요약 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function digest(lhr: any) {
  const cat = (id: string) =>
    lhr.categories[id]?.score == null
      ? null
      : Math.round(lhr.categories[id].score * 100);
  const items: { url: string; transferSize?: number; resourceType?: string }[] =
    lhr.audits['network-requests']?.details?.items ?? [];
  let total = 0;
  let js = 0;
  let pyodide = 0;
  for (const it of items) {
    const t = it.transferSize ?? 0;
    const path = new URL(it.url).pathname;
    // Pyodide 코어·패키지와 실행 Worker는 별도 예산 (§2.10)
    if (path.startsWith('/pyodide/') || path.startsWith('/workers/'))
      pyodide += t;
    else {
      total += t;
      if (it.resourceType === 'Script') js += t;
    }
  }
  const failing = (catId: string) =>
    (lhr.categories[catId]?.auditRefs ?? [])
      .map((ref: { id: string; weight: number }) => ({
        ref,
        a: lhr.audits[ref.id],
      }))
      .filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ a }: any) =>
          a &&
          a.score != null &&
          a.score < 1 &&
          !['informative', 'notApplicable', 'manual'].includes(
            a.scoreDisplayMode,
          ),
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map(({ a }: any) => ({
        id: a.id,
        title: a.title,
        n: a.details?.items?.length ?? null,
        nodes: (a.details?.items ?? [])
          .slice(0, 3)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((x: any) => x.node?.snippet ?? x.source?.url ?? x.url ?? null)
          .filter(Boolean),
      }));
  return {
    performance: cat('performance'),
    accessibility: cat('accessibility'),
    bestPractices: cat('best-practices'),
    lcp: lhr.audits['largest-contentful-paint']?.numericValue ?? null,
    tbt: lhr.audits['total-blocking-time']?.numericValue ?? null,
    cls: lhr.audits['cumulative-layout-shift']?.numericValue ?? null,
    totalKB: total / 1024,
    jsKB: js / 1024,
    pyodideKB: pyodide / 1024,
    requests: items.length,
    lcpElement:
      lhr.audits['largest-contentful-paint-element']?.details?.items?.[0]
        ?.items?.[0]?.node?.snippet ?? null,
    finalUrl: lhr.finalDisplayedUrl,
    failing: {
      accessibility: failing('accessibility'),
      'best-practices': failing('best-practices'),
    },
  };
}

async function main() {
  const { requireLocalStack, serverEnv, REPO_ROOT } =
    await import('../../e2e/support/env');
  const { completeQuests } = await import('../../e2e/support/admin');
  const { stages } = await import('../../e2e/support/content');
  const { createSocialUser, deleteSocialUsers } =
    await import('../../e2e/support/socialUsers');

  const RUNS = Number(arg('runs', '3'));
  const OUT = resolve(
    REPO_ROOT,
    arg('out', 'build/perf/lighthouse.json') as string,
  );
  const RAW = join(dirname(OUT), 'lighthouse-raw');
  const NEXT = join(REPO_ROOT, '.next');
  const stack = requireLocalStack();
  let base = arg('base');
  let server: ChildProcess | null = null;

  const ROUTES: Record<string, { path: string; who: Who; label: string }> = {
    landing: { path: '/', who: null, label: '랜딩 /' },
    world: { path: '/world', who: 'progress', label: '월드맵 /world' },
    quest1: {
      path: `/quest/${stages()[0].quests[0].id}`,
      who: 'newbie',
      label: '퀘스트 1-1 (첫 방문)',
    },
    project: {
      path: `/quest/${projectQuestId(REPO_ROOT)}`,
      who: 'unlocked',
      label: '프로젝트 7-3',
    },
    profile: { path: '/profile', who: 'progress', label: '프로필 /profile' },
  };
  const keys = (arg('routes') ?? Object.keys(ROUTES).join(','))
    .split(',')
    .filter((k) => ROUTES[k]);

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
    const port = Number(arg('port', '3114'));
    const env = serverEnv(stack, port);
    await run('npm run content:build -- --fixtures e2e/fixtures/content', env);
    if (arg('build'))
      await run(
        'node scripts/pyodide/copy-assets.mjs && npx next build --turbopack',
        env,
      );
    if (!existsSync(join(NEXT, 'BUILD_ID')))
      throw new Error('.next 빌드가 없음: --build 로 같이 빌드하세요');
    base = `http://localhost:${port}`;
    server = spawn(`npx next start --port ${port}`, {
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

  const cookies: Record<
    Exclude<Who, null>,
    { name: string; value: string }[]
  > = { progress: [], newbie: [], unlocked: [] };
  const browsers: string[] = [];
  try {
    const need = new Set(keys.map((k) => ROUTES[k].who));
    if (need.has('progress')) {
      const u = await createSocialUser({ onboarded: true });
      await completeQuests(
        u.id,
        stages().flatMap((s) =>
          s.order <= 2 ? s.quests : s.order === 3 ? s.quests.slice(0, 2) : [],
        ),
      );
      cookies.progress = await u.signIn();
    }
    if (need.has('newbie'))
      cookies.newbie = await (
        await createSocialUser({ onboarded: true })
      ).signIn();
    if (need.has('unlocked')) {
      const u = await createSocialUser({ onboarded: true });
      await completeQuests(
        u.id,
        stages().flatMap((s) => s.quests),
      );
      cookies.unlocked = await u.signIn();
    }

    /**
     * 서버 HTML 검사. 라우트 JS = 첫 로드 `<script src>`를 빌드 파일 gzip -9로 (랜딩 postbuild·perf:quest와 같은 셈),
     * hiddenText = opacity 0으로 서버가 그린 글자 (§2.10 규칙, 랜딩은 postbuild가 이미 봄 → 앱 화면도 여기서, B102)
     */
    const serverHtml = async (path: string, who: Who) => {
      const res = await fetch(base + path, {
        redirect: 'manual',
        headers: who
          ? {
              cookie: cookies[who]
                .map((c) => `${c.name}=${c.value}`)
                .join('; '),
            }
          : {},
      });
      if (res.status !== 200)
        throw new Error(`${path} HTML ${res.status} (로그인·잠금 확인)`);
      const html = await res.text();
      let sum = 0;
      for (const src of firstLoadScripts(html)) {
        const p = new URL(src, base).pathname;
        if (!p.startsWith('/_next/static/')) continue;
        const file = join(NEXT, p.replace(/^\/_next\//, ''));
        sum += existsSync(file)
          ? gzipSync(readFileSync(file), { level: 9 }).length
          : 0;
      }
      return {
        routeJsKB: Math.round((sum / 1024) * 10) / 10,
        hiddenText: hiddenTextByInlineOpacity(html) as string[],
      };
    };

    mkdirSync(RAW, { recursive: true });
    const routes: Record<string, unknown> = {};
    let lhVersion = '';
    let chromeVersion = '';
    for (const key of keys) {
      const route = ROUTES[key];
      const runs: ReturnType<typeof digest>[] = [];
      const errors: string[] = [];
      for (let i = 1; i <= RUNS; i++) {
        const port = await freePort();
        const profile = mkdtempSync(join(tmpdir(), 'pyroad-lh-'));
        browsers.push(profile);
        // Playwright가 받은 Chromium(새 헤드리스, headless shell 아님)을 직접 띄운다. Playwright로 띄우면 새 탭을 Playwright가
        // 붙잡아 Lighthouse가 멈춤 → 쿠키만 CDP로 넣고 끊은 뒤 Lighthouse가 같은 브라우저 기본 컨텍스트의 새 탭에서 잰다
        const chrome = spawn(
          chromium.executablePath(),
          [
            '--headless=new',
            `--remote-debugging-port=${port}`,
            `--user-data-dir=${profile}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--lang=ko-KR',
            ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
            'about:blank',
          ],
          { stdio: 'ignore' },
        );
        try {
          const cdp = await connectWhenReady(`http://127.0.0.1:${port}`);
          chromeVersion = cdp.version();
          if (route.who)
            await cdp.contexts()[0].addCookies(
              cookies[route.who].map((c) => ({
                ...c,
                url: base,
                sameSite: 'Lax' as const,
              })),
            );
          await cdp.close(); // connectOverCDP의 close는 연결만 끊음
          // Lighthouse는 CLI(순수 node)로: tsx로 불러오면 esbuild keepNames의 `__name`이 페이지에 넘기는 함수에 섞여 실패
          const report = join(RAW, `${key}-${i}.json`);
          execFileSync(
            join(REPO_ROOT, 'node_modules/.bin/lighthouse'),
            [
              base + route.path,
              `--port=${port}`,
              '--output=json',
              `--output-path=${report}`,
              '--only-categories=performance,accessibility,best-practices',
              '--locale=ko',
              '--max-wait-for-load=60000',
              '--no-enable-error-reporting',
              '--quiet',
            ],
            { stdio: 'inherit', timeout: 180_000 },
          );
          const lhr = JSON.parse(readFileSync(report, 'utf8'));
          lhVersion = lhr.lighthouseVersion;
          if (lhr.runtimeError)
            throw new Error(
              `${lhr.runtimeError.code}: ${lhr.runtimeError.message}`,
            );
          if (new URL(lhr.finalDisplayedUrl).pathname !== route.path)
            throw new Error(`다른 화면으로 이동함: ${lhr.finalDisplayedUrl}`);
          const d = digest(lhr);
          runs.push(d);
          console.log(
            `[lh] ${key} #${i} perf=${d.performance} a11y=${d.accessibility} bp=${d.bestPractices} LCP=${Math.round(d.lcp)} TBT=${Math.round(d.tbt)} total=${Math.round(d.totalKB)}KB js=${Math.round(d.jsKB)}KB pyodide=${Math.round(d.pyodideKB)}KB`,
          );
        } catch (e) {
          errors.push(`#${i} ${(e as Error).message}`);
          console.log(`[lh] ${key} #${i} 실패 ${(e as Error).message}`);
        } finally {
          if (chrome.exitCode === null && chrome.signalCode === null) {
            const gone = new Promise((r) => chrome.once('exit', r));
            chrome.kill();
            await gone;
          }
        }
      }
      const med = (f: (r: ReturnType<typeof digest>) => number | null) => {
        const v = median(runs.map(f).filter((x): x is number => x != null));
        return Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
      };
      const range = (f: (r: ReturnType<typeof digest>) => number | null) => {
        const v = runs
          .map(f)
          .filter((x): x is number => x != null)
          .sort((a, b) => a - b);
        return v.length ? [v[0], v.at(-1)] : null;
      };
      // 감사 목록은 Performance 중앙값 회차 것 (접근성 감사는 회차 간 같음)
      const perfMed = med((r) => r.performance);
      const rep = runs.find((r) => r.performance === perfMed) ?? runs[0];
      routes[key] = {
        label: route.label,
        path: route.path,
        errors,
        median: runs.length
          ? {
              performance: perfMed,
              accessibility: med((r) => r.accessibility),
              bestPractices: med((r) => r.bestPractices),
              lcp: med((r) => r.lcp),
              tbt: med((r) => r.tbt),
              cls: med((r) => r.cls),
              ...(await serverHtml(route.path, route.who)),
              jsKB: med((r) => r.jsKB),
              totalKB: med((r) => r.totalKB),
              pyodideKB: med((r) => r.pyodideKB),
              requests: med((r) => r.requests),
            }
          : null,
        spread: {
          performance: range((r) => r.performance),
          accessibility: range((r) => r.accessibility),
          lcp: range((r) => (r.lcp == null ? null : Math.round(r.lcp))),
          tbt: range((r) => (r.tbt == null ? null : Math.round(r.tbt))),
          totalKB: range((r) => Math.round(r.totalKB)),
        },
        lcpElement: rep?.lcpElement ?? null,
        failing: rep?.failing ?? null,
        // 회차 값만 (감사 목록은 위 failing 하나)
        runs: runs.map((r) => ({ ...r, failing: undefined })),
      };
    }

    let git = '';
    try {
      git = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      }).trim();
    } catch {
      /* git 없음 */
    }
    const result = {
      date: new Date().toISOString(),
      git,
      lighthouse: lhVersion,
      chrome: `Chromium ${chromeVersion}`,
      runs: RUNS,
      routes,
    };
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
    const { markdown, blocking } = summarize(result, readBaseline());
    writeFileSync(OUT.replace(/\.json$/, '.md'), markdown + '\n');
    console.log('\n' + markdown);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n');
    console.log(`[lh] 결과 → ${OUT} · 원본 → ${RAW}/ (${basename(OUT)})`);
    process.exitCode = blocking.length ? 1 : 0;
  } finally {
    await deleteSocialUsers().catch(() => {});
    for (const dir of browsers) rmSync(dir, { recursive: true, force: true });
    if (server?.pid) {
      try {
        process.kill(-server.pid);
      } catch {
        /* 이미 끝남 */
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
