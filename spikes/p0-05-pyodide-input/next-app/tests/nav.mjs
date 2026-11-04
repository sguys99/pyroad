// P0-05: Next.js 라우트 단위 COOP/COEP + 소프트/하드 내비게이션 실측
// 전제: `next start -p 3105` 실행 중. 사용: node tests/nav.mjs [out.json]
// 각 단계에서 crossOriginIsolated, 문서 재로드 여부(boot 값), 교차 출처 이미지 로드 결과를 기록한다.
import { chromium, firefox, webkit } from 'playwright'; // next-app 안에 devDependency로 설치
import fs from 'node:fs';

const BASE = 'http://localhost:3105';
const out = {};

async function state(page) {
  await page.waitForFunction(() => window.__probe && window.__probe.path === location.pathname);
  // 이미지가 load/error로 끝날 때까지 대기
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 10000 }).catch(() => {});
  return page.evaluate(() => ({
    path: location.pathname,
    coi: window.__probe.coi,
    boot: window.__boot,
    imgs: Object.fromEntries([...document.images].map((i) => [i.id.replace('img-', ''), i.naturalWidth > 0 ? 'ok' : 'blocked'])),
    sab: document.querySelector('#sab')?.textContent,
  }));
}

async function step(page, log, label, action) {
  const before = await page.evaluate(() => window.__boot).catch(() => null);
  const t0 = Date.now();
  await action();
  const s = await state(page);
  if (s.sab !== undefined && s.coi) {
    await page.waitForFunction(() => !/checking/.test(document.querySelector('#sab').textContent), null, { timeout: 5000 }).catch(() => {});
    s.sab = await page.evaluate(() => document.querySelector('#sab').textContent);
  }
  const row = { label, ...s, reloaded: before === null ? 'first' : before !== s.boot, ms: Date.now() - t0 };
  delete row.boot;
  log.push(row);
  console.log(
    `  ${label.padEnd(44)} coi=${String(row.coi).padEnd(5)} reload=${String(row.reloaded).padEnd(5)} ${String(row.ms).padStart(5)}ms img=${JSON.stringify(row.imgs)}${row.sab ? ' ' + row.sab : ''}`,
  );
}

const click = (page, sel, path) => async () => {
  await page.click(sel);
  await page.waitForURL((u) => u.pathname === path);
};

for (const [name, B] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await B.launch();
  out[name] = {};
  console.log(`\n## ${name} ${browser.version()}`);

  for (const [group, base, note] of [
    ['A quest-only (next.config headers)', '', 'Link'],
    ['D quest-only (middleware headers)', '/mw', 'Link'],
    ['C quest-only + QuestLink(hard nav when !coi)', '/heal', 'QuestLink'],
    ['B whole app isolated', '/iso', 'Link'],
  ]) {
    console.log(`### ${group}`);
    const page = await (await browser.newContext()).newPage();
    const log = (out[name][group] = []);
    await step(page, log, `direct load ${base}/quest/1`, () => page.goto(BASE + `${base}/quest/1`));
    await step(page, log, `direct load ${base}/world`, () => page.goto(BASE + `${base}/world`));
    await step(page, log, `world → quest/1 (${note})`, click(page, '#to-q1', `${base}/quest/1`));
    if (base === '' || base === '/mw')
      await step(page, log, `quest/1 → quest/1 (<a href>, hard)`, async () => {
        await page.click('#hard-q1');
        await page.waitForLoadState('load');
      });
    await step(page, log, `quest/1 → quest/2 (${note})`, click(page, '#to-q2', `${base}/quest/2`));
    await step(page, log, `quest/2 → world (Link)`, click(page, '#to-world', `${base}/world`));
    await step(page, log, `world → quest/1 again (${note})`, click(page, '#to-q1', `${base}/quest/1`));
    await step(page, log, `browser back`, async () => {
      await page.goBack();
      await page.waitForURL((u) => u.pathname === `${base}/world`);
    });
    await step(page, log, `reload on world`, () => page.reload());
    await page.context().close();
  }
  await browser.close();
}

fs.writeFileSync(process.argv[2] || 'nav-results.json', JSON.stringify(out, null, 2));
